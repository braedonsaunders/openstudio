import type {
  ParsedNotation,
  Note,
  ChordSymbol,
  Measure,
  Track,
  TimeSignature,
  KeySignature,
  Section,
} from './types';

// ============================================
// Guitar Pro Parser with Safe Bounds Checking
// ============================================

// Standard guitar tuning (E standard)
const STANDARD_TUNING = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];

// Key signatures mapping
const KEY_SIGNATURES: Record<string, string> = {
  '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
  '0': 'C', '1': 'G', '2': 'D', '3': 'A', '4': 'E', '5': 'B', '6': 'F#', '7': 'C#',
};

// Binary reader with bounds checking
class SafeBinaryReader {
  private view: DataView;
  private bytes: Uint8Array;
  private _offset: number = 0;
  private _length: number;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
    this._length = buffer.byteLength;
  }

  get position(): number {
    return this._offset;
  }

  set position(pos: number) {
    this._offset = Math.max(0, Math.min(pos, this._length));
  }

  get remaining(): number {
    return this._length - this._offset;
  }

  get length(): number {
    return this._length;
  }

  private checkBounds(size: number): boolean {
    return this._offset + size <= this._length;
  }

  readByte(): number {
    if (!this.checkBounds(1)) return 0;
    const value = this.bytes[this._offset];
    this._offset += 1;
    return value;
  }

  readSignedByte(): number {
    if (!this.checkBounds(1)) return 0;
    const value = this.view.getInt8(this._offset);
    this._offset += 1;
    return value;
  }

  readShort(): number {
    if (!this.checkBounds(2)) return 0;
    const value = this.view.getInt16(this._offset, true);
    this._offset += 2;
    return value;
  }

  readInt(): number {
    if (!this.checkBounds(4)) return 0;
    const value = this.view.getInt32(this._offset, true);
    this._offset += 4;
    return value;
  }

  readFloat(): number {
    if (!this.checkBounds(4)) return 0;
    const value = this.view.getFloat32(this._offset, true);
    this._offset += 4;
    return value;
  }

  readDouble(): number {
    if (!this.checkBounds(8)) return 0;
    const value = this.view.getFloat64(this._offset, true);
    this._offset += 8;
    return value;
  }

  readBool(): boolean {
    return this.readByte() !== 0;
  }

  readString(length: number): string {
    const safeLength = Math.min(length, this.remaining);
    if (safeLength <= 0) return '';
    const bytes = this.bytes.slice(this._offset, this._offset + safeLength);
    this._offset += safeLength;
    return new TextDecoder('latin1').decode(bytes);
  }

  readStringByte(): string {
    const length = this.readByte();
    if (length <= 0 || length > 255) return '';
    return this.readString(length);
  }

  readStringInt(): string {
    const length = this.readInt();
    if (length <= 0 || length > 10000) return '';
    return this.readString(length);
  }

  readStringByteInt(): string {
    const fullLength = this.readInt();
    if (fullLength <= 0 || fullLength > 10000) return '';
    const stringLength = this.readByte();
    if (stringLength <= 0 || stringLength > fullLength) {
      this.skip(fullLength - 1);
      return '';
    }
    const value = this.readString(stringLength);
    const remaining = fullLength - stringLength - 1;
    if (remaining > 0) this.skip(remaining);
    return value;
  }

  skip(bytes: number): void {
    this._offset = Math.min(this._offset + bytes, this._length);
  }

  // Peek without advancing
  peekByte(): number {
    if (!this.checkBounds(1)) return 0;
    return this.bytes[this._offset];
  }
}

// Detect GP version from header
function detectGPVersion(buffer: ArrayBuffer): number {
  if (buffer.byteLength < 31) return 0;

  const bytes = new Uint8Array(buffer, 0, 31);
  const header = new TextDecoder('latin1').decode(bytes);

  if (header.includes('FICHIER GUITAR PRO v5')) return 5;
  if (header.includes('FICHIER GUITAR PRO v4')) return 4;
  if (header.includes('FICHIER GUITAR PRO v3')) return 3;
  if (header.includes('FICHIER GUITAR PRO ')) return 2;

  // Check for ZIP signature (GPX format)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B) return 6;

  return 0;
}

