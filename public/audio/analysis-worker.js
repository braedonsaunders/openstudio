// Audio Analysis Web Worker
// Runs essentia.js analysis off the main thread for better performance

let essentia = null;
let essentiaWASM = null;
let isInitialized = false;
let sampleRate = 44100;

// Buffers for long-term analysis
let audioFrameBuffer = [];
let bpmBuffer = [];
let keyBuffer = [];
let lastBPM = null;
let lastKey = null;
let lastKeyScale = null;
let lastKeyStrength = 0;
let lastEnergy = 0;
let lastDanceability = 0;
let lastTuningFrequency = 440;

const FRAMES_FOR_KEY = 30; // ~3 seconds of audio for key detection
const FRAMES_FOR_BPM = 50; // ~5 seconds for BPM
const MAX_BUFFER_FRAMES = 100; // Store more frames for better long-term analysis

// Note names for tuner
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function frequencyToNote(frequency) {
  if (frequency <= 0) return null;
  const A4 = 440;
  const semitonesFromA4 = 12 * Math.log2(frequency / A4);
  const roundedSemitones = Math.round(semitonesFromA4);
  const cents = Math.round((semitonesFromA4 - roundedSemitones) * 100);
  const noteIndex = ((roundedSemitones % 12) + 12 + 9) % 12;
  const octave = 4 + Math.floor((roundedSemitones + 9) / 12);
  return { note: `${NOTE_NAMES[noteIndex]}${octave}`, cents };
}

// Initialize essentia.js
async function initialize(rate) {
  if (isInitialized) return true;

  sampleRate = rate || 44100;

  try {
    // Import essentia.js ES modules
    const wasmModule = await import('https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.es.js');
    const coreModule = await import('https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.es.js');

    const EssentiaWASM = wasmModule.default || wasmModule.EssentiaWASM || wasmModule;
    const Essentia = coreModule.default || coreModule.Essentia || coreModule;

    // Initialize WASM
    if (typeof EssentiaWASM === 'function') {
      essentiaWASM = await EssentiaWASM();
    } else {
      essentiaWASM = EssentiaWASM;
    }

    // Create Essentia instance
    if (typeof Essentia === 'function') {
      essentia = new Essentia(essentiaWASM);
    } else {
      essentia = Essentia;
    }

    isInitialized = true;
    console.log('[Worker] Essentia.js initialized');
    return true;
  } catch (error) {
    console.error('[Worker] Failed to initialize essentia.js:', error);
    return false;
  }
}

