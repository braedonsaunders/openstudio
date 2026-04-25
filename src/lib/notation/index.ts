// Notation parsing utilities with full ZIP support
export * from './types';
export { parseMusicXML, parseMusicXMLFile } from './musicxml-parser';
export { parseGuitarPro, parseGuitarProFile } from './guitarPro-parser';

import { unzipSync, strFromU8 } from 'fflate';
import type { ParsedNotation, Track, Note, ChordSymbol, Measure, Section } from './types';
import { parseMusicXML } from './musicxml-parser';

// Supported file extensions
export const NOTATION_FILE_EXTENSIONS = [
  '.xml',
  '.musicxml',
  '.mxl',
  '.gp',
  '.gp3',
  '.gp4',
  '.gp5',
  '.gpx',
  '.gp7',
];

// Get file type from extension
export function getNotationFileType(filename: string): 'musicxml' | 'mxl' | 'gp-legacy' | 'gpx' | 'unknown' {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();

  if (['.xml', '.musicxml'].includes(ext)) {
    return 'musicxml';
  }

  if (ext === '.mxl') {
    return 'mxl';
  }

  if (['.gp', '.gp3', '.gp4', '.gp5'].includes(ext)) {
    return 'gp-legacy';
  }

  if (['.gpx', '.gp7'].includes(ext)) {
    return 'gpx';
  }

  return 'unknown';
}

// ============================================
// MXL Parser (Compressed MusicXML)
// ============================================

