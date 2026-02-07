'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import {
  nativeBridge,
  launchNativeBridge,
  getNativeBridgeDownloadUrl,
  type BridgeAudioData,
} from '@/lib/audio/native-bridge';
import { useBridgeAudioStore } from '@/stores/bridge-audio-store';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useAudioStore } from '@/stores/audio-store';
import { useRoomStore } from '@/stores/room-store';

// Import audio engine for bridge audio processing
// We cache the engine reference for synchronous access in the hot audio path
let cachedAudioEngine: any = null;

// Pre-fetch the audio engine reference (call this before audio starts)
const ensureAudioEngineReady = () => {
  if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine) {
    cachedAudioEngine = (window as any).__openStudioAudioEngine;
    return true;
  }
  return false;
};

// Module-level audio data handler - stable reference, never re-registered
// This is critical because React effects can re-run and clearing/re-registering
// the handler would break the audio flow
let audioDataHandlerRegistered = false;
let audioDataCounter = 0;

const handleAudioDataStable = (data: BridgeAudioData) => {
  audioDataCounter++;

  // Use cached engine reference for zero-overhead access
  // Falls back to window reference if cache is stale
  const engine = cachedAudioEngine || (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine);
  if (!engine) {
    // Only warn once at start
    if (audioDataCounter === 1) {
      console.warn('[useNativeBridge] Audio dropped: engine not ready');
    }
    return;
  }

  // Update cache if it was stale
  if (!cachedAudioEngine) {
    cachedAudioEngine = engine;
  }

  try {
    // Pass timestamp for clock synchronization (ultra-low-latency mode)
    if (data.trackId) {
      engine.pushTrackBridgeAudio(data.trackId, data.samples, data.timestamp);
    } else {
      // No trackId from Rust - distribute to ALL tracks with bridge input configured.
      // The native bridge sends a single stereo stream; each track's channel routing
      // (e.g., channel selection) is handled by the TrackAudioProcessor.
      const bridgeTrackIds = engine.getBridgeTrackIds?.();
      if (bridgeTrackIds && bridgeTrackIds.length > 0) {
        for (const trackId of bridgeTrackIds) {
          engine.pushTrackBridgeAudio(trackId, data.samples, data.timestamp);
        }
      } else {
        // Fallback to primary track for backward compatibility
        const primaryTrackId = engine.getPrimaryTrackId?.();
        if (primaryTrackId) {
          engine.pushTrackBridgeAudio(primaryTrackId, data.samples, data.timestamp);
        } else if (audioDataCounter % 500 === 1) {
          console.warn('[useNativeBridge] Audio dropped: no bridge tracks and no primary track');
        }
      }
    }
  } catch (e) {
    console.error('[useNativeBridge] handleAudioData error:', e);
  }
};

// Register the stable audio handler once (module initialization)
const ensureAudioHandlerRegistered = () => {
  if (!audioDataHandlerRegistered) {
    console.log('[useNativeBridge] Registering stable audioData handler');
    nativeBridge.on('audioData', handleAudioDataStable);
    audioDataHandlerRegistered = true;
  }
};

interface BridgeDevice {
  id: string;
  name: string;
  isInput: boolean;
  isOutput: boolean;
  channels: { index: number; name: string }[];
  sampleRates: number[];
  isDefault: boolean;
  driverType: string;
}

