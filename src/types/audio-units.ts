/**
 * Branded audio types for compile-time unit safety.
 *
 * Prevents a class of bugs where milliseconds are passed where samples are
 * expected, linear gain where dB is expected, etc. The brand is erased at
 * runtime — these are still plain numbers — but TypeScript will reject
 * assignments between incompatible units.
 *
 * Inspired by OpenDAW's branded type system (ppqn, bpm, seconds, samples).
 */

// ---------------------------------------------------------------------------
// Branded type helper
// ---------------------------------------------------------------------------

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ---------------------------------------------------------------------------
// Time units
// ---------------------------------------------------------------------------

/** Time measured in milliseconds (e.g. RTT, jitter, latency). */
export type Milliseconds = Brand<number, 'Milliseconds'>;

/** Time measured in seconds (e.g. AudioContext.currentTime). */
export type Seconds = Brand<number, 'Seconds'>;

/** Audio sample count at a given sample rate. */
export type Samples = Brand<number, 'Samples'>;

// ---------------------------------------------------------------------------
// Audio units
// ---------------------------------------------------------------------------

/** Linear gain value, typically 0.0–1.0 (but can exceed 1 for boost). */
export type LinearGain = Brand<number, 'LinearGain'>;

/** Gain/level measured in decibels. */
export type Decibels = Brand<number, 'Decibels'>;

/** Frequency measured in Hertz. */
export type Hertz = Brand<number, 'Hertz'>;

/** Beats per minute. */
export type BPM = Brand<number, 'BPM'>;

/** A normalized 0–1 value (e.g. dry/wet mix, pan position, progress). */
export type UnitValue = Brand<number, 'UnitValue'>;

/** Percentage value 0–100. */
export type Percent = Brand<number, 'Percent'>;

// ---------------------------------------------------------------------------
// Constructor helpers — zero-cost at runtime (just a cast)
// ---------------------------------------------------------------------------

export const ms = (n: number): Milliseconds => n as Milliseconds;
export const sec = (n: number): Seconds => n as Seconds;
export const samples = (n: number): Samples => n as Samples;
export const gain = (n: number): LinearGain => n as LinearGain;
export const dB = (n: number): Decibels => n as Decibels;
export const hz = (n: number): Hertz => n as Hertz;
export const bpm = (n: number): BPM => n as BPM;
export const unit = (n: number): UnitValue => n as UnitValue;
export const pct = (n: number): Percent => n as Percent;

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

/** Convert samples to milliseconds at a given sample rate. */
export function samplesToMs(s: Samples, sampleRate: Hertz): Milliseconds {
  return ((s / sampleRate) * 1000) as Milliseconds;
}

/** Convert milliseconds to samples at a given sample rate. */
export function msToSamples(m: Milliseconds, sampleRate: Hertz): Samples {
  return ((m / 1000) * sampleRate) as Samples;
}

/** Convert seconds to milliseconds. */
export function secToMs(s: Seconds): Milliseconds {
  return (s * 1000) as Milliseconds;
}

/** Convert milliseconds to seconds. */
export function msToSec(m: Milliseconds): Seconds {
  return (m / 1000) as Seconds;
}

/** Convert linear gain (0-1) to decibels. */
export function gainToDb(g: LinearGain): Decibels {
  return (g <= 0 ? -Infinity : 20 * Math.log10(g)) as Decibels;
}

/** Convert decibels to linear gain. */
export function dbToGain(d: Decibels): LinearGain {
  return Math.pow(10, d / 20) as LinearGain;
}

/** Clamp a BPM to the valid range [40, 240]. */
export function clampBpm(b: number): BPM {
  return Math.max(40, Math.min(240, b)) as BPM;
}