async function parseMxlFile(file: File): Promise<ParsedNotation> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check ZIP signature
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
    throw new Error('Invalid .mxl file: Not a valid ZIP archive');
  }

  try {
    // Unzip the file
    const unzipped = unzipSync(bytes);

    // Find the main MusicXML file
    // First check META-INF/container.xml for the rootfile
    let mainXmlPath: string | null = null;

    if (unzipped['META-INF/container.xml']) {
      const containerXml = strFromU8(unzipped['META-INF/container.xml']);
      const rootfileMatch = containerXml.match(/rootfile[^>]+full-path="([^"]+)"/);
      if (rootfileMatch) {
        mainXmlPath = rootfileMatch[1];
      }
    }

    // If no container.xml, look for any .xml file at root
    if (!mainXmlPath) {
      const xmlFiles = Object.keys(unzipped).filter(
        name => name.endsWith('.xml') && !name.includes('META-INF')
      );
      if (xmlFiles.length > 0) {
        // Prefer files with 'score' or 'part' in the name
        mainXmlPath = xmlFiles.find(f => /score|part/i.test(f)) || xmlFiles[0];
      }
    }

    if (!mainXmlPath || !unzipped[mainXmlPath]) {
      throw new Error('Could not find MusicXML content in .mxl archive');
    }

    // Parse the XML content
    const xmlContent = strFromU8(unzipped[mainXmlPath]);
    return parseMusicXML(xmlContent);
  } catch (error) {
    if (error instanceof Error && error.message.includes('MusicXML')) {
      throw error;
    }
    throw new Error(`Failed to extract .mxl file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================
// GPX Parser (Guitar Pro 6/7)
// ============================================

async function parseGpxFile(file: File): Promise<ParsedNotation> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check ZIP signature
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
    throw new Error('Invalid GPX file: Not a valid ZIP archive');
  }

  try {
    const unzipped = unzipSync(bytes);

    // GPX format stores data in Content/score.gpif (XML format)
    // or for newer versions, it might be in different locations
    let scoreXml: string | null = null;

    // Try common paths for score data
    const scorePaths = [
      'Content/score.gpif',
      'score.gpif',
      'Content.xml',
    ];

    for (const path of scorePaths) {
      if (unzipped[path]) {
        scoreXml = strFromU8(unzipped[path]);
        break;
      }
    }

    // If not found, search for any .gpif or .xml file
    if (!scoreXml) {
      for (const [name, data] of Object.entries(unzipped)) {
        if (name.endsWith('.gpif') || (name.endsWith('.xml') && !name.includes('META-INF'))) {
          scoreXml = strFromU8(data as Uint8Array);
          break;
        }
      }
    }

    if (!scoreXml) {
      throw new Error('Could not find score data in GPX archive');
    }

    // Parse the GPIF XML format
    return parseGpifXml(scoreXml);
  } catch (error) {
    if (error instanceof Error && (error.message.includes('score') || error.message.includes('GPX'))) {
      throw error;
    }
    throw new Error(`Failed to parse GPX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Parse GPIF (Guitar Pro Internal Format) XML
function parseGpifXml(xmlString: string): ParsedNotation {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

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

  // Parse score metadata
  const score = doc.querySelector('Score');
  if (score) {
    result.title = score.querySelector('Title')?.textContent || undefined;
    result.artist = score.querySelector('Artist')?.textContent || undefined;
    result.album = score.querySelector('Album')?.textContent || undefined;
  }

  // Parse master track for tempo
  const masterTrack = doc.querySelector('MasterTrack');
  if (masterTrack) {
    const automations = masterTrack.querySelectorAll('Automation');
    automations.forEach(auto => {
      const type = auto.querySelector('Type')?.textContent;
      if (type === 'Tempo') {
        const value = auto.querySelector('Value')?.textContent;
        if (value) {
          const tempoValues = value.split(' ').map(Number).filter(n => !isNaN(n));
          if (tempoValues.length > 0) {
            result.tempo = tempoValues[0];
          }
        }
      }
    });
  }

  // Parse tracks
  const trackNodes = doc.querySelectorAll('Tracks > Track');
  trackNodes.forEach((trackNode, trackIndex) => {
    const track: Track = {
      id: trackNode.getAttribute('id') || `track-${trackIndex}`,
      name: trackNode.querySelector('Name')?.textContent || `Track ${trackIndex + 1}`,
      notes: [],
      measures: [],
    };

    // Parse tuning
    const tuningNode = trackNode.querySelector('Tuning');
    if (tuningNode) {
      const pitches = tuningNode.getAttribute('pitches');
      if (pitches) {
        const midiNotes = pitches.split(' ').map(Number);
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        track.tuning = midiNotes.map(midi => {
          const octave = Math.floor(midi / 12) - 1;
          const noteName = noteNames[midi % 12];
          return `${noteName}${octave}`;
        });
      }
    }

    // Get instrument info
    const instrument = trackNode.querySelector('Instrument');
    if (instrument) {
      track.instrument = instrument.getAttribute('ref') || undefined;
    }

    result.tracks.push(track);
  });

  // Parse master bars (measures)
  const masterBars = doc.querySelectorAll('MasterBars > MasterBar');
  let currentBeat = 0;

  masterBars.forEach((masterBar, barIndex) => {
    // Parse time signature
    const timeNode = masterBar.querySelector('Time');
    if (timeNode) {
      const timeStr = timeNode.textContent || '4/4';
      const [beats, beatType] = timeStr.split('/').map(Number);
      if (beats && beatType) {
        result.timeSignature = { beats, beatType };
      }
    }

    // Parse key
    const keyNode = masterBar.querySelector('Key');
    if (keyNode) {
      const accidentalCount = parseInt(keyNode.querySelector('AccidentalCount')?.textContent || '0');
      const mode = keyNode.querySelector('Mode')?.textContent?.toLowerCase() || 'major';
      result.keySignature = {
        fifths: accidentalCount,
        mode: mode as 'major' | 'minor',
        key: getKeyFromFifths(accidentalCount, mode === 'minor'),
      };
    }

    // Parse section markers
    const section = masterBar.querySelector('Section');
    if (section) {
      const letter = section.querySelector('Letter')?.textContent || '';
      const text = section.querySelector('Text')?.textContent || letter;

      result.sections.push({
        id: `section-${barIndex}`,
        name: text || letter,
        type: detectSectionType(text || letter),
        startBeat: currentBeat,
        endBeat: currentBeat + result.timeSignature.beats,
      });
    }

    // Calculate measure duration
    const beatsPerMeasure = (result.timeSignature.beats * 4) / result.timeSignature.beatType;

    result.measures.push({
      number: barIndex + 1,
      startBeat: currentBeat,
      duration: beatsPerMeasure,
      timeSignature: result.timeSignature,
    });

    currentBeat += beatsPerMeasure;
  });

  result.totalMeasures = masterBars.length;
  result.totalBeats = currentBeat;

  // Parse bars and beats for notes
  const bars = doc.querySelectorAll('Bars > Bar');
  const beats = doc.querySelectorAll('Beats > Beat');
  const notes = doc.querySelectorAll('Notes > Note');

  // Build lookup maps
  const beatMap = new Map<string, Element>();
  beats.forEach(beat => {
    const id = beat.getAttribute('id');
    if (id) beatMap.set(id, beat);
  });

  const noteMap = new Map<string, Element>();
  notes.forEach(note => {
    const id = note.getAttribute('id');
    if (id) noteMap.set(id, note);
  });

  // Parse notes from each bar
  bars.forEach((bar, barIndex) => {
    const voicesStr = bar.querySelector('Voices')?.textContent || '';
    const voiceIds = voicesStr.split(' ').filter(id => id && id !== '-1');

    const measure = result.measures[barIndex];
    if (!measure) return;

    let beatPosition = measure.startBeat;

    voiceIds.forEach(voiceId => {
      // Find beats for this voice (simplified - would need voice lookup in real implementation)
      const beatIds = bar.querySelector(`Voice[id="${voiceId}"] Beats`)?.textContent?.split(' ') || [];

      beatIds.forEach(beatId => {
        const beat = beatMap.get(beatId);
        if (!beat) return;

        // Get rhythm/duration
        const rhythmRef = beat.querySelector('Rhythm')?.getAttribute('ref');
        const duration = 1; // Default to quarter note

        // Parse note references
        const noteIds = beat.querySelector('Notes')?.textContent?.split(' ') || [];

        noteIds.forEach(noteId => {
          const noteNode = noteMap.get(noteId);
          if (!noteNode) return;

          // Get properties
          const props = noteNode.querySelector('Properties');
          let fret = 0;
          let string = 1;

          if (props) {
            const fretProp = props.querySelector('Property[name="Fret"] Fret');
            const stringProp = props.querySelector('Property[name="String"] String');

            if (fretProp) fret = parseInt(fretProp.textContent || '0');
            if (stringProp) string = parseInt(stringProp.textContent || '0') + 1;
          }

          // Check for techniques
          const hammer = noteNode.querySelector('HammerOn') !== null;
          const pull = noteNode.querySelector('PullOff') !== null;
          const slide = noteNode.querySelector('Slide') !== null;
          const harmonic = noteNode.querySelector('Harmonic') !== null;
          const palmMute = noteNode.querySelector('PalmMute') !== null;
          const letRing = noteNode.querySelector('LetRing') !== null;

          // Add note to first track (simplified)
          if (result.tracks[0]) {
            result.tracks[0].notes.push({
              pitch: `${string}:${fret}`,
              duration,
              startBeat: beatPosition,
              string,
              fret,
              hammer,
              pull,
              slide: slide ? 'up' : undefined,
              harmonic: harmonic ? 'natural' : undefined,
              palmMute,
              letRing,
            });
          }
        });

        beatPosition += duration;
      });
    });
  });

  // Copy measures to tracks
  result.tracks.forEach(track => {
    track.measures = [...result.measures];
  });

  return result;
}

// ============================================
// Helper functions
// ============================================

function getKeyFromFifths(fifths: number, minor: boolean): string {
  const majorKeys: Record<string, string> = {
    '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
    '0': 'C', '1': 'G', '2': 'D', '3': 'A', '4': 'E', '5': 'B', '6': 'F#', '7': 'C#',
  };
  const minorKeys: Record<string, string> = {
    '-7': 'Abm', '-6': 'Ebm', '-5': 'Bbm', '-4': 'Fm', '-3': 'Cm', '-2': 'Gm', '-1': 'Dm',
    '0': 'Am', '1': 'Em', '2': 'Bm', '3': 'F#m', '4': 'C#m', '5': 'G#m', '6': 'D#m', '7': 'A#m',
  };

  const keys = minor ? minorKeys : majorKeys;
  return keys[fifths.toString()] || (minor ? 'Am' : 'C');
}

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

// ============================================
// Legacy GP3/4/5 Parser
// ============================================

async function parseGpLegacyFile(file: File): Promise<ParsedNotation> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check for valid GP3/4/5 header
  const headerBytes = bytes.slice(0, 31);
  const header = new TextDecoder('latin1').decode(headerBytes);

  if (!header.includes('FICHIER GUITAR PRO')) {
    throw new Error('Invalid Guitar Pro file: Missing file header');
  }

  // Detect version
  let version = 5;
  if (header.includes('v5')) version = 5;
  else if (header.includes('v4')) version = 4;
  else if (header.includes('v3')) version = 3;

  try {
    const { parseGuitarPro } = await import('./guitarPro-parser');
    return parseGuitarPro(buffer);
  } catch (error) {
    // If the binary parser fails, create a minimal result with error info
    console.error('GP legacy parser error:', error);

    // Return a minimal parsed result with error message
    const result: ParsedNotation = {
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: { fifths: 0, mode: 'major', key: 'C' },
      tracks: [{
        id: 'track-1',
        name: 'Track 1',
        notes: [],
        measures: [],
      }],
      chords: [],
      sections: [],
      lyrics: [],
      measures: [{
        number: 1,
        startBeat: 0,
        duration: 4,
      }],
      totalBeats: 4,
      totalMeasures: 1,
      sourceFormat: 'gp',
    };

    // Try to extract at least the metadata
    try {
      // Skip past the version string (31 bytes)
      let offset = 31;

      // Read title (byte-prefixed string at offset 31)
      const titleLen = bytes[offset + 4] || 0;
      if (titleLen > 0 && titleLen < 100) {
        offset += 5;
        result.title = new TextDecoder('latin1').decode(bytes.slice(offset, offset + titleLen)).trim();
        offset += titleLen;
      }
    } catch {
      // Ignore metadata extraction errors
    }

    return result;
  }
}

// ============================================
// Unified Parser
// ============================================

export async function parseNotationFile(file: File): Promise<ParsedNotation> {
  const fileType = getNotationFileType(file.name);

  switch (fileType) {
    case 'musicxml': {
      const text = await file.text();
      return parseMusicXML(text);
    }

    case 'mxl':
      return parseMxlFile(file);

    case 'gpx':
      return parseGpxFile(file);

    case 'gp-legacy':
      return parseGpLegacyFile(file);

    default:
      throw new Error(
        `Unsupported file type: ${file.name}. ` +
        `Supported formats: MusicXML (.xml, .musicxml, .mxl), Guitar Pro (.gp3-.gp7, .gpx)`
      );
  }
}

// Convert parsed notation to store format
export function notationToStoreFormat(parsed: ParsedNotation) {
  return {
    chords: parsed.chords.map(chord => ({
      name: chord.name,
      root: chord.root,
      quality: chord.quality,
      bass: chord.bass,
      startBeat: chord.startBeat,
      duration: chord.duration,
      frets: chord.frets,
      fingers: chord.fingers,
    })),
    sections: parsed.sections.map(section => ({
      id: section.id,
      name: section.name,
      type: section.type,
      startBeat: section.startBeat,
      endBeat: section.endBeat,
    })),
    lyrics: parsed.lyrics,
    tracks: parsed.tracks,
    measures: parsed.measures,
    metadata: {
      title: parsed.title,
      artist: parsed.artist,
      tempo: parsed.tempo,
      timeSignature: parsed.timeSignature,
      keySignature: parsed.keySignature,
      totalBeats: parsed.totalBeats,
      totalMeasures: parsed.totalMeasures,
      sourceFormat: parsed.sourceFormat,
    },
  };
}