// Parse GP3/GP4/GP5 format with safe reading
function parseGP345(reader: SafeBinaryReader, version: number): ParsedNotation {
  const result: ParsedNotation = {
    tempo: 120,
    timeSignature: { beats: 4, beatType: 4 },
    keySignature: { fifths: 0, mode: 'major', key: 'C' },
    tracks: [],
    chords: [],
    sections: [],
    lyrics: [],
    measures: [],
    totalBeats: 0,
    totalMeasures: 0,
    sourceFormat: 'gp',
  };

  // Skip version string
  reader.position = 31;

  // Read song info
  result.title = reader.readStringByteInt() || undefined;
  reader.readStringByteInt(); // subtitle
  result.artist = reader.readStringByteInt() || undefined;
  result.album = reader.readStringByteInt() || undefined;

  // Version-specific metadata
  if (version >= 5) {
    reader.readStringByteInt(); // words by
    reader.readStringByteInt(); // music by
    reader.readStringByteInt(); // copyright
    result.transcriber = reader.readStringByteInt() || undefined;
    reader.readStringByteInt(); // instructions

    const noticeLines = reader.readInt();
    for (let i = 0; i < Math.min(noticeLines, 100); i++) {
      reader.readStringByteInt();
    }
  } else {
    result.transcriber = reader.readStringByteInt() || undefined;
    reader.readStringByteInt(); // copyright
    reader.readStringByteInt(); // notice
  }

  // Triplet feel
  if (version >= 4) {
    reader.readByte();
  }

  // Lyrics
  if (version >= 4) {
    reader.readInt(); // lyric track
    for (let i = 0; i < 5; i++) {
      const startMeasure = reader.readInt();
      const text = reader.readStringInt();
      if (text && i === 0) {
        result.lyrics.push({
          text,
          startBeat: (startMeasure - 1) * 4,
          endBeat: (startMeasure - 1) * 4 + 4,
        });
      }
    }
  }

  // Page setup (GP5)
  if (version >= 5) {
    reader.skip(30);
    for (let i = 0; i < 11; i++) {
      reader.readStringByteInt();
    }
  }

  // Tempo
  const tempo = reader.readInt();
  if (tempo > 0 && tempo < 500) {
    result.tempo = tempo;
  }

  // Key (GP4+)
  if (version >= 4) {
    const keyFifths = reader.readSignedByte();
    reader.skip(3);
    result.keySignature = {
      fifths: keyFifths,
      mode: 'major',
      key: KEY_SIGNATURES[keyFifths.toString()] || 'C',
    };
  }

  // Octave (GP4+)
  if (version >= 4) {
    reader.readByte();
  }

  // MIDI channels (64 entries = 32 ports x 2)
  for (let i = 0; i < 64; i++) {
    reader.skip(12); // instrument(4) + volume(1) + balance(1) + 6 effects
  }

  // Measures and tracks count
  const measureCount = reader.readInt();
  const trackCount = reader.readInt();

  // Validate counts
  if (measureCount <= 0 || measureCount > 10000 || trackCount <= 0 || trackCount > 100) {
    console.warn('Invalid measure/track count:', measureCount, trackCount);
    return result;
  }

  result.totalMeasures = measureCount;

  // Parse measure headers
  let totalBeats = 0;
  for (let m = 0; m < measureCount && reader.remaining > 0; m++) {
    const header = reader.readByte();

    let beats = 4;
    let beatType = 4;

    if (header & 0x01) beats = reader.readByte() || 4;
    if (header & 0x02) beatType = reader.readByte() || 4;

    const repeatStart = (header & 0x04) !== 0;
    let repeatEnd = false;
    let repeatCount = 1;

    if (header & 0x08) {
      repeatEnd = true;
      repeatCount = reader.readByte();
    }

    if (header & 0x10) reader.readByte(); // alternate endings

    if (header & 0x20) {
      const markerName = reader.readStringByteInt();
      reader.readInt(); // color

      if (markerName) {
        result.sections.push({
          id: `section-${m}`,
          name: markerName,
          type: detectSectionType(markerName),
          startBeat: totalBeats,
          endBeat: totalBeats + beats,
        });
      }
    }

    if (header & 0x40) {
      reader.readSignedByte();
      reader.readByte();
    }

    if (version >= 3 && (header & 0x80)) {
      // double bar
    }

    const beatsPerMeasure = (beats * 4) / beatType;

    result.measures.push({
      number: m + 1,
      startBeat: totalBeats,
      duration: beatsPerMeasure,
      timeSignature: { beats, beatType },
      repeatStart,
      repeatEnd,
      repeatCount,
    });

    totalBeats += beatsPerMeasure;
  }

  result.totalBeats = totalBeats;

  // Parse tracks
  for (let t = 0; t < trackCount && reader.remaining > 0; t++) {
    reader.readByte(); // header

    const trackName = reader.readStringByte().trim() || `Track ${t + 1}`;
    reader.skip(40 - Math.min(trackName.length, 40));

    const stringCount = reader.readInt();
    const tuning: string[] = [];

    for (let s = 0; s < 7; s++) {
      const midiNote = reader.readInt();
      if (s < stringCount && midiNote >= 0 && midiNote < 128) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = noteNames[midiNote % 12];
        tuning.push(`${noteName}${octave}`);
      }
    }

    reader.skip(4); // port
    reader.readInt(); // channel
    reader.skip(4); // channel effects
    reader.readInt(); // frets
    const capo = reader.readInt();
    reader.readInt(); // color

    result.tracks.push({
      id: `track-${t}`,
      name: trackName,
      notes: [],
      measures: [...result.measures],
      tuning: tuning.length > 0 ? tuning.reverse() : [...STANDARD_TUNING],
      capo: capo > 0 && capo < 24 ? capo : undefined,
    });
  }

  // Parse measure data - simplified approach for robustness
  for (let m = 0; m < measureCount && reader.remaining > 0; m++) {
    const measure = result.measures[m];

    for (let t = 0; t < trackCount && reader.remaining > 0; t++) {
      const track = result.tracks[t];
      const voiceCount = version >= 5 ? 2 : 1;

      for (let v = 0; v < voiceCount && reader.remaining > 0; v++) {
        const beatCount = reader.readInt();

        if (beatCount < 0 || beatCount > 1000) {
          // Invalid beat count, skip rest of parsing
          continue;
        }

        let beatPosition = measure.startBeat;

        for (let b = 0; b < beatCount && reader.remaining > 0; b++) {
          const beatHeader = reader.readByte();
          const dotted = (beatHeader & 0x01) !== 0;

          // Chord diagram
          if (beatHeader & 0x02) {
            skipChordDiagram(reader, version);
          }

          // Text
          if (beatHeader & 0x04) {
            reader.readStringByteInt();
          }

          // Beat effects
          if (beatHeader & 0x08) {
            skipBeatEffects(reader, version);
          }

          // Mix table
          if (beatHeader & 0x10) {
            skipMixTable(reader, version);
          }

          // Duration
          const durationByte = reader.readSignedByte();
          let beatDuration = 4.0 / Math.pow(2, Math.max(-2, Math.min(6, durationByte + 2)));
          if (dotted) beatDuration *= 1.5;

          // Tuplet
          if (beatHeader & 0x20) {
            const tuplet = reader.readInt();
            if (tuplet === 3) beatDuration *= 2.0 / 3.0;
            else if (tuplet === 5) beatDuration *= 4.0 / 5.0;
            else if (tuplet === 6) beatDuration *= 2.0 / 3.0;
            else if (tuplet === 7) beatDuration *= 4.0 / 7.0;
          }

          // String flags
          const stringFlags = reader.readByte();

          // Parse notes
          for (let s = 6; s >= 0; s--) {
            if (stringFlags & (1 << s)) {
              const noteData = parseNote(reader, version);

              if (noteData.fret >= 0 && noteData.fret < 30) {
                track.notes.push({
                  pitch: `${6 - s}:${noteData.fret}`,
                  duration: beatDuration,
                  startBeat: beatPosition,
                  string: 6 - s + 1,
                  fret: noteData.fret,
                  accent: noteData.accent,
                  hammer: noteData.hammer,
                  pull: noteData.pull,
                  bend: noteData.bend,
                  harmonic: noteData.harmonic ? 'natural' : undefined,
                  palmMute: noteData.palmMute,
                  letRing: noteData.letRing,
                });
              }
            }
          }

          beatPosition += beatDuration;
        }
      }
    }
  }

  return result;
}

