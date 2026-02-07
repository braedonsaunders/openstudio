import { describe, it, expect } from 'vitest';
import {
  ms, sec, samples, gain, dB, hz, bpm, unit, pct,
  samplesToMs, msToSamples, secToMs, msToSec,
  gainToDb, dbToGain, clampBpm,
} from './audio-units';
import type { Milliseconds, Seconds, Samples, LinearGain, Decibels, Hertz, BPM } from './audio-units';

describe('branded type constructors', () => {
  it('ms() creates Milliseconds', () => {
    const val: Milliseconds = ms(100);
    expect(val).toBe(100);
  });

  it('sec() creates Seconds', () => {
    const val: Seconds = sec(1.5);
    expect(val).toBe(1.5);
  });

  it('samples() creates Samples', () => {
    const val: Samples = samples(256);
    expect(val).toBe(256);
  });

  it('gain() creates LinearGain', () => {
    const val: LinearGain = gain(0.8);
    expect(val).toBe(0.8);
  });

  it('dB() creates Decibels', () => {
    const val: Decibels = dB(-6);
    expect(val).toBe(-6);
  });

  it('hz() creates Hertz', () => {
    const val: Hertz = hz(48000);
    expect(val).toBe(48000);
  });

  it('bpm() creates BPM', () => {
    const val: BPM = bpm(120);
    expect(val).toBe(120);
  });
});

describe('samplesToMs / msToSamples', () => {
  it('256 samples at 48kHz ≈ 5.33ms', () => {
    const result = samplesToMs(samples(256), hz(48000));
    expect(result).toBeCloseTo(5.333, 2);
  });

  it('128 samples at 44.1kHz ≈ 2.9ms', () => {
    const result = samplesToMs(samples(128), hz(44100));
    expect(result).toBeCloseTo(2.902, 2);
  });

  it('10ms at 48kHz = 480 samples', () => {
    const result = msToSamples(ms(10), hz(48000));
    expect(result).toBe(480);
  });

  it('roundtrips: samples → ms → samples', () => {
    const original = samples(1024);
    const inMs = samplesToMs(original, hz(48000));
    const back = msToSamples(inMs, hz(48000));
    expect(back).toBeCloseTo(1024, 5);
  });
});

describe('secToMs / msToSec', () => {
  it('1.5 seconds = 1500ms', () => {
    expect(secToMs(sec(1.5))).toBe(1500);
  });

  it('250ms = 0.25 seconds', () => {
    expect(msToSec(ms(250))).toBe(0.25);
  });

  it('roundtrips', () => {
    const original = sec(3.14);
    expect(msToSec(secToMs(original))).toBeCloseTo(3.14, 10);
  });
});

describe('gainToDb / dbToGain', () => {
  it('unity gain (1.0) = 0dB', () => {
    expect(gainToDb(gain(1.0))).toBeCloseTo(0, 5);
  });

  it('0.5 gain ≈ -6.02dB', () => {
    expect(gainToDb(gain(0.5))).toBeCloseTo(-6.02, 1);
  });

  it('0 gain = -Infinity dB', () => {
    expect(gainToDb(gain(0))).toBe(-Infinity);
  });

  it('-6dB ≈ 0.5 gain', () => {
    expect(dbToGain(dB(-6))).toBeCloseTo(0.501, 2);
  });

  it('0dB = 1.0 gain', () => {
    expect(dbToGain(dB(0))).toBe(1);
  });

  it('+6dB ≈ 2.0 gain', () => {
    expect(dbToGain(dB(6))).toBeCloseTo(1.995, 2);
  });

  it('roundtrips: gain → dB → gain', () => {
    const original = gain(0.75);
    const inDb = gainToDb(original);
    const back = dbToGain(inDb);
    expect(back).toBeCloseTo(0.75, 5);
  });
});

describe('clampBpm', () => {
  it('passes through values in range', () => {
    expect(clampBpm(120)).toBe(120);
    expect(clampBpm(40)).toBe(40);
    expect(clampBpm(240)).toBe(240);
  });

  it('clamps below minimum to 40', () => {
    expect(clampBpm(10)).toBe(40);
    expect(clampBpm(0)).toBe(40);
    expect(clampBpm(-100)).toBe(40);
  });

  it('clamps above maximum to 240', () => {
    expect(clampBpm(300)).toBe(240);
    expect(clampBpm(999)).toBe(240);
  });
});
