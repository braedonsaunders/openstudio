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

// Tuner state for temporal smoothing
let tunerPitchBuffer = [];
let lastStablePitch = null;
let lastStableNote = null;
let tunerMode = false;
const TUNER_BUFFER_SIZE = 5;
const TUNER_STABILITY_THRESHOLD = 3; // Hz variance for stable reading

// Standard guitar tuning frequencies (for reference detection)
const GUITAR_NOTES = {
  'E2': 82.41,
  'A2': 110.00,
  'D3': 146.83,
  'G3': 196.00,
  'B3': 246.94,
  'E4': 329.63,
};

function frequencyToNote(frequency) {
  if (frequency <= 0) return null;
  const A4 = 440;
  const semitonesFromA4 = 12 * Math.log2(frequency / A4);
  const roundedSemitones = Math.round(semitonesFromA4);
  const cents = Math.round((semitonesFromA4 - roundedSemitones) * 100);
  const noteIndex = ((roundedSemitones % 12) + 12 + 9) % 12;
  const octave = 4 + Math.floor((roundedSemitones + 9) / 12);
  return {
    note: `${NOTE_NAMES[noteIndex]}${octave}`,
    noteName: NOTE_NAMES[noteIndex],
    octave,
    cents,
    frequency
  };
}

// Autocorrelation-based pitch detection for more accurate guitar tuning
function detectPitchAutocorrelation(audioData, sampleRate) {
  const SIZE = audioData.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);

  // Find the RMS of the signal - skip if too quiet
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += audioData[i] * audioData[i];
  }
  rms = Math.sqrt(rms / SIZE);

  if (rms < 0.01) return null; // Too quiet

  // Autocorrelation
  const correlations = new Float32Array(MAX_SAMPLES);
  for (let lag = 0; lag < MAX_SAMPLES; lag++) {
    let sum = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      sum += audioData[i] * audioData[i + lag];
    }
    correlations[lag] = sum;
  }

  // Find the first peak after the initial correlation
  // Skip the first few samples (corresponds to very high frequencies)
  const minLag = Math.floor(sampleRate / 1000); // 1000 Hz max
  const maxLag = Math.floor(sampleRate / 50);   // 50 Hz min

  let bestLag = -1;
  let bestCorr = 0;
  let foundFirstDip = false;

  for (let lag = minLag; lag < maxLag && lag < MAX_SAMPLES; lag++) {
    // Look for first dip then first peak
    if (!foundFirstDip && correlations[lag] < correlations[lag - 1]) {
      foundFirstDip = true;
    }

    if (foundFirstDip && correlations[lag] > bestCorr) {
      bestCorr = correlations[lag];
      bestLag = lag;
    }

    // If we found a good peak and correlation starts dropping, stop
    if (foundFirstDip && bestLag > 0 && correlations[lag] < bestCorr * 0.9) {
      break;
    }
  }

  if (bestLag <= 0) return null;

  // Parabolic interpolation for sub-sample accuracy
  const y0 = correlations[bestLag - 1];
  const y1 = correlations[bestLag];
  const y2 = correlations[bestLag + 1];

  const interpolatedLag = bestLag + (y0 - y2) / (2 * (y0 - 2 * y1 + y2));

  if (interpolatedLag <= 0 || !isFinite(interpolatedLag)) return null;

  const frequency = sampleRate / interpolatedLag;

  // Confidence based on correlation strength
  const confidence = bestCorr / correlations[0];

  return { frequency, confidence };
}