// Helper to detect section type
function detectSectionType(name: string): Section['type'] {
  const lower = name.toLowerCase();
  if (lower.includes('intro')) return 'intro';
  if (lower.includes('verse')) return 'verse';
  if (lower.includes('chorus') || lower.includes('refrain')) return 'chorus';
  if (lower.includes('bridge')) return 'bridge';
  if (lower.includes('solo')) return 'solo';
  if (lower.includes('outro') || lower.includes('coda')) return 'outro';
  if (lower.includes('break')) return 'breakdown';
  return 'custom';
}

// Skip chord diagram data
function skipChordDiagram(reader: SafeBinaryReader, version: number): void {
  if (version >= 5) {
    reader.readByte();
  }

  const exists = reader.readBool();
  if (exists) {
    reader.skip(4); // sharp/flat + blank
    reader.skip(4); // root, type, extension
    reader.readInt(); // bass
    reader.readInt(); // tonality
    reader.readBool(); // added note
    const nameLen = reader.readByte();
    reader.skip(40); // name (padded)
    reader.skip(2); // fifth/ninth
    reader.readInt(); // base fret
    reader.skip(28); // 7 frets as ints
    const barreCount = reader.readByte();
    reader.skip(barreCount * 5);
    reader.skip(2); // omissions + blank
    reader.skip(7); // fingering
    reader.readBool(); // show diagram
  } else {
    // GP3/4 format
    reader.skip(17);
    reader.skip(21); // name
    reader.skip(4); // base fret
    reader.skip(28); // frets
    reader.skip(32); // additional
  }
}

