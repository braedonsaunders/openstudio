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
// Guitar Pro Parser
// ============================================

// Standard guitar tuning (E standard)
const STANDARD_TUNING = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];

// Key signatures mapping (GP uses fifths like MusicXML)
const KEY_SIGNATURES: Record<string, string> = {
  '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
  '0': 'C', '1': 'G', '2': 'D', '3': 'A', '4': 'E', '5': 'B', '6': 'F#', '7': 'C#',
};

// Binary reader utility class
class BinaryReader {
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  get position(): number {
    return this.offset;
  }

  set position(pos: number) {
    this.offset = pos;
  }

  get remaining(): number {
    return this.view.byteLength - this.offset;
  }

  readByte(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readSignedByte(): number {
    const value = this.view.getInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readShort(): number {
    const value = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readInt(): number {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat(): number {
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readDouble(): number {
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readBool(): boolean {
    return this.readByte() !== 0;
  }

  readString(length: number): string {
    const bytes = new Uint8Array(this.view.buffer, this.offset, length);
    this.offset += length;
    return new TextDecoder('latin1').decode(bytes);
  }

  readStringByte(): string {
    const length = this.readByte();
    return this.readString(length);
  }

  readStringInt(): string {
    const length = this.readInt();
    return this.readString(length);
  }

  readStringByteInt(): string {
    const fullLength = this.readInt();
    if (fullLength <= 0) return '';
    const stringLength = this.readByte();
    const value = this.readString(stringLength);
    this.skip(fullLength - stringLength - 1);
    return value;
  }

  skip(bytes: number): void {
    this.offset += bytes;
  }
}

// Parse GP file version
function parseVersion(reader: BinaryReader): string {
  const versionString = reader.readStringByteInt();
  return versionString;
}

// Detect GP version from header
function detectGPVersion(buffer: ArrayBuffer): number {
  const bytes = new Uint8Array(buffer, 0, 31);
  const header = new TextDecoder('latin1').decode(bytes);

  if (header.includes('FICHIER GUITAR PRO v5')) return 5;
  if (header.includes('FICHIER GUITAR PRO v4')) return 4;
  if (header.includes('FICHIER GUITAR PRO v3')) return 3;
  if (header.includes('FICHIER GUITAR PRO ')) return 2;
  if (header.includes('PTAB')) return -1; // Power Tab

  // GPX (newer format) uses ZIP/XML structure
  const zipHeader = new Uint8Array(buffer, 0, 4);
  if (zipHeader[0] === 0x50 && zipHeader[1] === 0x4B) {
    return 6; // GPX format (ZIP-based)
  }

  return 0;
}

// Parse GP3/GP4/GP5 format
function parseGP345(reader: BinaryReader, version: number): ParsedNotation {
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

  try {
    // Skip version string (already read in detection)
    reader.position = 31;

    // Song info
    result.title = reader.readStringByteInt() || undefined;
    const subtitle = reader.readStringByteInt();
    result.artist = reader.readStringByteInt() || undefined;
    result.album = reader.readStringByteInt() || undefined;

    // More metadata based on version
    if (version >= 5) {
      const words = reader.readStringByteInt(); // words by
      const music = reader.readStringByteInt(); // music by
      const copyright = reader.readStringByteInt();
      result.transcriber = reader.readStringByteInt() || undefined;
      const instructions = reader.readStringByteInt();

      // Notice lines
      const noticeLines = reader.readInt();
      for (let i = 0; i < noticeLines; i++) {
        reader.readStringByteInt();
      }
    } else {
      result.transcriber = reader.readStringByteInt() || undefined;
      const copyright = reader.readStringByteInt();
      const notice = reader.readStringByteInt();
    }

    // Triplet feel (shuffle)
    if (version >= 4) {
      reader.readByte(); // triplet feel
    }

    // Lyrics (GP4+)
    if (version >= 4) {
      const lyricTrack = reader.readInt();
      for (let i = 0; i < 5; i++) {
        const startMeasure = reader.readInt();
        const lyricText = reader.readStringInt();
        if (lyricText && i === 0) {
          result.lyrics.push({
            text: lyricText,
            startBeat: (startMeasure - 1) * 4,
            endBeat: (startMeasure - 1) * 4 + 4,
          });
        }
      }
    }

    // Page setup (GP5)
    if (version >= 5) {
      reader.skip(30); // Page setup data
      for (let i = 0; i < 11; i++) {
        reader.readStringByteInt(); // Header/footer strings
      }
    }

    // Tempo
    result.tempo = reader.readInt();

    // Key signature (GP4+)
    if (version >= 4) {
      const keyFifths = reader.readSignedByte();
      reader.skip(3); // Reserved
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

    // MIDI channels (32 channels)
    const channels: Array<{ instrument: number; volume: number }> = [];
    for (let i = 0; i < 64; i++) {
      const instrument = reader.readInt();
      const volume = reader.readByte();
      const balance = reader.readByte();
      reader.skip(6); // Chorus, reverb, phaser, tremolo, blank1, blank2

      if (i % 2 === 0) {
        channels.push({ instrument, volume });
      }
    }

    // Number of measures and tracks
    const measureCount = reader.readInt();
    const trackCount = reader.readInt();

    result.totalMeasures = measureCount;

    // Parse measure headers
    let totalBeats = 0;
    for (let m = 0; m < measureCount; m++) {
      const header = reader.readByte();

      let beats = 4;
      let beatType = 4;

      // Time signature numerator
      if (header & 0x01) {
        beats = reader.readByte();
      }
      // Time signature denominator
      if (header & 0x02) {
        beatType = reader.readByte();
      }

      // Repeat start
      const repeatStart = (header & 0x04) !== 0;

      // Repeat end
      let repeatEnd = false;
      let repeatCount = 1;
      if (header & 0x08) {
        repeatEnd = true;
        repeatCount = reader.readByte();
      }

      // Alternate endings
      if (header & 0x10) {
        reader.readByte();
      }

      // Marker
      if (header & 0x20) {
        const markerName = reader.readStringByteInt();
        const markerColor = reader.readInt();

        // Add as section
        result.sections.push({
          id: `section-${m}`,
          name: markerName,
          type: markerName.toLowerCase().includes('verse') ? 'verse'
            : markerName.toLowerCase().includes('chorus') ? 'chorus'
            : markerName.toLowerCase().includes('bridge') ? 'bridge'
            : markerName.toLowerCase().includes('intro') ? 'intro'
            : markerName.toLowerCase().includes('outro') ? 'outro'
            : markerName.toLowerCase().includes('solo') ? 'solo'
            : 'custom',
          startBeat: totalBeats,
          endBeat: totalBeats + beats,
        });
      }

      // Key signature change
      if (header & 0x40) {
        const keyFifths = reader.readSignedByte();
        reader.readByte(); // Minor flag
      }

      // Double bar (GP3+)
      if (version >= 3 && (header & 0x80)) {
        // Double bar line
      }

      // Calculate measure duration
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
    for (let t = 0; t < trackCount; t++) {
      const trackHeader = reader.readByte();

      const track: Track = {
        id: `track-${t}`,
        name: reader.readStringByte().trim() || `Track ${t + 1}`,
        notes: [],
        measures: [...result.measures],
        tuning: [...STANDARD_TUNING],
      };

      // Pad name to 40 bytes
      reader.skip(40 - track.name.length);

      // String count and tuning
      const stringCount = reader.readInt();
      const tuning: string[] = [];
      for (let s = 0; s < 7; s++) {
        const midiNote = reader.readInt();
        if (s < stringCount) {
          // Convert MIDI note to pitch string
          const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          const octave = Math.floor(midiNote / 12) - 1;
          const noteName = noteNames[midiNote % 12];
          tuning.push(`${noteName}${octave}`);
        }
      }
      track.tuning = tuning.reverse();

      // Port, channel, channel effects, frets
      reader.skip(4); // Port
      const channel = reader.readInt() - 1;
      reader.skip(4); // Channel effects
      const frets = reader.readInt();

      // Capo
      track.capo = reader.readInt();

      // Track color
      reader.readInt();

      // Get instrument from channel
      if (channel >= 0 && channel < channels.length) {
        const inst = channels[channel].instrument;
        if (inst >= 25 && inst <= 31) track.instrument = 'Electric Guitar';
        else if (inst >= 32 && inst <= 39) track.instrument = 'Bass';
        else if (inst === 0) track.instrument = 'Acoustic Piano';
        else track.instrument = 'Guitar';
      }

      result.tracks.push(track);
    }

    // Parse measure data for each track
    for (let m = 0; m < measureCount; m++) {
      for (let t = 0; t < trackCount; t++) {
        const track = result.tracks[t];
        const measure = result.measures[m];

        // Number of voices (usually 2 in GP5)
        const voiceCount = version >= 5 ? 2 : 1;

        for (let v = 0; v < voiceCount; v++) {
          const beatCount = reader.readInt();

          let beatPosition = measure.startBeat;

          for (let b = 0; b < beatCount; b++) {
            const beatHeader = reader.readByte();

            // Dotted note
            const dotted = (beatHeader & 0x01) !== 0;

            // Has chord diagram
            if (beatHeader & 0x02) {
              // Parse chord diagram
              if (version >= 5) {
                reader.readByte(); // Format
              }
              const chordExists = reader.readBool();
              if (chordExists) {
                const sharpFlat = reader.readByte();
                reader.skip(3); // Blank
                const root = reader.readByte();
                const chordType = reader.readByte();
                const extension = reader.readByte();
                const bass = reader.readInt();
                const tonality = reader.readInt();
                const addedNote = reader.readBool();
                const chordName = reader.readStringByte();
                reader.skip(40 - chordName.length);
                reader.skip(2); // Fifth/ninth
                const baseFret = reader.readInt();

                // Frets for each string
                const frets: number[] = [];
                for (let s = 0; s < 7; s++) {
                  frets.push(reader.readInt());
                }

                // Barre count
                const barreCount = reader.readByte();
                reader.skip(barreCount * 5); // Barre data

                reader.skip(1); // Omissions
                reader.skip(1); // Blank

                // Fingering
                const fingers: number[] = [];
                for (let s = 0; s < 7; s++) {
                  fingers.push(reader.readSignedByte());
                }

                reader.readBool(); // Show diagram

                // Add chord to result
                if (chordName) {
                  result.chords.push({
                    name: chordName,
                    root: String.fromCharCode(65 + root), // A-G
                    quality: '',
                    startBeat: beatPosition,
                    duration: 4,
                    frets: frets.slice(0, track.tuning?.length || 6),
                    fingers: fingers.slice(0, track.tuning?.length || 6),
                  });
                }
              } else {
                // GP3/4 chord format
                reader.skip(17); // Chord header
                const chordName = reader.readString(21);
                reader.skip(4); // Base fret
                for (let s = 0; s < 7; s++) {
                  reader.readInt(); // Fret
                }
                reader.skip(32); // Additional data

                if (chordName.trim()) {
                  result.chords.push({
                    name: chordName.trim(),
                    root: chordName.charAt(0),
                    quality: chordName.slice(1).trim(),
                    startBeat: beatPosition,
                    duration: 4,
                  });
                }
              }
            }

            // Has text
            if (beatHeader & 0x04) {
              const text = reader.readStringByteInt();
            }

            // Beat effects
            if (beatHeader & 0x08) {
              const effectHeader1 = reader.readByte();
              let effectHeader2 = 0;
              if (version >= 4) {
                effectHeader2 = reader.readByte();
              }

              // Tap/slap/pop
              if (effectHeader1 & 0x20) {
                reader.readByte();
              }

              // Tremolo bar (GP4+)
              if (version >= 4 && (effectHeader2 & 0x04)) {
                readBend(reader);
              }

              // Stroke
              if (effectHeader1 & 0x40) {
                reader.readByte(); // Upstroke
                reader.readByte(); // Downstroke
              }

              // Pickstroke
              if (version >= 4 && (effectHeader2 & 0x02)) {
                reader.readByte();
              }
            }

            // Mix table change
            if (beatHeader & 0x10) {
              reader.readSignedByte(); // Instrument
              if (version >= 5) {
                reader.skip(16); // RSE data
              }
              reader.readSignedByte(); // Volume
              reader.readSignedByte(); // Pan
              reader.readSignedByte(); // Chorus
              reader.readSignedByte(); // Reverb
              reader.readSignedByte(); // Phaser
              reader.readSignedByte(); // Tremolo
              if (version >= 5) {
                reader.readStringByteInt(); // Tempo name
              }
              const tempoChange = reader.readInt();
              if (tempoChange > 0) {
                // Tempo change transitions (hidden based on flags)
                reader.skip(2);
                if (version >= 5) {
                  reader.readByte(); // Hide tempo
                }
              }
              reader.skip(1); // Mix table change flags
              if (version >= 5) {
                reader.skip(1);
                reader.readStringByteInt(); // Effect 2
              }
            }

            // Duration
            const duration = reader.readSignedByte();
            let beatDuration = 4.0 / Math.pow(2, duration + 2);
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

            // Parse notes for each string
            for (let s = 6; s >= 0; s--) {
              if (stringFlags & (1 << s)) {
                const noteHeader = reader.readByte();

                // Accentuated
                const accent = (noteHeader & 0x02) !== 0;

                // Ghost note
                const ghost = (noteHeader & 0x04) !== 0;

                // Note effect
                const hasEffect = (noteHeader & 0x08) !== 0;

                // Dynamic
                if (noteHeader & 0x10) {
                  reader.readSignedByte();
                }

                // Note type
                let fret = 0;
                if (noteHeader & 0x20) {
                  const noteType = reader.readByte();
                  if (noteType === 2) {
                    fret = reader.readSignedByte();
                  }
                }

                // Fingering (GP5)
                if (version >= 5 && (noteHeader & 0x80)) {
                  reader.readSignedByte(); // Left hand
                  reader.readSignedByte(); // Right hand
                }

                // Duration percent
                if (noteHeader & 0x01) {
                  reader.readDouble();
                }

                // Swap accidentals (GP5)
                if (version >= 5) {
                  reader.readByte();
                }

                // Note effects
                let hammer = false;
                let pull = false;
                let slide = false;
                let bend = 0;
                let harmonic = false;
                let palmMute = false;
                let letRing = false;

                if (hasEffect) {
                  const effectFlags1 = reader.readByte();
                  let effectFlags2 = 0;
                  if (version >= 4) {
                    effectFlags2 = reader.readByte();
                  }

                  // Bend
                  if (effectFlags1 & 0x01) {
                    bend = readBend(reader);
                  }

                  // Grace note
                  if (effectFlags1 & 0x02) {
                    reader.readByte(); // Fret
                    reader.readByte(); // Dynamic
                    reader.readByte(); // Transition
                    reader.readByte(); // Duration
                    if (version >= 5) {
                      reader.readByte(); // Flags
                    }
                  }

                  // Tremolo picking
                  if (effectFlags2 & 0x04) {
                    reader.readByte();
                  }

                  // Slide
                  if (effectFlags2 & 0x08) {
                    slide = true;
                    reader.readSignedByte();
                  }

                  // Harmonic
                  if (effectFlags2 & 0x10) {
                    harmonic = true;
                    reader.readByte();
                  }

                  // Trill
                  if (effectFlags2 & 0x20) {
                    reader.readByte(); // Fret
                    reader.readByte(); // Period
                  }

                  // Let ring
                  if (effectFlags1 & 0x08) {
                    letRing = true;
                  }

                  // Hammer on / Pull off
                  if (effectFlags1 & 0x02) {
                    // Determined by fret relationship
                  }

                  // Palm mute
                  if (effectFlags1 & 0x10) {
                    palmMute = true;
                  }
                }

                // Add note to track
                if (fret >= 0) {
                  const stringNumber = 6 - s;
                  const tuning = track.tuning || STANDARD_TUNING;
                  const openPitch = tuning[stringNumber - 1] || 'E4';

                  track.notes.push({
                    pitch: openPitch, // Would need proper calculation
                    duration: beatDuration,
                    startBeat: beatPosition,
                    string: stringNumber,
                    fret,
                    accent,
                    hammer,
                    pull,
                    bend,
                    harmonic: harmonic ? 'natural' : undefined,
                    palmMute,
                    letRing,
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
  } catch (error) {
    console.error('GP parsing error:', error);
    throw new Error('Failed to parse Guitar Pro file: ' + (error as Error).message);
  }
}

// Read bend data
function readBend(reader: BinaryReader): number {
  const bendType = reader.readByte();
  const bendValue = reader.readInt(); // In cents (100 = 1 semitone)
  const pointCount = reader.readInt();

  for (let i = 0; i < pointCount; i++) {
    reader.readInt(); // Position
    reader.readInt(); // Value
    reader.readByte(); // Vibrato
  }

  return bendValue / 100; // Return in semitones
}

// Parse GPX (Guitar Pro 6+) format
// GPX files are ZIP archives containing XML
async function parseGPX(buffer: ArrayBuffer): Promise<ParsedNotation> {
  // GPX files are ZIP archives - we need to extract and parse the XML inside
  // For now, return a placeholder with instructions

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

  // GPX is a ZIP file - need JSZip or similar to extract
  // The content is in score.gpif (XML format)

  // For now, try to find any readable content
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(buffer);

  // Look for title in GPX XML
  const titleMatch = text.match(/<Title>([^<]+)<\/Title>/);
  if (titleMatch) result.title = titleMatch[1];

  const artistMatch = text.match(/<Artist>([^<]+)<\/Artist>/);
  if (artistMatch) result.artist = artistMatch[1];

  // Look for tempo
  const tempoMatch = text.match(/<Tempo>(\d+)<\/Tempo>/);
  if (tempoMatch) result.tempo = parseInt(tempoMatch[1]);

  return result;
}

// Main parser function
export async function parseGuitarPro(buffer: ArrayBuffer): Promise<ParsedNotation> {
  const version = detectGPVersion(buffer);

  if (version === 0) {
    throw new Error('Unknown or unsupported file format');
  }

  if (version === -1) {
    throw new Error('Power Tab format is not supported. Please export as Guitar Pro or MusicXML.');
  }

  if (version >= 6) {
    // GPX format (GP6, GP7)
    return parseGPX(buffer);
  }

  // GP3/GP4/GP5 format
  const reader = new BinaryReader(buffer);
  return parseGP345(reader, version);
}

// Parse from File object
export async function parseGuitarProFile(file: File): Promise<ParsedNotation> {
  const buffer = await file.arrayBuffer();
  return parseGuitarPro(buffer);
}