// Analyze a single audio frame (fast operations only)
function analyzeFrame(audioData, frameSize) {
  if (!essentia || !isInitialized) return null;

  try {
    const essentiaFrame = essentia.arrayToVector(audioData);

    // RMS (fast)
    const rms = essentia.RMS(essentiaFrame).rms;

    // Spectrum for HPCP (moderate cost)
    const spectrum = essentia.Spectrum(essentiaFrame, frameSize);

    // Spectral centroid (fast)
    let spectralCentroid = 0;
    try {
      spectralCentroid = essentia.SpectralCentroidTime(essentiaFrame).spectralCentroid || 0;
    } catch (e) {}

    // Pitch detection for tuner (moderate cost)
    let tunerNote = null;
    let tunerFrequency = null;
    let tunerCents = null;

    try {
      const pitchResult = essentia.PitchYinFFT(essentiaFrame, frameSize, sampleRate);
      if (pitchResult.pitch > 50 && pitchResult.pitch < 2000 && pitchResult.pitchConfidence > 0.7) {
        tunerFrequency = pitchResult.pitch;
        const noteInfo = frequencyToNote(pitchResult.pitch);
        if (noteInfo) {
          tunerNote = noteInfo.note;
          tunerCents = noteInfo.cents;
        }
      }
    } catch (e) {}

    // Chord detection from HPCP (moderate cost)
    let currentChord = null;
    let chordConfidence = 0;

    try {
      const hpcp = essentia.HPCP(
        spectrum.spectrum,
        essentia.arrayToVector(new Float32Array(spectrum.spectrum.length)),
        true, 500, 0, 4000, false, 0.5, true, sampleRate
      );
      const hpcpArray = essentia.vectorToArray(hpcp.hpcp);
      const chordResult = detectChordFromHPCP(hpcpArray);
      currentChord = chordResult.chord;
      chordConfidence = chordResult.confidence;
    } catch (e) {}

    // Energy estimation (spectral energy distribution)
    let energy = 0;
    try {
      const energyResult = essentia.Energy(essentiaFrame);
      energy = energyResult.energy || 0;
    } catch (e) {}

    return {
      rms,
      loudness: rms * 100,
      energy,
      spectralCentroid,
      tunerNote,
      tunerFrequency,
      tunerCents,
      currentChord,
      chordConfidence,
      key: lastKey,
      keyScale: lastKeyScale,
      keyConfidence: lastKeyStrength,
      bpm: lastBPM,
      bpmConfidence: lastBPM ? 0.8 : 0,
      danceability: lastDanceability,
      tuningFrequency: lastTuningFrequency,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[Worker] Frame analysis error:', error);
    return null;
  }
}

// Long-term analysis for key and BPM (expensive, run less often)
function analyzeLongTerm(combinedAudio) {
  if (!essentia || !isInitialized) return;

  try {
    const essentiaAudio = essentia.arrayToVector(combinedAudio);

    // Key detection using KeyExtractor (bundles Windowing -> Spectrum -> SpectralPeaks -> HPCP -> Key)
    try {
      // Use KeyExtractor with options object
      // profileType options: 'bgate' (default), 'edma'/'edmm' (electronic), 'gomez' (general), 'krumhansl', 'temperley'
      const keyResult = essentia.KeyExtractor(essentiaAudio, {
        profileType: 'edma', // Best for electronic/pop music
        frameSize: 4096,
        hopSize: 2048,
        sampleRate: sampleRate
      });

      if (keyResult.key && keyResult.strength > 0.4) {
        const detectedKey = keyResult.key;
        const detectedScale = keyResult.scale; // 'major' or 'minor'
        const strength = keyResult.strength;

        keyBuffer.push({ key: detectedKey, scale: detectedScale, strength });
        // Keep larger buffer for more stable detection
        if (keyBuffer.length > 10) {
          keyBuffer.shift();
        }

        // Only update key if we have enough samples
        if (keyBuffer.length >= 3) {
          // Find most common key in buffer (weighted by strength)
          const keyCounts = {};
          keyBuffer.forEach(k => {
            const keyId = `${k.key}_${k.scale}`;
            keyCounts[keyId] = (keyCounts[keyId] || 0) + k.strength;
          });

          let bestKey = null;
          let bestScore = 0;
          let secondBestScore = 0;
          for (const [keyId, score] of Object.entries(keyCounts)) {
            if (score > bestScore) {
              secondBestScore = bestScore;
              bestScore = score;
              bestKey = keyId;
            } else if (score > secondBestScore) {
              secondBestScore = score;
            }
          }

          // Only change key if it's significantly better than alternatives
          // and different from current key
          if (bestKey && bestScore > secondBestScore * 1.3) {
            const [key, scale] = bestKey.split('_');
            const newKeyId = `${key}_${scale}`;
            const currentKeyId = `${lastKey}_${lastKeyScale}`;

            // Only update if it's a new key or confidence improved significantly
            if (newKeyId !== currentKeyId || !lastKey) {
              lastKey = key;
              lastKeyScale = scale;
              lastKeyStrength = Math.min(bestScore / keyBuffer.length, 1);
              console.log(`[Worker] Key detected: ${lastKey} ${lastKeyScale} (strength: ${lastKeyStrength.toFixed(2)})`);
            }
          }
        }
      }
    } catch (e) {
      // Try with positional parameters if options object doesn't work
      try {
        // Some essentia.js versions use positional params
        const keyResult = essentia.KeyExtractor(essentiaAudio);
        if (keyResult && keyResult.key && keyResult.strength > 0.3) {
          lastKey = keyResult.key;
          lastKeyScale = keyResult.scale;
          lastKeyStrength = keyResult.strength;
          console.log(`[Worker] Key detected (fallback): ${lastKey} ${lastKeyScale}`);
        }
      } catch (e2) {
        console.warn('[Worker] Key detection failed:', e.message || e);
      }
    }

    // Tuning frequency detection (A=440Hz standard or other)
    try {
      const tuningResult = essentia.TuningFrequency(essentiaAudio);
      if (tuningResult && tuningResult.tuningFrequency && tuningResult.tuningFrequency > 400 && tuningResult.tuningFrequency < 480) {
        lastTuningFrequency = tuningResult.tuningFrequency;
        if (Math.abs(lastTuningFrequency - 440) > 2) {
          console.log(`[Worker] Tuning: ${lastTuningFrequency.toFixed(1)} Hz`);
        }
      }
    } catch (e) {
      // Tuning detection not critical
    }

    // Danceability estimation (based on rhythm regularity)
    try {
      const danceResult = essentia.Danceability(essentiaAudio);
      if (danceResult && danceResult.danceability >= 0) {
        lastDanceability = danceResult.danceability;
      }
    } catch (e) {
      // Danceability not critical, skip if fails
    }

    // BPM detection using PercivalBpmEstimator (more reliable) or RhythmExtractor2013
    try {
      // Try PercivalBpmEstimator first (recommended in docs)
      let bpm = null;
      try {
        const percivalResult = essentia.PercivalBpmEstimator(essentiaAudio);
        if (percivalResult && percivalResult.bpm > 40 && percivalResult.bpm < 240) {
          bpm = percivalResult.bpm;
        }
      } catch (e1) {
        // Fall back to RhythmExtractor2013
        const rhythmResult = essentia.RhythmExtractor2013(essentiaAudio);
        if (rhythmResult && rhythmResult.bpm > 40 && rhythmResult.bpm < 240) {
          bpm = rhythmResult.bpm;
        }
      }

      if (bpm) {
        bpmBuffer.push(bpm);
        // Keep larger buffer for stability
        if (bpmBuffer.length > 10) {
          bpmBuffer.shift();
        }

        // Only update BPM if we have enough samples
        if (bpmBuffer.length >= 3) {
          // Use median BPM for stability
          const sortedBPM = [...bpmBuffer].sort((a, b) => a - b);
          const medianBPM = sortedBPM[Math.floor(sortedBPM.length / 2)];

          // Calculate standard deviation to check consistency
          const mean = bpmBuffer.reduce((a, b) => a + b, 0) / bpmBuffer.length;
          const variance = bpmBuffer.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / bpmBuffer.length;
          const stdDev = Math.sqrt(variance);

          // Only update if readings are consistent (low std deviation)
          // and either no previous BPM or close to current
          if (stdDev < 10 && (!lastBPM || Math.abs(medianBPM - lastBPM) < 20)) {
            const newBPM = Math.round(medianBPM);
            if (newBPM !== lastBPM) {
              lastBPM = newBPM;
              console.log(`[Worker] BPM detected: ${lastBPM} (stdDev: ${stdDev.toFixed(1)})`);
            }
          }
        }
      }
    } catch (e) {
      console.error('[Worker] BPM detection error:', e.message || e);
    }

    // Memory cleanup - delete the vector to prevent WASM memory leaks
    try {
      essentia.deleteVector(essentiaAudio);
    } catch (e) {
      // deleteVector might not exist in all versions
    }
  } catch (error) {
    console.error('[Worker] Long-term analysis error:', error);
  }
}

// Chord detection from HPCP
function detectChordFromHPCP(hpcp) {
  if (!hpcp || hpcp.length !== 12) {
    return { chord: null, confidence: 0 };
  }

  const chordTemplates = {
    'C': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    'Cm': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
    'D': [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    'Dm': [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    'E': [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    'Em': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
    'F': [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    'Fm': [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    'G': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
    'Gm': [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    'A': [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    'Am': [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    'B': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
    'Bm': [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  };

  const maxHPCP = Math.max(...hpcp);
  const normHPCP = maxHPCP > 0 ? hpcp.map(v => v / maxHPCP) : hpcp;

  let bestChord = '';
  let bestScore = -1;

  for (const [chord, template] of Object.entries(chordTemplates)) {
    let score = 0;
    for (let i = 0; i < 12; i++) {
      score += normHPCP[i] * template[i];
    }
    if (score > bestScore) {
      bestScore = score;
      bestChord = chord;
    }
  }

  return {
    chord: bestScore > 0.5 ? bestChord : null,
    confidence: bestScore,
  };
}

// Reset analysis state
function reset() {
  audioFrameBuffer = [];
  bpmBuffer = [];
  keyBuffer = [];
  lastBPM = null;
  lastKey = null;
  lastKeyScale = null;
  lastKeyStrength = 0;
  lastEnergy = 0;
  lastDanceability = 0;
  lastTuningFrequency = 440;
}

// Handle messages from main thread
let frameCount = 0;
let lastLongTermAnalysis = 0;
const LONG_TERM_INTERVAL = 3000; // Run long-term analysis every 3 seconds for more stability

self.onmessage = async function(e) {
  const { type, data } = e.data;

  switch (type) {
    case 'init':
      const success = await initialize(data.sampleRate);
      self.postMessage({ type: 'initialized', success });
      break;

    case 'analyze':
      if (!isInitialized) {
        self.postMessage({ type: 'result', data: null });
        return;
      }

      const audioData = data.audioData;
      const frameSize = data.frameSize || 2048;

      // Add frame to buffer for long-term analysis
      audioFrameBuffer.push(new Float32Array(audioData));
      if (audioFrameBuffer.length > MAX_BUFFER_FRAMES) {
        audioFrameBuffer.shift();
      }

      // Fast frame analysis
      const frameResult = analyzeFrame(audioData, frameSize);

      // Long-term analysis (throttled)
      const now = Date.now();
      if (now - lastLongTermAnalysis > LONG_TERM_INTERVAL && audioFrameBuffer.length >= FRAMES_FOR_KEY) {
        lastLongTermAnalysis = now;

        // Combine frames
        const totalLength = audioFrameBuffer.reduce((sum, buf) => sum + buf.length, 0);
        const combinedAudio = new Float32Array(totalLength);
        let offset = 0;
        audioFrameBuffer.forEach(buf => {
          combinedAudio.set(buf, offset);
          offset += buf.length;
        });

        analyzeLongTerm(combinedAudio);

        // Update frame result with latest key/bpm
        if (frameResult) {
          frameResult.key = lastKey;
          frameResult.keyScale = lastKeyScale;
          frameResult.bpm = lastBPM;
        }
      }

      self.postMessage({ type: 'result', data: frameResult });
      break;

    case 'reset':
      reset();
      self.postMessage({ type: 'reset', success: true });
      break;

    case 'stop':
      reset();
      break;
  }
};