// Skip beat effects
function skipBeatEffects(reader: SafeBinaryReader, version: number): void {
  const flags1 = reader.readByte();
  let flags2 = 0;
  if (version >= 4) {
    flags2 = reader.readByte();
  }

  if (flags1 & 0x20) reader.readByte();
  if (version >= 4 && (flags2 & 0x04)) skipBend(reader);
  if (flags1 & 0x40) reader.skip(2);
  if (version >= 4 && (flags2 & 0x02)) reader.readByte();
}

// Skip mix table
function skipMixTable(reader: SafeBinaryReader, version: number): void {
  reader.readSignedByte(); // instrument
  if (version >= 5) reader.skip(16);
  reader.skip(6); // volume, pan, chorus, reverb, phaser, tremolo
  if (version >= 5) reader.readStringByteInt();
  const tempo = reader.readInt();
  if (tempo > 0) {
    reader.skip(2);
    if (version >= 5) reader.readByte();
  }
  reader.readByte();
  if (version >= 5) {
    reader.readByte();
    reader.readStringByteInt();
  }
}

// Skip bend data
function skipBend(reader: SafeBinaryReader): void {
  reader.readByte();
  reader.readInt();
  const points = reader.readInt();
  reader.skip(Math.min(points, 100) * 9);
}

// Parse note data
function parseNote(reader: SafeBinaryReader, version: number): {
  fret: number;
  accent: boolean;
  hammer: boolean;
  pull: boolean;
  bend: number;
  harmonic: boolean;
  palmMute: boolean;
  letRing: boolean;
} {
  const header = reader.readByte();

  const accent = (header & 0x02) !== 0;
  const hasEffect = (header & 0x08) !== 0;

  if (header & 0x10) reader.readSignedByte(); // dynamic

  let fret = 0;
  if (header & 0x20) {
    const noteType = reader.readByte();
    if (noteType === 2) {
      fret = reader.readSignedByte();
    }
  }

  if (version >= 5 && (header & 0x80)) {
    reader.skip(2); // fingering
  }

  if (header & 0x01) {
    reader.readDouble(); // duration percent
  }

  if (version >= 5) {
    reader.readByte(); // swap accidentals
  }

  let hammer = false, pull = false, harmonic = false, palmMute = false, letRing = false;
  let bend = 0;

  if (hasEffect) {
    const eFlags1 = reader.readByte();
    let eFlags2 = 0;
    if (version >= 4) {
      eFlags2 = reader.readByte();
    }

    if (eFlags1 & 0x01) {
      reader.readByte();
      bend = reader.readInt() / 100;
      const pts = reader.readInt();
      reader.skip(Math.min(pts, 100) * 9);
    }

    if (eFlags1 & 0x02) {
      reader.skip(4);
      if (version >= 5) reader.readByte();
    }

    if (eFlags2 & 0x04) reader.readByte();
    if (eFlags2 & 0x08) reader.readSignedByte();
    if (eFlags2 & 0x10) {
      harmonic = true;
      reader.readByte();
    }
    if (eFlags2 & 0x20) reader.skip(2);

    letRing = (eFlags1 & 0x08) !== 0;
    palmMute = (eFlags1 & 0x10) !== 0;
  }

  return { fret, accent, hammer, pull, bend, harmonic, palmMute, letRing };
}

// Main parser function
export async function parseGuitarPro(buffer: ArrayBuffer): Promise<ParsedNotation> {
  const version = detectGPVersion(buffer);

  if (version === 0) {
    throw new Error('Unknown Guitar Pro format');
  }

  if (version >= 6) {
    throw new Error('GP6/7 format should be handled by GPX parser');
  }

  const reader = new SafeBinaryReader(buffer);
  return parseGP345(reader, version);
}

// Parse from File object
export async function parseGuitarProFile(file: File): Promise<ParsedNotation> {
  const buffer = await file.arrayBuffer();
  return parseGuitarPro(buffer);
}
