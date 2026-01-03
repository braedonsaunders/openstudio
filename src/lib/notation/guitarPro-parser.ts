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

const STANDARD_TUNING = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];

const KEY_SIGNATURES: Record<string, string> = {
  '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
  '0': 'C', '1': 'G', '2': 'D', '3': 'A', '4': 'E', '5': 'B', '6': 'F#', '7': 'C#',
};

// Safe binary reader
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

  get position(): number { return this._offset; }
  set position(pos: number) { this._offset = Math.max(0, Math.min(pos, this._length)); }
  get remaining(): number { return this._length - this._offset; }
  get length(): number { return this._length; }

  private check(size: number): boolean { return this._offset + size <= this._length; }

  readByte(): number {
    if (!this.check(1)) return 0;
    return this.bytes[this._offset++];
  }

  readSignedByte(): number {
    if (!this.check(1)) return 0;
    const v = this.view.getInt8(this._offset);
    this._offset++;
    return v;
  }

  readShort(): number {
    if (!this.check(2)) return 0;
    const v = this.view.getInt16(this._offset, true);
    this._offset += 2;
    return v;
  }

  readInt(): number {
    if (!this.check(4)) return 0;
    const v = this.view.getInt32(this._offset, true);
    this._offset += 4;
    return v;
  }

  readDouble(): number {
    if (!this.check(8)) return 0;
    const v = this.view.getFloat64(this._offset, true);
    this._offset += 8;
    return v;
  }

  readBool(): boolean { return this.readByte() !== 0; }

  readString(length: number): string {
    const safeLen = Math.min(Math.max(0, length), this.remaining);
    if (safeLen <= 0) return '';
    const bytes = this.bytes.slice(this._offset, this._offset + safeLen);
    this._offset += safeLen;
    return new TextDecoder('latin1').decode(bytes);
  }

  readStringByte(): string {
    const len = this.readByte();
    return len > 0 && len <= 255 ? this.readString(len) : '';
  }

  readStringInt(): string {
    const len = this.readInt();
    return len > 0 && len <= 10000 ? this.readString(len) : '';
  }

  readStringByteSizeOfInt(): string {
    const size = this.readInt();
    if (size <= 0 || size > 10000) return '';
    const strLen = this.readByte();
    const str = this.readString(Math.min(strLen, size - 1));
    const remaining = size - strLen - 1;
    if (remaining > 0) this.skip(remaining);
    return str;
  }

  skip(bytes: number): void {
    this._offset = Math.min(this._offset + Math.max(0, bytes), this._length);
  }

  peekInt(): number {
    if (!this.check(4)) return 0;
    return this.view.getInt32(this._offset, true);
  }
}

// Detect GP version
function detectVersion(buffer: ArrayBuffer): { version: number; minor: number } {
  if (buffer.byteLength < 31) return { version: 0, minor: 0 };

  const header = new TextDecoder('latin1').decode(new Uint8Array(buffer, 0, 31));

  // Check for specific versions
  if (header.includes('FICHIER GUITAR PRO v5.10')) return { version: 5, minor: 10 };
  if (header.includes('FICHIER GUITAR PRO v5.00')) return { version: 5, minor: 0 };
  if (header.includes('FICHIER GUITAR PRO v5')) return { version: 5, minor: 0 };
  if (header.includes('FICHIER GUITAR PRO v4')) return { version: 4, minor: 0 };
  if (header.includes('FICHIER GUITAR PRO v3')) return { version: 3, minor: 0 };
  if (header.includes('FICHIER GUITAR PRO')) return { version: 3, minor: 0 };

  // Check ZIP signature for GPX
  const bytes = new Uint8Array(buffer, 0, 4);
  if (bytes[0] === 0x50 && bytes[1] === 0x4B) return { version: 6, minor: 0 };

  return { version: 0, minor: 0 };
}

