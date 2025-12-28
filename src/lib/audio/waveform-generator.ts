// Waveform Generator - Generates waveform data from audio files
// Used for displaying waveforms in the timeline

// Cache for waveform data by URL
const waveformCache = new Map<string, number[]>();

/**
 * Generate waveform data from an audio buffer
 * @param audioBuffer The decoded audio buffer
 * @param numBars Number of bars/samples to generate
 * @returns Normalized array of amplitude values (0-1)
 */
export function extractWaveformFromBuffer(audioBuffer: AudioBuffer, numBars: number = 200): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const samplesPerBar = Math.floor(channelData.length / numBars);
  const waveform: number[] = [];

  for (let i = 0; i < numBars; i++) {
    let sum = 0;
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, channelData.length);

    for (let j = start; j < end; j++) {
      sum += Math.abs(channelData[j]);
    }
    waveform.push(sum / (end - start));
  }

  // Normalize to 0-1 range
  const max = Math.max(...waveform);
  if (max === 0) return waveform.map(() => 0.5);

  return waveform.map((v) => Math.max(0.1, v / max));
}

/**
 * Generate waveform data from an audio URL
 * Uses caching to avoid re-fetching/re-processing
 * @param url The audio file URL
 * @param numBars Number of bars/samples to generate (default 200)
 * @returns Promise resolving to normalized amplitude array (0-1)
 */
export async function generateWaveformFromUrl(url: string, numBars: number = 200): Promise<number[]> {
  // Check cache first
  const cacheKey = `${url}:${numBars}`;
  const cached = waveformCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Fetch the audio file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // Decode the audio
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Extract waveform
    const waveform = extractWaveformFromBuffer(audioBuffer, numBars);

    // Close the audio context (we just needed it for decoding)
    await audioContext.close();

    // Cache the result
    waveformCache.set(cacheKey, waveform);

    return waveform;
  } catch (error) {
    console.error('[WaveformGenerator] Failed to generate waveform:', error);
    // Return empty placeholder on error
    return [];
  }
}

/**
 * Clear the waveform cache
 */
export function clearWaveformCache(): void {
  waveformCache.clear();
}

/**
 * Pre-generate waveforms for multiple URLs in parallel
 * @param urls Array of audio URLs
 * @param numBars Number of bars/samples per waveform
 * @returns Promise resolving to Map of URL -> waveform data
 */
export async function batchGenerateWaveforms(
  urls: string[],
  numBars: number = 200
): Promise<Map<string, number[]>> {
  const results = new Map<string, number[]>();

  // Generate all waveforms in parallel
  const promises = urls.map(async (url) => {
    const waveform = await generateWaveformFromUrl(url, numBars);
    results.set(url, waveform);
  });

  await Promise.allSettled(promises);
  return results;
}