// Smooth tuner readings for stable display
function smoothTunerReading(pitch, confidence) {
  if (!pitch || confidence < 0.7) {
    // Reset buffer if signal is weak
    if (tunerPitchBuffer.length > 0) {
      tunerPitchBuffer = [];
    }
    return lastStablePitch ? { pitch: lastStablePitch, note: lastStableNote, isStable: false } : null;
  }

  tunerPitchBuffer.push(pitch);
  if (tunerPitchBuffer.length > TUNER_BUFFER_SIZE) {
    tunerPitchBuffer.shift();
  }

  if (tunerPitchBuffer.length < 3) {
    return null; // Need more samples
  }

  // Calculate median pitch (more robust than mean)
  const sorted = [...tunerPitchBuffer].sort((a, b) => a - b);
  const medianPitch = sorted[Math.floor(sorted.length / 2)];

  // Check stability (variance)
  const variance = tunerPitchBuffer.reduce((acc, p) => acc + Math.pow(p - medianPitch, 2), 0) / tunerPitchBuffer.length;
  const isStable = Math.sqrt(variance) < TUNER_STABILITY_THRESHOLD;

  if (isStable) {
    lastStablePitch = medianPitch;
    lastStableNote = frequencyToNote(medianPitch);
  }

  return { pitch: medianPitch, note: frequencyToNote(medianPitch), isStable };
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

    // Pitch detection for tuner
    // Use dual approach: autocorrelation for guitar tuning stability, Essentia as fallback
    let tunerNote = null;
    let tunerFrequency = null;
    let tunerCents = null;
    let tunerIsStable = false;

    try {
      // First try autocorrelation (better for monophonic guitar signals)
      const autoResult = detectPitchAutocorrelation(audioData, sampleRate);

      let detectedPitch = null;
      let pitchConfidence = 0;

      if (autoResult && autoResult.frequency > 50 && autoResult.frequency < 1200) {
        detectedPitch = autoResult.frequency;
        pitchConfidence = autoResult.confidence;
      } else {
        // Fallback to Essentia PitchYinFFT
        const pitchResult = essentia.PitchYinFFT(essentiaFrame, frameSize, sampleRate);
        if (pitchResult.pitch > 50 && pitchResult.pitch < 1200 && pitchResult.pitchConfidence > 0.6) {
          detectedPitch = pitchResult.pitch;
          pitchConfidence = pitchResult.pitchConfidence;
        }
      }

      // Apply smoothing for stable tuner display
      if (detectedPitch) {
        const smoothed = smoothTunerReading(detectedPitch, pitchConfidence);
        if (smoothed && smoothed.note) {
          tunerFrequency = smoothed.pitch;
          tunerNote = smoothed.note.note;
          tunerCents = smoothed.note.cents;
          tunerIsStable = smoothed.isStable;
        }
      }
    } catch (e) {
      // Pitch detection failed, ignore
    }

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

    // Energy estimation using spectral energy relative to RMS
    // This gives a measure of spectral brightness/fullness
    let energy = 0;
    try {
      // Use RMS-based energy with perceptual scaling
      // RMS values typically range from 0.001 (silence) to 0.5+ (loud)
      if (rms > 0.001) {
        // Apply logarithmic compression for perceptual scaling
        // Map typical RMS range [0.001, 0.5] to [0, 1]
        const rmsDb = 20 * Math.log10(rms);
        // Typical music RMS is around -20dB to -6dB
        // Map [-40dB, -6dB] to [0, 1]
        energy = Math.max(0, Math.min(1, (rmsDb + 40) / 34));
      }
    } catch (e) {}

    // Calculate loudness with logarithmic scaling for better visual response
    // RMS of 0.001 (-60dB) = 0%, RMS of 1.0 (0dB) = 100%
    let loudness = 0;
    if (rms > 0.0001) {
      const rmsDb = 20 * Math.log10(rms);
      // Map [-60dB, 0dB] to [0, 100] with slight boost for typical levels
      loudness = Math.max(0, Math.min(100, ((rmsDb + 60) / 60) * 100));
    }

    return {
      rms,
      loudness,
      energy,
      spectralCentroid,
      tunerNote,
      tunerFrequency,
      tunerCents,
      tunerIsStable,
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

    // Key detection using KeyExtractor with multiple profile types for accuracy
    try {
      // Try multiple profile types and take consensus
      const profileTypes = ['krumhansl', 'temperley', 'edma'];
      const keyVotes = {};

      for (const profileType of profileTypes) {
        try {
          const keyResult = essentia.KeyExtractor(essentiaAudio, {
            profileType: profileType,
            frameSize: 4096,
            hopSize: 2048,
            sampleRate: sampleRate
          });

          if (keyResult.key && keyResult.strength > 0.3) {
            const keyId = `${keyResult.key}_${keyResult.scale}`;
            if (!keyVotes[keyId]) {
              keyVotes[keyId] = { count: 0, totalStrength: 0 };
            }
            keyVotes[keyId].count++;
            keyVotes[keyId].totalStrength += keyResult.strength;
          }
        } catch (e) {
          // Profile type not supported, skip
        }
      }

      // Find best consensus key
      let bestKeyId = null;
      let bestScore = 0;
      for (const [keyId, data] of Object.entries(keyVotes)) {
        // Score = count * average strength (rewards agreement between profiles)
        const score = data.count * (data.totalStrength / data.count);
        if (score > bestScore) {
          bestScore = score;
          bestKeyId = keyId;
        }
      }

      // Only accept if at least 2 profiles agree with decent strength
      if (bestKeyId && keyVotes[bestKeyId].count >= 2 && bestScore > 0.8) {
        const [detectedKey, detectedScale] = bestKeyId.split('_');
        const avgStrength = keyVotes[bestKeyId].totalStrength / keyVotes[bestKeyId].count;

        keyBuffer.push({ key: detectedKey, scale: detectedScale, strength: avgStrength });
        // Keep larger buffer for stability
        if (keyBuffer.length > 15) {
          keyBuffer.shift();
        }

        // Only update key if we have enough samples (at least 5)
        if (keyBuffer.length >= 5) {
          // Find most common key in buffer (weighted by strength)
          const keyCounts = {};
          keyBuffer.forEach(k => {
            const keyId = `${k.key}_${k.scale}`;
            keyCounts[keyId] = (keyCounts[keyId] || 0) + k.strength;
          });

          let bestKey = null;
          let bestKeyScore = 0;
          let secondBestScore = 0;
          for (const [keyId, score] of Object.entries(keyCounts)) {
            if (score > bestKeyScore) {
              secondBestScore = bestKeyScore;
              bestKeyScore = score;
              bestKey = keyId;
            } else if (score > secondBestScore) {
              secondBestScore = score;
            }
          }

          // Require significant margin (1.5x) and minimum occurrences
          const keyOccurrences = keyBuffer.filter(k => `${k.key}_${k.scale}` === bestKey).length;
          if (bestKey && bestKeyScore > secondBestScore * 1.5 && keyOccurrences >= 3) {
            const [key, scale] = bestKey.split('_');
            const newKeyId = `${key}_${scale}`;
            const currentKeyId = `${lastKey}_${lastKeyScale}`;

            // Apply hysteresis: require higher threshold to change existing key
            const changeThreshold = lastKey ? 1.8 : 1.5;

            if (newKeyId !== currentKeyId || !lastKey) {
              if (!lastKey || bestKeyScore > secondBestScore * changeThreshold) {
                lastKey = key;
                lastKeyScale = scale;
                lastKeyStrength = Math.min(bestKeyScore / keyBuffer.length, 1);
                console.log(`[Worker] Key detected: ${lastKey} ${lastKeyScale} (strength: ${lastKeyStrength.toFixed(2)}, occurrences: ${keyOccurrences})`);
              }
            }
          }
        }
      }
    } catch (e) {
      // Fallback to simple detection
      try {
        const keyResult = essentia.KeyExtractor(essentiaAudio);
        if (keyResult && keyResult.key && keyResult.strength > 0.5 && !lastKey) {
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
    // Essentia's Danceability returns values typically in range [0, 3]
    // We normalize to [0, 1] by dividing by 3 and clamping
    try {
      const danceResult = essentia.Danceability(essentiaAudio);
      if (danceResult && danceResult.danceability >= 0) {
        // Normalize: divide by typical max (~3) and clamp to [0, 1]
        lastDanceability = Math.min(1, Math.max(0, danceResult.danceability / 3));
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
  // Reset tuner state
  tunerPitchBuffer = [];
  lastStablePitch = null;
  lastStableNote = null;
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