// Parse GP file
function parseGP(reader: SafeBinaryReader, version: number, minor: number): ParsedNotation {
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

  // Skip version header
  reader.position = 31;

  // Read song info (all versions)
  result.title = reader.readStringByteSizeOfInt() || undefined;
  reader.readStringByteSizeOfInt(); // subtitle
  result.artist = reader.readStringByteSizeOfInt() || undefined;
  result.album = reader.readStringByteSizeOfInt() || undefined;

  if (version >= 5) {
    reader.readStringByteSizeOfInt(); // words
    reader.readStringByteSizeOfInt(); // music
    reader.readStringByteSizeOfInt(); // copyright
    result.transcriber = reader.readStringByteSizeOfInt() || undefined;
    reader.readStringByteSizeOfInt(); // instructions

    // Notice lines
    const noticeCount = reader.readInt();
    for (let i = 0; i < Math.min(noticeCount, 100); i++) {
      reader.readStringByteSizeOfInt();
    }
  } else {
    result.transcriber = reader.readStringByteSizeOfInt() || undefined;
    reader.readStringByteSizeOfInt(); // copyright
    reader.readStringByteSizeOfInt(); // notice
  }

  // Triplet feel (GP4+)
  if (version >= 4) {
    reader.readByte();
  }

  // Lyrics (GP4+)
  if (version >= 4) {
    reader.readInt(); // lyric track
    for (let i = 0; i < 5; i++) {
      const startMeasure = reader.readInt();
      const text = reader.readStringInt();
      if (text && i === 0) {
        result.lyrics.push({
          text,
          startBeat: Math.max(0, startMeasure - 1) * 4,
          endBeat: Math.max(0, startMeasure - 1) * 4 + 4,
        });
      }
    }
  }

  // GP5 specific sections
  if (version >= 5) {
    // Page setup
    reader.skip(30); // page format size/margins

    // Header/footer strings (11 of them)
    for (let i = 0; i < 11; i++) {
      reader.readStringByteSizeOfInt();
    }
  }

  // Tempo
  result.tempo = reader.readInt();
  if (result.tempo <= 0 || result.tempo > 500) result.tempo = 120;

  // GP5: hide tempo marker
  if (version >= 5) {
    reader.readByte();
  }

  // Key signature (GP4+)
  if (version >= 4) {
    const keyFifths = reader.readSignedByte();
    reader.skip(3); // reserved
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

  // MIDI channels
  for (let i = 0; i < 64; i++) {
    reader.readInt(); // instrument
    reader.readByte(); // volume
    reader.readByte(); // balance
    reader.readByte(); // chorus
    reader.readByte(); // reverb
    reader.readByte(); // phaser
    reader.readByte(); // tremolo
    reader.skip(2); // blank
  }

  // Measure and track counts
  const measureCount = reader.readInt();
  const trackCount = reader.readInt();

  // Validate
  if (measureCount <= 0 || measureCount > 5000 || trackCount <= 0 || trackCount > 64) {
    console.warn('GP: Invalid counts at offset', reader.position - 8, ':', measureCount, trackCount);
    // Try to recover by searching forward
    return tryRecoverParsing(reader, result, version);
  }

  result.totalMeasures = measureCount;

  // Parse measure headers
  let totalBeats = 0;
  for (let m = 0; m < measureCount && reader.remaining > 0; m++) {
    const header = reader.readByte();

    let beats = 4, beatType = 4;
    if (header & 0x01) beats = reader.readByte() || 4;
    if (header & 0x02) beatType = reader.readByte() || 4;

    const repeatStart = (header & 0x04) !== 0;
    let repeatEnd = false, repeatCount = 1;
    if (header & 0x08) {
      repeatEnd = true;
      repeatCount = reader.readByte();
    }

    if (header & 0x10) {
      if (version >= 5) {
        reader.readByte(); // number of alternate endings
      } else {
        reader.readByte();
      }
    }

    if (header & 0x20) {
      const markerName = reader.readStringByteSizeOfInt();
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
      reader.readSignedByte(); // key
      reader.readByte(); // minor
    }

    if (header & 0x80) {
      // Double bar (GP3+) or time signature beaming (GP5)
      if (version >= 5) {
        reader.readByte(); // beam eighth notes
      }
    }

    // GP5: extra byte for double bar
    if (version >= 5 && (header & 0x03) === 0) {
      reader.readByte();
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
    const trackHeader = reader.readByte();

    // Track name (padded to 40 bytes)
    const nameLen = reader.readByte();
    const trackName = reader.readString(Math.min(nameLen, 40)).trim() || `Track ${t + 1}`;
    if (nameLen < 40) reader.skip(40 - nameLen);

    // String count and tuning
    const stringCount = reader.readInt();
    const tuning: string[] = [];
    for (let s = 0; s < 7; s++) {
      const midiNote = reader.readInt();
      if (s < stringCount && midiNote >= 0 && midiNote < 128) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        tuning.push(`${noteNames[midiNote % 12]}${Math.floor(midiNote / 12) - 1}`);
      }
    }

    reader.readInt(); // port
    reader.readInt(); // channel
    reader.readInt(); // channel effects
    reader.readInt(); // frets
    const capo = reader.readInt();
    reader.readInt(); // color

    // GP5 has extended track properties
    if (version >= 5) {
      reader.skip(44); // RSE settings
      reader.readStringByteSizeOfInt(); // instrument effect 1
      reader.readStringByteSizeOfInt(); // instrument effect 2
    }

    result.tracks.push({
      id: `track-${t}`,
      name: trackName,
      notes: [],
      measures: [...result.measures],
      tuning: tuning.length > 0 ? tuning.reverse() : [...STANDARD_TUNING],
      capo: capo > 0 && capo < 24 ? capo : undefined,
    });
  }

  // GP5: Skip RSE equalizer
  if (version >= 5) {
    reader.skip(4); // useRSE flag
  }

  // Parse measure data
  for (let m = 0; m < measureCount && reader.remaining > 0; m++) {
    const measure = result.measures[m];

    for (let t = 0; t < trackCount && reader.remaining > 0; t++) {
      const track = result.tracks[t];
      const voiceCount = version >= 5 ? 2 : 1;

      for (let v = 0; v < voiceCount && reader.remaining > 0; v++) {
        const beatCount = reader.readInt();
        if (beatCount < 0 || beatCount > 500) continue;

        let beatPosition = measure.startBeat;

        for (let b = 0; b < beatCount && reader.remaining > 0; b++) {
          const beatData = parseBeat(reader, version, track, beatPosition);
          beatPosition += beatData.duration;
        }
      }
    }

    // GP5: Line break marker
    if (version >= 5) {
      reader.readByte();
    }
  }

  return result;
}

// Parse a beat
function parseBeat(
  reader: SafeBinaryReader,
  version: number,
  track: Track,
  beatPosition: number
): { duration: number } {
  const header = reader.readByte();
  const dotted = (header & 0x01) !== 0;

  // Chord diagram
  if (header & 0x02) {
    skipChord(reader, version);
  }

  // Text
  if (header & 0x04) {
    reader.readStringByteSizeOfInt();
  }

  // Beat effects
  if (header & 0x08) {
    skipBeatEffects(reader, version);
  }

  // Mix table change
  if (header & 0x10) {
    skipMixTable(reader, version);
  }

  // Duration
  const durByte = reader.readSignedByte();
  let duration = 4.0 / Math.pow(2, Math.max(-2, Math.min(6, durByte + 2)));
  if (dotted) duration *= 1.5;

  // Tuplet
  if (header & 0x20) {
    const tuplet = reader.readInt();
    if (tuplet === 3) duration *= 2.0 / 3.0;
    else if (tuplet === 5) duration *= 4.0 / 5.0;
    else if (tuplet === 6) duration *= 2.0 / 3.0;
    else if (tuplet === 7) duration *= 4.0 / 7.0;
    else if (tuplet === 9) duration *= 8.0 / 9.0;
    else if (tuplet === 10) duration *= 8.0 / 10.0;
    else if (tuplet === 11) duration *= 8.0 / 11.0;
    else if (tuplet === 12) duration *= 8.0 / 12.0;
    else if (tuplet === 13) duration *= 8.0 / 13.0;
  }

  // String flags
  const stringFlags = reader.readByte();

  // Parse notes
  for (let s = 6; s >= 0; s--) {
    if (stringFlags & (1 << s)) {
      parseNote(reader, version, track, beatPosition, duration, 6 - s + 1);
    }
  }

  return { duration };
}

// Parse a note
function parseNote(
  reader: SafeBinaryReader,
  version: number,
  track: Track,
  beatPosition: number,
  duration: number,
  string: number
): void {
  const header = reader.readByte();

  const accent = (header & 0x02) !== 0;
  const hasEffect = (header & 0x08) !== 0;

  // Dynamic
  if (header & 0x10) {
    reader.readSignedByte();
  }

  // Note type and fret
  let fret = 0;
  if (header & 0x20) {
    const noteType = reader.readByte();
    if (noteType === 2) {
      fret = reader.readSignedByte();
    } else if (noteType === 3) {
      // Dead note
      fret = -1;
    }
  }

  // Fingering (GP5)
  if (version >= 5 && (header & 0x80)) {
    reader.readSignedByte(); // left
    reader.readSignedByte(); // right
  }

  // Duration percent
  if (header & 0x01) {
    reader.readDouble();
  }

  // Swap accidentals (GP5)
  if (version >= 5) {
    reader.readByte();
  }

  // Note effects
  let harmonic = false, palmMute = false, letRing = false;
  let hammer = false, pull = false, bend = 0;

  if (hasEffect) {
    const ef1 = reader.readByte();
    let ef2 = 0;
    if (version >= 4) {
      ef2 = reader.readByte();
    }

    // Bend
    if (ef1 & 0x01) {
      reader.readByte(); // type
      bend = reader.readInt() / 100;
      const pts = reader.readInt();
      for (let i = 0; i < Math.min(pts, 50); i++) {
        reader.readInt(); // time
        reader.readInt(); // value
        reader.readByte(); // vibrato
      }
    }

    // Grace note
    if (ef1 & 0x02) {
      reader.readByte(); // fret
      reader.readByte(); // velocity
      reader.readByte(); // transition
      reader.readByte(); // duration
      if (version >= 5) {
        reader.readByte(); // flags
      }
    }

    // Let ring
    letRing = (ef1 & 0x08) !== 0;
    // Hammer/pull
    hammer = (ef1 & 0x02) !== 0;

    // Staccato, palm mute, tremolo, slide
    if (version >= 4) {
      // Staccato
      if (ef2 & 0x01) { /* staccato */ }
      // Palm mute
      palmMute = (ef2 & 0x02) !== 0;
      // Tremolo picking
      if (ef2 & 0x04) reader.readByte();
      // Slide
      if (ef2 & 0x08) reader.readSignedByte();
      // Harmonic
      if (ef2 & 0x10) {
        harmonic = true;
        reader.readByte();
      }
      // Trill
      if (ef2 & 0x20) {
        reader.readByte(); // fret
        reader.readByte(); // period
      }
    }
  }

  // Add note if valid
  if (fret >= 0 && fret < 30) {
    track.notes.push({
      pitch: `${string}:${fret}`,
      duration,
      startBeat: beatPosition,
      string,
      fret,
      accent,
      hammer,
      pull,
      bend: bend || undefined,
      harmonic: harmonic ? 'natural' : undefined,
      palmMute,
      letRing,
    });
  }
}

// Skip chord diagram
function skipChord(reader: SafeBinaryReader, version: number): void {
  if (version >= 5) {
    reader.readByte(); // format
  }

  const hasChord = reader.readBool();
  if (!hasChord) {
    // Old format chord
    reader.readStringByteSizeOfInt(); // name
    reader.readInt(); // first fret
    if (reader.peekInt() !== 0) {
      for (let i = 0; i < 6; i++) {
        reader.readInt(); // fret
      }
    }
    return;
  }

  // New format
  reader.readByte(); // sharp
  reader.skip(3); // blank
  reader.readByte(); // root
  reader.readByte(); // type
  reader.readByte(); // extension
  reader.readInt(); // bass
  reader.readInt(); // tonality
  reader.readBool(); // add

  const nameLen = reader.readByte();
  reader.skip(20); // name padded to 20

  reader.skip(2); // fifth/ninth
  reader.readInt(); // base fret

  for (let i = 0; i < 7; i++) {
    reader.readInt(); // fret
  }

  const barreCount = reader.readByte();
  for (let i = 0; i < 5; i++) {
    reader.readByte(); // fret
  }
  for (let i = 0; i < 5; i++) {
    reader.readByte(); // start
  }
  for (let i = 0; i < 5; i++) {
    reader.readByte(); // end
  }

  reader.skip(2); // omission/blank
  for (let i = 0; i < 7; i++) {
    reader.readSignedByte(); // fingering
  }
  reader.readBool(); // show
}

// Skip beat effects
function skipBeatEffects(reader: SafeBinaryReader, version: number): void {
  const f1 = reader.readByte();
  let f2 = 0;
  if (version >= 4) {
    f2 = reader.readByte();
  }

  // Vibrato/wide vibrato
  // Fade in
  if (f1 & 0x10) {
    // Natural harmonic or artificial
  }

  // Tap/slap/pop
  if (f1 & 0x20) {
    reader.readByte();
  }

  // Tremolo bar (GP4+)
  if (version >= 4 && (f2 & 0x04)) {
    reader.readByte();
    reader.readInt();
    const pts = reader.readInt();
    for (let i = 0; i < Math.min(pts, 50); i++) {
      reader.readInt();
      reader.readInt();
      reader.readByte();
    }
  }

  // Stroke
  if (f1 & 0x40) {
    reader.readByte();
    reader.readByte();
  }

  // Pickstroke (GP4+)
  if (version >= 4 && (f2 & 0x02)) {
    reader.readByte();
  }
}

// Skip mix table
function skipMixTable(reader: SafeBinaryReader, version: number): void {
  reader.readSignedByte(); // instrument

  if (version >= 5) {
    reader.skip(16); // RSE info
  }

  const volume = reader.readSignedByte();
  const pan = reader.readSignedByte();
  const chorus = reader.readSignedByte();
  const reverb = reader.readSignedByte();
  const phaser = reader.readSignedByte();
  const tremolo = reader.readSignedByte();

  if (version >= 5) {
    reader.readStringByteSizeOfInt(); // tempo name
  }

  const tempo = reader.readInt();

  // Transitions
  if (volume >= 0) reader.readByte();
  if (pan >= 0) reader.readByte();
  if (chorus >= 0) reader.readByte();
  if (reverb >= 0) reader.readByte();
  if (phaser >= 0) reader.readByte();
  if (tremolo >= 0) reader.readByte();
  if (tempo > 0) {
    reader.readByte();
    if (version >= 5) {
      reader.readByte(); // hide tempo
    }
  }

  reader.readByte(); // flags

  if (version >= 5) {
    reader.readByte();
    reader.readStringByteSizeOfInt();
    reader.readStringByteSizeOfInt();
  }
}

function detectSectionType(name: string): Section['type'] {
  const l = name.toLowerCase();
  if (l.includes('intro')) return 'intro';
  if (l.includes('verse')) return 'verse';
  if (l.includes('chorus') || l.includes('refrain')) return 'chorus';
  if (l.includes('bridge')) return 'bridge';
  if (l.includes('solo')) return 'solo';
  if (l.includes('outro') || l.includes('coda')) return 'outro';
  if (l.includes('break')) return 'breakdown';
  return 'custom';
}

// Try to recover by finding reasonable measure/track counts
function tryRecoverParsing(reader: SafeBinaryReader, result: ParsedNotation, version: number): ParsedNotation {
  // Search for reasonable consecutive integers that could be measure/track counts
  const startPos = Math.max(0, reader.position - 100);
  reader.position = startPos;

  while (reader.remaining > 8) {
    const pos = reader.position;
    const val1 = reader.readInt();
    const val2 = reader.readInt();

    // Check if these look like valid measure/track counts
    if (val1 > 0 && val1 <= 500 && val2 > 0 && val2 <= 32) {
      console.log('GP: Recovered at offset', pos, 'measures:', val1, 'tracks:', val2);
      result.totalMeasures = val1;

      // Create placeholder measures
      for (let m = 0; m < val1; m++) {
        result.measures.push({
          number: m + 1,
          startBeat: m * 4,
          duration: 4,
          timeSignature: { beats: 4, beatType: 4 },
        });
      }
      result.totalBeats = val1 * 4;

      // Create placeholder tracks
      for (let t = 0; t < val2; t++) {
        result.tracks.push({
          id: `track-${t}`,
          name: `Track ${t + 1}`,
          notes: [],
          measures: [...result.measures],
          tuning: [...STANDARD_TUNING],
        });
      }
      return result;
    }

    reader.position = pos + 1;
  }

  return result;
}

// Main entry
export async function parseGuitarPro(buffer: ArrayBuffer): Promise<ParsedNotation> {
  const { version, minor } = detectVersion(buffer);

  if (version === 0) {
    throw new Error('Unknown Guitar Pro format');
  }
  if (version >= 6) {
    throw new Error('GP6/7 should use GPX parser');
  }

  const reader = new SafeBinaryReader(buffer);
  return parseGP(reader, version, minor);
}

export async function parseGuitarProFile(file: File): Promise<ParsedNotation> {
  const buffer = await file.arrayBuffer();
  return parseGuitarPro(buffer);
}