export function useNativeBridge() {
  // Get store state reactively for UI updates
  const storeState = useBridgeAudioStore();

  // Track whether we've completed the initial availability check
  const [hasCheckedAvailability, setHasCheckedAvailability] = useState(false);

  // Use refs to track initialization
  const initialized = useRef(false);

  // Ref to hold startAudio function for auto-start
  const startAudioRef = useRef<(() => Promise<void>) | null>(null);

  // Single useEffect for setup - runs once on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Get store actions (these are stable)
    const store = useBridgeAudioStore.getState();

    // Sync sample rates between stores on initialization
    // bridge-audio-store is persisted and is the source of truth for user's preference
    // audio-store is NOT persisted, so we need to sync it on every load
    const bridgeSampleRate = store.sampleRate;
    const audioStoreState = useAudioStore.getState();
    if (bridgeSampleRate !== audioStoreState.settings.sampleRate) {
      console.log(`[useNativeBridge] Syncing sample rate on init: bridge-store=${bridgeSampleRate}, audio-store=${audioStoreState.settings.sampleRate}`);
      audioStoreState.setSettings({ sampleRate: bridgeSampleRate });
    }

    const handleConnected = (data: { version: string; driverType: string }) => {
      console.log('[useNativeBridge] Connected event received:', data);
      const s = useBridgeAudioStore.getState();
      s.setConnected(true);
      s.setDriverType(data.driverType);
      s.setError(null);
      // Request devices when connected
      console.log('[useNativeBridge] Requesting devices...');
      nativeBridge.getDevices();
    };

    const handleDisconnected = () => {
      console.log('[useNativeBridge] Disconnected');
      const s = useBridgeAudioStore.getState();
      s.setConnected(false);
      s.setRunning(false);
      s.setDriverType(null);
      s.setDevices([], []);
    };

    const handleAudioStatus = (data: {
      isRunning: boolean;
      inputLatencyMs: number;
      outputLatencyMs: number;
      totalLatencyMs: number;
    }) => {
      console.log('[useNativeBridge] Audio status:', data);
      const s = useBridgeAudioStore.getState();
      s.setRunning(data.isRunning);
      s.setLatency({
        input: data.inputLatencyMs,
        output: data.outputLatencyMs,
        total: data.totalLatencyMs,
      });
      if (data.isRunning) {
        s.setError(null);
      }
    };

    const handleDevices = (data: { inputs: BridgeDevice[]; outputs: BridgeDevice[] }) => {
      console.log('[useNativeBridge] Devices received:', data);
      const s = useBridgeAudioStore.getState();
      s.setDevices(data.inputs, data.outputs);
    };

    const handleError = (data: { code: string; message: string }) => {
      console.error('[useNativeBridge] Error:', data);
      const s = useBridgeAudioStore.getState();
      s.setError(data);
    };

    // Handle device config confirmation from native bridge - sync actual values back to store
    const handleDeviceConfig = (data: {
      inputDevice: BridgeDevice | null;
      outputDevice: BridgeDevice | null;
      sampleRate: number;
      bufferSize: number;
      channelConfig: { channelCount: 1 | 2; leftChannel: number; rightChannel?: number };
    }) => {
      console.log('[useNativeBridge] DeviceConfig confirmed:', data.sampleRate, 'Hz,', data.bufferSize, 'samples');
      const s = useBridgeAudioStore.getState();
      // Update store with actual values from native bridge
      s.setSampleRate(data.sampleRate as 44100 | 48000);
      s.setBufferSize(data.bufferSize as 32 | 64 | 128 | 256 | 512 | 1024);
    };

    // Handle audio levels from native bridge - update track levels for waveform display
    const handleLevels = (data: {
      inputLevel: number;
      inputPeak: number;
      outputLevel: number;
      outputPeak: number;
      remoteLevels: [string, number][];
      trackLevels?: Array<{ trackId: string; level: number; peak: number }>;
    }) => {
      useBridgeAudioStore.getState().setInputLevels(data.inputLevel, data.inputPeak);

      const roomState = useRoomStore.getState();
      const currentUserId = roomState.currentUser?.id;

      if (currentUserId) {
        const tracksState = useUserTracksStore.getState();

        // Update per-track levels
        if (data.trackLevels && data.trackLevels.length > 0) {
          for (const trackLevel of data.trackLevels) {
            tracksState.setTrackLevel(trackLevel.trackId, trackLevel.level);
          }
        } else {
          // Fallback: distribute global level to all user tracks
          const userTracks = tracksState.getTracksByUser(currentUserId);
          for (const track of userTracks) {
            tracksState.setTrackLevel(track.id, data.inputLevel);
          }
        }

        roomState.setAudioLevel('local', data.inputLevel);
      }

      useAudioStore.getState().setLocalLevel(data.inputLevel);
    };

    // Register all event listeners (except audioData which uses stable module-level handler)
    nativeBridge.on('connected', handleConnected);
    nativeBridge.on('disconnected', handleDisconnected);
    nativeBridge.on('audioStatus', handleAudioStatus);
    nativeBridge.on('devices', handleDevices);
    nativeBridge.on('deviceConfig', handleDeviceConfig);
    nativeBridge.on('error', handleError);
    nativeBridge.on('levels', handleLevels);

    // CRITICAL: Use stable module-level handler for audioData
    // This handler is registered ONCE and never unregistered, preventing audio
    // interruption when React effects re-run (Strict Mode, Fast Refresh, etc.)
    ensureAudioHandlerRegistered();

    console.log('[useNativeBridge] Event listeners registered, checking availability...');

    // Check if bridge is available - the 'connected' event handler will request devices
    const checkAvailability = async () => {
      try {
        const connected = await nativeBridge.connect();
        console.log('[useNativeBridge] Connection result:', connected);
        // Note: Don't call getDevices() here - handleConnected will do it when 'connected' event fires
      } catch (err) {
        console.error('[useNativeBridge] Connection error:', err);
      } finally {
        setHasCheckedAvailability(true);
      }
    };

    checkAvailability();

    return () => {
      // Unregister effect-local handlers
      // NOTE: audioData handler is NOT unregistered here - it's a stable module-level
      // handler that persists to prevent audio interruption during React effect re-runs
      nativeBridge.off('connected', handleConnected);
      nativeBridge.off('disconnected', handleDisconnected);
      nativeBridge.off('audioStatus', handleAudioStatus);
      nativeBridge.off('devices', handleDevices);
      nativeBridge.off('deviceConfig', handleDeviceConfig);
      nativeBridge.off('error', handleError);
      nativeBridge.off('levels', handleLevels);
      initialized.current = false;
    };
  }, []); // Empty dependency array - run once

  // Auto-start native bridge when room is connected and bridge is preferred
  // This ensures users don't have to manually start audio after joining a room
  // DISABLED: This was causing issues by trying to start without an ASIO device selected
  // Users must manually start audio from settings after selecting their device
  /*
  useEffect(() => {
    // Subscribe to room store for connection changes
    const unsubscribeRoom = useRoomStore.subscribe((roomState) => {
      const bridgeState = useBridgeAudioStore.getState();

      // Check if we should auto-start: room connected + bridge connected + bridge preferred + not already running + device selected
      if (
        roomState.isConnected &&
        bridgeState.isConnected &&
        bridgeState.preferNativeBridge &&
        !bridgeState.isRunning &&
        bridgeState.inputDevice // Must have a device selected
      ) {
        console.log('[useNativeBridge] Room connected with bridge preferred, auto-starting audio...');
        // Use a small delay to ensure all other initialization has completed
        setTimeout(async () => {
          // Re-check conditions in case they changed
          const latestBridge = useBridgeAudioStore.getState();
          const latestRoom = useRoomStore.getState();
          if (
            latestRoom.isConnected &&
            latestBridge.isConnected &&
            latestBridge.preferNativeBridge &&
            !latestBridge.isRunning &&
            latestBridge.inputDevice &&
            startAudioRef.current
          ) {
            console.log('[useNativeBridge] Executing auto-start via ref...');
            try {
              await startAudioRef.current();
            } catch (err) {
              console.error('[useNativeBridge] Auto-start failed:', err);
            }
          }
        }, 500);
      }
    });

    return () => {
      unsubscribeRoom();
    };
  }, []);
  */

  // Connect to bridge
  const connect = useCallback(async () => {
    console.log('[useNativeBridge] Manual connect requested');
    const connected = await nativeBridge.connect();
    console.log('[useNativeBridge] Manual connect result:', connected);
    // Note: Don't manually update store or call getDevices here
    // The 'connected' event handler (handleConnected) will do this
    return connected;
  }, []);

  // Disconnect from bridge
  const disconnect = useCallback(() => {
    console.log('[useNativeBridge] Disconnecting...');
    nativeBridge.disconnect();
    const store = useBridgeAudioStore.getState();
    store.setConnected(false);
    store.setRunning(false);
    store.setDriverType(null);
    store.setDevices([], []);
  }, []);

  // Launch native app with room context
  const launch = useCallback((roomId: string, userId: string, token: string) => {
    launchNativeBridge(roomId, userId, token);
    setTimeout(async () => {
      await connect();
    }, 2000);
  }, [connect]);

  // Get download URL
  const getDownloadUrl = useCallback(() => {
    return getNativeBridgeDownloadUrl();
  }, []);

  // Configure and start audio
  const startAudio = useCallback(async () => {
    const state = useBridgeAudioStore.getState();
    if (!state.isConnected) {
      console.warn('[useNativeBridge] Cannot start audio - not connected');
      return;
    }

    // Pre-cache audio engine reference for zero-latency access in audio callbacks
    // This MUST happen before audio starts flowing
    if (!ensureAudioEngineReady()) {
      console.warn('[useNativeBridge] Audio engine not ready, initializing...');

      // Import and initialize the audio engine dynamically
      // This ensures the engine exists before we try to use it
      try {
        const { AudioEngine } = await import('@/lib/audio/audio-engine');
        const engine = new AudioEngine({
          sampleRate: state.sampleRate,
          bufferSize: state.bufferSize,
          autoJitterBuffer: true,
          enableProcessing: true,
        });
        await engine.initialize();

        // Expose on window for the native bridge audio handler
        if (typeof window !== 'undefined') {
          (window as any).__openStudioAudioEngine = engine;
        }

        console.log('[useNativeBridge] Audio engine initialized successfully');
        ensureAudioEngineReady();
      } catch (err) {
        console.error('[useNativeBridge] Failed to initialize audio engine:', err);
        return; // Don't proceed without engine
      }
    }

    // For ASIO, use same device for input and output
    // If input not set or different from output, use output device for both
    const deviceId = state.selectedOutputDeviceId;

    console.log('[useNativeBridge] Starting audio with config:', {
      device: deviceId,
      bufferSize: state.bufferSize,
      sampleRate: state.sampleRate,
      channelConfig: state.inputChannelConfig,
      engineCached: !!cachedAudioEngine,
    });

    // Ensure AudioContext sample rate matches the user's selection
    // If they differ, recreate the AudioContext with the correct rate
    if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine) {
      const engine = (window as any).__openStudioAudioEngine;
      const audioCtx = engine.getAudioContext?.();
      if (audioCtx?.sampleRate && audioCtx.sampleRate !== state.sampleRate) {
        console.log(`[useNativeBridge] AudioContext rate (${audioCtx.sampleRate}) differs from UI (${state.sampleRate}). Changing to match.`);
        await engine.changeSampleRate(state.sampleRate);
        // Re-cache engine after sample rate change (context was recreated)
        ensureAudioEngineReady();
      }
    }

    // Get track info BEFORE starting audio to determine channel config
    const roomState = useRoomStore.getState();
    const currentUserId = roomState.currentUser?.id;
    const tracksState = currentUserId ? useUserTracksStore.getState() : null;
    const userTracks = tracksState && currentUserId ? tracksState.getTracksByUser(currentUserId) : [];
    const primaryTrack = userTracks.length > 0 ? userTracks[0] : null;

    // Determine channel config - use primary track's config if available, otherwise global
    const channelConfigToUse = primaryTrack?.audioSettings.channelConfig || state.inputChannelConfig;

    // CRITICAL FIX: Set up track processors BEFORE starting native audio
    // This prevents the race condition where audio arrives before processors are ready
    // which caused "audio for ~0.5s then silence" symptoms
    console.log('[useNativeBridge] Setting up track processors BEFORE starting native audio...');

    // Set isRunning = true early so useTrackAudioSync sees bridge mode
    useBridgeAudioStore.getState().setRunning(true);

    // Set up all track processors in the browser audio engine FIRST
    for (const track of userTracks) {
      if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine) {
        const engine = (window as any).__openStudioAudioEngine;
        engine.getOrCreateTrackProcessor(track.id, track.audioSettings);

        // Set track state BEFORE enabling audio input
        const directMonitoring = track.audioSettings.directMonitoring ?? true;
        engine.updateTrackState(track.id, {
          isArmed: track.isArmed,
          isMuted: track.isMuted,
          isSolo: track.isSolo,
          volume: track.volume,
          inputGain: track.audioSettings.inputGain || 0,
          monitoringEnabled: !directMonitoring, // Invert: WET when direct is OFF
        });

        if (track.audioSettings.effects) {
          engine.updateTrackEffects(track.id, track.audioSettings.effects);
        }

        // Set up bridge input - creates the AudioWorklet that receives audio
        const channelConfig = track.audioSettings.channelConfig || state.inputChannelConfig;
        await engine.setTrackBridgeInput(track.id, {
          channelConfig,
          asioBufferSize: state.bufferSize,
        });

        console.log(`[useNativeBridge] Track processor ready: ${track.id}`);
      }
    }

    console.log('[useNativeBridge] All track processors ready, starting native audio...');

    // NOW configure and start native bridge (after processors are ready)
    if (deviceId) {
      nativeBridge.setInputDevice(deviceId);
      nativeBridge.setOutputDevice(deviceId);
    }

    nativeBridge.setBufferSize(state.bufferSize);
    nativeBridge.setSampleRate(state.sampleRate);
    // Use forceSetChannelConfig on startup to ensure config is always sent
    // (setChannelConfig might skip if it thinks config is unchanged)
    nativeBridge.forceSetChannelConfig(channelConfigToUse);
    console.log('[useNativeBridge] Channel config sent:', channelConfigToUse);

    // Send track state AND effects to native bridge for direct monitoring
    if (currentUserId && primaryTrack) {
      const panValue = primaryTrack.pan ?? 0;
      console.log('[useNativeBridge] Sending track state with pan:', panValue);
      nativeBridge.updateTrackState(primaryTrack.id, {
        isArmed: primaryTrack.isArmed,
        isMuted: primaryTrack.isMuted,
        isSolo: primaryTrack.isSolo,
        volume: primaryTrack.volume,
        pan: panValue,
        inputGainDb: primaryTrack.audioSettings.inputGain || 0,
        monitoringEnabled: primaryTrack.audioSettings.directMonitoring ?? true,
        monitoringVolume: primaryTrack.audioSettings.monitoringVolume ?? 1,
      });

      // Send effects to native bridge on startup
      if (primaryTrack.audioSettings.effects) {
        console.log('[useNativeBridge] Sending initial effects to native bridge');
        nativeBridge.updateEffects(primaryTrack.id, primaryTrack.audioSettings.effects);
      }
    }

    // Start audio - processors are already ready to receive it
    nativeBridge.startAudio();

    // Small delay to ensure native bridge is fully initialized
    await new Promise(resolve => setTimeout(resolve, 30));

    // Final state resync to catch any updates during setup
    if (currentUserId) {
      const latestTracksState = useUserTracksStore.getState();
      const latestUserTracks = latestTracksState.getTracksByUser(currentUserId);
      const engine = typeof window !== 'undefined' && (window as any).__openStudioAudioEngine;

      if (engine) {
        for (const track of latestUserTracks) {
          const directMonitoring = track.audioSettings.directMonitoring ?? true;
          engine.updateTrackState(track.id, {
            isArmed: track.isArmed,
            isMuted: track.isMuted,
            isSolo: track.isSolo,
            volume: track.volume,
            inputGain: track.audioSettings.inputGain || 0,
            monitoringEnabled: !directMonitoring,
          });

          nativeBridge.updateTrackState(track.id, {
            isArmed: track.isArmed,
            isMuted: track.isMuted,
            isSolo: track.isSolo,
            volume: track.volume,
            pan: track.pan ?? 0,
            inputGainDb: track.audioSettings.inputGain || 0,
            monitoringEnabled: directMonitoring,
            monitoringVolume: track.audioSettings.monitoringVolume ?? 1,
          });
        }
        console.log('[useNativeBridge] Audio started with', latestUserTracks.length, 'tracks ready');
      }
    }
  }, []);

  // Update ref whenever startAudio changes (for auto-start feature)
  useEffect(() => {
    startAudioRef.current = startAudio;
  }, [startAudio]);

  // Stop audio
  const stopAudio = useCallback(() => {
    const state = useBridgeAudioStore.getState();
    if (state.isConnected) {
      console.log('[useNativeBridge] Stopping audio');
      nativeBridge.stopAudio();
    }

    // Set isRunning to false immediately (audioStatus callback will confirm)
    useBridgeAudioStore.getState().setRunning(false);

    // Disable bridge audio mode in the audio engine
    if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine) {
      console.log('[useNativeBridge] Disabling bridge audio mode in audio engine');
      (window as any).__openStudioAudioEngine.disableBridgeAudio();
    }
  }, []);

  // Refresh devices
  const refreshDevices = useCallback(() => {
    const state = useBridgeAudioStore.getState();
    if (state.isConnected) {
      console.log('[useNativeBridge] Refreshing devices');
      nativeBridge.getDevices();
    } else {
      console.warn('[useNativeBridge] Cannot refresh devices - not connected');
    }
  }, []);

  // Set input device
  const setInputDevice = useCallback((deviceId: string) => {
    console.log('[useNativeBridge] Setting input device:', deviceId);
    const store = useBridgeAudioStore.getState();
    store.setSelectedInputDevice(deviceId);
    if (store.isConnected) {
      nativeBridge.setInputDevice(deviceId);
    }
  }, []);

  // Set output device
  const setOutputDevice = useCallback((deviceId: string) => {
    console.log('[useNativeBridge] Setting output device:', deviceId);
    const store = useBridgeAudioStore.getState();
    store.setSelectedOutputDevice(deviceId);
    if (store.isConnected) {
      nativeBridge.setOutputDevice(deviceId);
    }
  }, []);

  // Set buffer size
  const setBufferSize = useCallback((size: 32 | 64 | 128 | 256 | 512 | 1024) => {
    const store = useBridgeAudioStore.getState();
    store.setBufferSize(size);
    if (store.isConnected) {
      nativeBridge.setBufferSize(size);
    }
  }, []);

  // Set sample rate - this changes BOTH AudioContext and native bridge
  // Also syncs audio-store to keep all sample rate settings consistent
  const setSampleRate = useCallback(async (rate: 44100 | 48000) => {
    const store = useBridgeAudioStore.getState();
    const wasRunning = store.isRunning;
    store.setSampleRate(rate);

    // Also update audio-store to keep sample rates in sync across all stores
    // This ensures any future AudioEngine initialization uses the correct rate
    useAudioStore.getState().setSettings({ sampleRate: rate });

    // If bridge is running, stop it first before changing sample rate
    // The native bridge needs a full stop/start cycle to apply sample rate changes
    if (store.isConnected && wasRunning) {
      console.log('[useNativeBridge] Stopping bridge audio before sample rate change');
      nativeBridge.stopAudio();
      // Give the native bridge time to stop cleanly
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Change the AudioContext sample rate (recreates it)
    if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine) {
      console.log('[useNativeBridge] Changing AudioContext sample rate to', rate);
      await (window as any).__openStudioAudioEngine.changeSampleRate(rate);
      // Re-cache engine reference after context recreation
      ensureAudioEngineReady();
    }

    // Update native bridge sample rate
    if (store.isConnected) {
      console.log('[useNativeBridge] Setting native bridge sample rate to', rate);
      nativeBridge.setSampleRate(rate);

      // If bridge was running, restart it with new rate
      if (wasRunning) {
        console.log('[useNativeBridge] Restarting bridge audio with new sample rate');

        // Small delay to ensure sample rate is applied
        await new Promise(resolve => setTimeout(resolve, 50));

        // Restart audio on native bridge
        nativeBridge.startAudio();

        // Wait for audio to start
        await new Promise(resolve => setTimeout(resolve, 100));

        // Note: We don't need to call enableBridgeAudio() here because
        // changeSampleRate() already re-enabled it with the new AudioContext.
        // Calling it again would clear the audio buffer.

        // Re-sync track state after the audio engine was recreated
        const roomState = useRoomStore.getState();
        const currentUserId = roomState.currentUser?.id;
        if (currentUserId) {
          const tracksState = useUserTracksStore.getState();
          const userTracks = tracksState.getTracksByUser(currentUserId);

          for (const track of userTracks) {
            nativeBridge.updateTrackState(track.id, {
              isArmed: track.isArmed,
              isMuted: track.isMuted,
              isSolo: track.isSolo,
              volume: track.volume,
              pan: track.pan ?? 0,
              inputGainDb: track.audioSettings.inputGain || 0,
              monitoringEnabled: track.audioSettings.directMonitoring ?? true,
              monitoringVolume: track.audioSettings.monitoringVolume ?? 1,
            });

            // Note: Channel config is handled globally via setChannelConfig() for native bridge
            // Multi-track routing is done in the browser, not the native bridge

            const engine = (window as any).__openStudioAudioEngine;
            if (engine) {
              engine.getOrCreateTrackProcessor(track.id, track.audioSettings);

              // Set track state BEFORE enabling audio input
              // For bridge mode: JS monitors WET audio when directMonitoring is OFF
              // (Native bridge handles DRY monitoring when directMonitoring is ON)
              const directMonitoring = track.audioSettings.directMonitoring ?? true;
              engine.updateTrackState(track.id, {
                isArmed: track.isArmed,
                isMuted: track.isMuted,
                isSolo: track.isSolo,
                volume: track.volume,
                inputGain: track.audioSettings.inputGain || 0,
                monitoringEnabled: !directMonitoring, // Invert: WET when direct is OFF
              });

              if (track.audioSettings.effects) {
                engine.updateTrackEffects(track.id, track.audioSettings.effects);
              }

              // CRITICAL: Re-establish bridge input after AudioContext was recreated
              // The track processor was recreated with no audio input
              const channelConfig = track.audioSettings.channelConfig || store.inputChannelConfig;
              await engine.setTrackBridgeInput(track.id, {
                channelConfig,
                asioBufferSize: store.bufferSize,
              });
              console.log(`[useNativeBridge] Re-established bridge input for track ${track.id} after sample rate change`);
            }
          }
        }
      }
    }
  }, []);

  // Set channel config
  const setChannelConfig = useCallback((config: { channelCount: 1 | 2; leftChannel: number; rightChannel?: number }) => {
    const store = useBridgeAudioStore.getState();
    store.setInputChannelConfig(config);
    if (store.isConnected) {
      nativeBridge.setChannelConfig(config);
    }
  }, []);

  return {
    // Connection state (reactive from store)
    // isAvailable: null = still checking, true = connected, false = not available
    isAvailable: !hasCheckedAvailability ? null : storeState.isConnected,
    isConnected: storeState.isConnected,
    driverType: storeState.driverType,

    // Audio state
    isRunning: storeState.isRunning,
    latency: storeState.latency,

    // Devices
    inputDevices: storeState.inputDevices,
    outputDevices: storeState.outputDevices,
    selectedInputDeviceId: storeState.selectedInputDeviceId,
    selectedOutputDeviceId: storeState.selectedOutputDeviceId,
    getSelectedInputDevice: storeState.getSelectedInputDevice,
    getSelectedOutputDevice: storeState.getSelectedOutputDevice,

    // Settings
    bufferSize: storeState.bufferSize,
    sampleRate: storeState.sampleRate,
    inputChannelConfig: storeState.inputChannelConfig,
    preferNativeBridge: storeState.preferNativeBridge,
    networkMode: storeState.networkMode,

    // Error
    lastError: storeState.lastError,

    // Bridge instance
    bridge: nativeBridge,

    // Actions
    connect,
    disconnect,
    launch,
    getDownloadUrl,
    startAudio,
    stopAudio,
    refreshDevices,
    setInputDevice,
    setOutputDevice,
    setBufferSize,
    setSampleRate,
    setChannelConfig,
    setPreferNativeBridge: storeState.setPreferNativeBridge,
    setNetworkMode: storeState.setNetworkMode,
  };
}
