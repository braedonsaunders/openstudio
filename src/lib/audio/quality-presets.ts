// Quality Presets for Audio Encoding and Latency Optimization
// World-class presets exceeding industry standards

import type { QualityPreset, QualityPresetName, OpusEncodingSettings } from '@/types';

/**
 * All available quality presets
 * Bitrates range from 24kbps (poor connection) to 510kbps (studio quality)
 */
export const QUALITY_PRESETS: Record<QualityPresetName, QualityPreset> = {
  'ultra-low-latency': {
    id: 'ultra-low-latency',
    name: 'Ultra Low Latency',
    description: 'Minimum latency for tight jamming. Requires excellent connection (<25ms RTT).',
    icon: '⚡',
    encoding: {
      bitrate: 128,
      frameSize: 10,
      complexity: 5,
      fec: false,      // FEC adds latency
      dtx: false,      // Keep consistent timing
      cbr: true,       // Predictable latency
      inbandFec: false,
      packetLossPercentage: 0,
    },
    jitterMode: 'live-jamming',
    lowLatencyMode: true,
    recommendedMaxRtt: 25,
  },

  'low-latency': {
    id: 'low-latency',
    name: 'Low Latency',
    description: 'Great for jamming with good quality. Recommended for most users.',
    icon: '🎸',
    encoding: {
      bitrate: 192,
      frameSize: 10,
      complexity: 7,
      fec: true,
      dtx: false,
      cbr: true,
      inbandFec: true,
      packetLossPercentage: 5,
    },
    jitterMode: 'live-jamming',
    lowLatencyMode: true,
    recommendedMaxRtt: 50,
  },

  'balanced': {
    id: 'balanced',
    name: 'Balanced',
    description: 'Good balance of quality and latency for general use.',
    icon: '⚖️',
    encoding: {
      bitrate: 256,
      frameSize: 10,
      complexity: 8,
      fec: true,
      dtx: false,
      cbr: true,
      inbandFec: true,
      packetLossPercentage: 10,
    },
    jitterMode: 'balanced',
    lowLatencyMode: false,
    recommendedMaxRtt: 80,
  },

  'high-quality': {
    id: 'high-quality',
    name: 'High Quality',
    description: 'Excellent audio quality. Slightly higher latency acceptable.',
    icon: '🎵',
    encoding: {
      bitrate: 320,
      frameSize: 20,
      complexity: 10,
      fec: true,
      dtx: false,
      cbr: false,
      inbandFec: true,
      packetLossPercentage: 10,
    },
    jitterMode: 'balanced',
    lowLatencyMode: false,
    recommendedMaxRtt: 100,
  },

  'studio-quality': {
    id: 'studio-quality',
    name: 'Studio Quality',
    description: 'Maximum audio fidelity at 510kbps. For recording and listening.',
    icon: '🎧',
    encoding: {
      bitrate: 510,
      frameSize: 20,
      complexity: 10,
      fec: true,
      dtx: false,
      cbr: false,
      inbandFec: true,
      packetLossPercentage: 5,
    },
    jitterMode: 'stable',
    lowLatencyMode: false,
    recommendedMaxRtt: 150,
  },

  'poor-connection': {
    id: 'poor-connection',
    name: 'Poor Connection',
    description: 'Optimized for unstable networks. Prioritizes stability over quality.',
    icon: '📶',
    encoding: {
      bitrate: 48,
      frameSize: 20,
      complexity: 5,
      fec: true,
      dtx: true,
      cbr: true,
      inbandFec: true,
      packetLossPercentage: 25,
    },
    jitterMode: 'stable',
    lowLatencyMode: false,
    recommendedMaxRtt: 200,
  },

  'custom': {
    id: 'custom',
    name: 'Custom',
    description: 'User-defined settings.',
    icon: '⚙️',
    encoding: {
      bitrate: 192,
      frameSize: 10,
      complexity: 7,
      fec: true,
      dtx: false,
      cbr: true,
      inbandFec: true,
      packetLossPercentage: 10,
    },
    jitterMode: 'balanced',
    lowLatencyMode: false,
    recommendedMaxRtt: 100,
  },
};

/**
 * Get recommended preset based on RTT
 */
export function getRecommendedPreset(rtt: number): QualityPresetName {
  if (rtt <= 25) return 'ultra-low-latency';
  if (rtt <= 50) return 'low-latency';
  if (rtt <= 80) return 'balanced';
  if (rtt <= 100) return 'high-quality';
  if (rtt <= 150) return 'studio-quality';
  return 'poor-connection';
}

/**
 * Get preset by name
 */
export function getPreset(name: QualityPresetName): QualityPreset {
  return QUALITY_PRESETS[name];
}

/**
 * Validate custom encoding settings
 */
export function validateEncodingSettings(settings: OpusEncodingSettings): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (settings.bitrate < 24 || settings.bitrate > 510) {
    errors.push('Bitrate must be between 24 and 510 kbps');
  }

  if (settings.frameSize !== 10 && settings.frameSize !== 20) {
    errors.push('Frame size must be 10 or 20 ms');
  }

  if (settings.complexity < 0 || settings.complexity > 10) {
    errors.push('Complexity must be between 0 and 10');
  }

  if (settings.packetLossPercentage < 0 || settings.packetLossPercentage > 100) {
    errors.push('Packet loss percentage must be between 0 and 100');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Estimate latency added by encoding settings
 */
export function estimateEncodingLatency(settings: OpusEncodingSettings): number {
  let latency = settings.frameSize; // Base frame size

  // FEC adds some processing time
  if (settings.fec) latency += 1;

  // Higher complexity adds minimal latency
  if (settings.complexity > 7) latency += 0.5;

  return latency;
}

/**
 * Calculate bandwidth usage in kbps
 */
export function calculateBandwidthUsage(settings: OpusEncodingSettings): number {
  // Base bitrate
  let bandwidth = settings.bitrate;

  // FEC adds ~10-50% overhead depending on loss rate
  if (settings.fec) {
    bandwidth *= 1 + (settings.packetLossPercentage / 100);
  }

  // Add overhead for RTP/UDP headers (~10%)
  bandwidth *= 1.1;

  return Math.round(bandwidth);
}

/**
 * Get all presets as array for UI
 */
export function getAllPresets(): QualityPreset[] {
  return Object.values(QUALITY_PRESETS).filter(p => p.id !== 'custom');
}

/**
 * Compare two presets
 */
export function comparePresets(
  a: QualityPresetName,
  b: QualityPresetName
): { latencyDiff: number; qualityDiff: number } {
  const presetA = QUALITY_PRESETS[a];
  const presetB = QUALITY_PRESETS[b];

  // Estimate latency difference (lower = better for latency)
  const latencyA = estimateEncodingLatency(presetA.encoding) +
    (presetA.jitterMode === 'live-jamming' ? 5 : presetA.jitterMode === 'balanced' ? 15 : 30);
  const latencyB = estimateEncodingLatency(presetB.encoding) +
    (presetB.jitterMode === 'live-jamming' ? 5 : presetB.jitterMode === 'balanced' ? 15 : 30);

  // Quality score based on bitrate and settings
  const qualityA = presetA.encoding.bitrate + (presetA.encoding.fec ? 20 : 0);
  const qualityB = presetB.encoding.bitrate + (presetB.encoding.fec ? 20 : 0);

  return {
    latencyDiff: latencyB - latencyA, // Positive = B has higher latency
    qualityDiff: qualityB - qualityA, // Positive = B has higher quality
  };
}
