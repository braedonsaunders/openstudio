import type {
  ParsedNotation,
  Note,
  ChordSymbol,
  Measure,
  Track,
  TimeSignature,
  KeySignature,
  Section,
  LyricLine,
} from './types';

// ============================================
// MusicXML Parser
// ============================================

// Key signature fifths to key name mapping
const FIFTHS_TO_KEY: Record<string, { major: string; minor: string }> = {
  '-7': { major: 'Cb', minor: 'Abm' },
  '-6': { major: 'Gb', minor: 'Ebm' },
  '-5': { major: 'Db', minor: 'Bbm' },
  '-4': { major: 'Ab', minor: 'Fm' },
  '-3': { major: 'Eb', minor: 'Cm' },
  '-2': { major: 'Bb', minor: 'Gm' },
  '-1': { major: 'F', minor: 'Dm' },
  '0': { major: 'C', minor: 'Am' },
  '1': { major: 'G', minor: 'Em' },
  '2': { major: 'D', minor: 'Bm' },
  '3': { major: 'A', minor: 'F#m' },
  '4': { major: 'E', minor: 'C#m' },
  '5': { major: 'B', minor: 'G#m' },
  '6': { major: 'F#', minor: 'D#m' },
  '7': { major: 'C#', minor: 'A#m' },
};

// Parse pitch from MusicXML pitch element
function parsePitch(pitchEl: Element): string {
  const step = pitchEl.querySelector('step')?.textContent || 'C';
  const octave = pitchEl.querySelector('octave')?.textContent || '4';
  const alter = pitchEl.querySelector('alter')?.textContent;

  let accidental = '';
  if (alter) {
    const alterNum = parseInt(alter);
    if (alterNum === 1) accidental = '#';
    else if (alterNum === -1) accidental = 'b';
    else if (alterNum === 2) accidental = '##';
    else if (alterNum === -2) accidental = 'bb';
  }

  return `${step}${accidental}${octave}`;
}

// Parse duration from MusicXML note
function parseDuration(noteEl: Element, divisions: number): number {
  const durationEl = noteEl.querySelector('duration');
  if (!durationEl) return 1;

  const duration = parseInt(durationEl.textContent || '1');
  // Convert to beats (quarter notes)
  return duration / divisions;
}

// Parse technical elements (for guitar tablature)
function parseTechnical(noteEl: Element): Partial<Note> {
  const technical = noteEl.querySelector('technical');
  if (!technical) return {};

  const result: Partial<Note> = {};

  const stringEl = technical.querySelector('string');
  if (stringEl) result.string = parseInt(stringEl.textContent || '1');

  const fretEl = technical.querySelector('fret');
  if (fretEl) result.fret = parseInt(fretEl.textContent || '0');

  const hammerOn = technical.querySelector('hammer-on');
  if (hammerOn) result.hammer = true;

  const pullOff = technical.querySelector('pull-off');
  if (pullOff) result.pull = true;

  const bend = technical.querySelector('bend');
  if (bend) {
    const bendAlter = bend.querySelector('bend-alter');
    if (bendAlter) result.bend = parseFloat(bendAlter.textContent || '0');
  }

  const harmonic = technical.querySelector('harmonic');
  if (harmonic) {
    result.harmonic = harmonic.querySelector('natural') ? 'natural' : 'artificial';
  }

  return result;
}

// Parse harmony (chord symbols)
function parseHarmony(harmonyEl: Element, currentBeat: number): ChordSymbol | null {
  const root = harmonyEl.querySelector('root');
  if (!root) return null;

  const rootStep = root.querySelector('root-step')?.textContent || 'C';
  const rootAlter = root.querySelector('root-alter')?.textContent;

  let rootName = rootStep;
  if (rootAlter) {
    const alterNum = parseInt(rootAlter);
    if (alterNum === 1) rootName += '#';
    else if (alterNum === -1) rootName += 'b';
  }

  // Parse chord kind
  const kind = harmonyEl.querySelector('kind')?.textContent || 'major';
  let quality = '';

  switch (kind) {
    case 'major': quality = ''; break;
    case 'minor': quality = 'm'; break;
    case 'dominant': quality = '7'; break;
    case 'major-seventh': quality = 'maj7'; break;
    case 'minor-seventh': quality = 'm7'; break;
    case 'diminished': quality = 'dim'; break;
    case 'augmented': quality = 'aug'; break;
    case 'suspended-second': quality = 'sus2'; break;
    case 'suspended-fourth': quality = 'sus4'; break;
    case 'dominant-ninth': quality = '9'; break;
    case 'major-ninth': quality = 'maj9'; break;
    case 'minor-ninth': quality = 'm9'; break;
    default: quality = kind;
  }

  // Parse bass note
  const bass = harmonyEl.querySelector('bass');
  let bassNote: string | undefined;
  if (bass) {
    const bassStep = bass.querySelector('bass-step')?.textContent;
    const bassAlter = bass.querySelector('bass-alter')?.textContent;
    if (bassStep) {
      bassNote = bassStep;
      if (bassAlter) {
        const alterNum = parseInt(bassAlter);
        if (alterNum === 1) bassNote += '#';
        else if (alterNum === -1) bassNote += 'b';
      }
    }
  }

  return {
    name: `${rootName}${quality}`,
    root: rootName,
    quality,
    bass: bassNote,
    startBeat: currentBeat,
    duration: 4, // Default to 1 measure
  };
}

// Main parser function
export function parseMusicXML(xmlString: string): ParsedNotation {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid MusicXML: ' + parserError.textContent);
  }

  // Initialize result
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
    sourceFormat: 'musicxml',
  };

  // Get score-partwise (most common format)
  const scorePart = doc.querySelector('score-partwise') || doc.querySelector('score-timewise');
  if (!scorePart) {
    throw new Error('No valid MusicXML score found');
  }

  // Parse work/movement titles
  const workTitle = doc.querySelector('work-title')?.textContent;
  const movementTitle = doc.querySelector('movement-title')?.textContent;
  result.title = workTitle || movementTitle;

  // Parse identification
  const creator = doc.querySelector('identification creator[type="composer"]');
  if (creator) result.artist = creator.textContent || undefined;

  // Parse parts list
  const partList = doc.querySelector('part-list');
  const partMap = new Map<string, { name: string; instrument?: string }>();

  if (partList) {
    partList.querySelectorAll('score-part').forEach((scorePart) => {
      const id = scorePart.getAttribute('id') || '';
      const name = scorePart.querySelector('part-name')?.textContent || 'Unknown';
      const instrument = scorePart.querySelector('instrument-name')?.textContent || undefined;
      partMap.set(id, { name, instrument });
    });
  }

  // Parse each part
  const parts = doc.querySelectorAll('part');
  parts.forEach((part, partIndex) => {
    const partId = part.getAttribute('id') || `part-${partIndex}`;
    const partInfo = partMap.get(partId) || { name: `Track ${partIndex + 1}` };

    const track: Track = {
      id: partId,
      name: partInfo.name,
      instrument: partInfo.instrument,
      notes: [],
      measures: [],
    };

    let currentBeat = 0;
    let divisions = 1; // Divisions per quarter note
    let measureNumber = 0;

    // Parse measures
    part.querySelectorAll('measure').forEach((measureEl) => {
      measureNumber++;
      const measureStartBeat = currentBeat;

      // Parse attributes (time signature, key, divisions)
      const attributes = measureEl.querySelector('attributes');
      if (attributes) {
        const divisionsEl = attributes.querySelector('divisions');
        if (divisionsEl) {
          divisions = parseInt(divisionsEl.textContent || '1');
        }

        const timeEl = attributes.querySelector('time');
        if (timeEl) {
          const beats = parseInt(timeEl.querySelector('beats')?.textContent || '4');
          const beatType = parseInt(timeEl.querySelector('beat-type')?.textContent || '4');
          result.timeSignature = { beats, beatType };
        }

        const keyEl = attributes.querySelector('key');
        if (keyEl) {
          const fifths = parseInt(keyEl.querySelector('fifths')?.textContent || '0');
          const mode = keyEl.querySelector('mode')?.textContent === 'minor' ? 'minor' : 'major';
          const keyInfo = FIFTHS_TO_KEY[fifths.toString()] || { major: 'C', minor: 'Am' };
          result.keySignature = {
            fifths,
            mode,
            key: mode === 'minor' ? keyInfo.minor : keyInfo.major,
          };
        }
      }

      // Parse direction (tempo, dynamics)
      measureEl.querySelectorAll('direction').forEach((direction) => {
        const sound = direction.querySelector('sound');
        if (sound) {
          const tempo = sound.getAttribute('tempo');
          if (tempo) result.tempo = parseFloat(tempo);
        }
      });

      // Parse harmony (chord symbols)
      measureEl.querySelectorAll('harmony').forEach((harmonyEl) => {
        const chord = parseHarmony(harmonyEl, currentBeat);
        if (chord) result.chords.push(chord);
      });

      // Parse notes
      measureEl.querySelectorAll('note').forEach((noteEl) => {
        // Skip rests
        if (noteEl.querySelector('rest')) {
          const duration = parseDuration(noteEl, divisions);
          if (!noteEl.querySelector('chord')) {
            currentBeat += duration;
          }
          return;
        }

        // Parse pitch
        const pitchEl = noteEl.querySelector('pitch');
        if (!pitchEl) return;

        const pitch = parsePitch(pitchEl);
        const duration = parseDuration(noteEl, divisions);
        const isChord = noteEl.querySelector('chord') !== null;

        // If it's a chord note, don't advance the beat
        const noteStartBeat = isChord ? currentBeat - duration : currentBeat;

        const note: Note = {
          pitch,
          duration,
          startBeat: noteStartBeat,
          ...parseTechnical(noteEl),
        };

        // Parse tie
        const tie = noteEl.querySelector('tie[type="stop"]');
        if (tie) note.tied = true;

        // Parse articulations
        const articulations = noteEl.querySelector('articulations');
        if (articulations) {
          if (articulations.querySelector('accent')) note.accent = true;
          if (articulations.querySelector('staccato')) note.staccato = true;
        }

        track.notes.push(note);

        // Advance beat (only for non-chord notes)
        if (!isChord) {
          currentBeat += duration;
        }
      });

      // Parse lyrics
      measureEl.querySelectorAll('note lyric').forEach((lyricEl) => {
        const text = lyricEl.querySelector('text')?.textContent;
        const syllabic = lyricEl.querySelector('syllabic')?.textContent;

        if (text) {
          // Handle syllabic (single, begin, middle, end)
          const displayText = syllabic === 'begin' || syllabic === 'middle'
            ? text + '-'
            : text;

          result.lyrics.push({
            text: displayText,
            startBeat: measureStartBeat,
            endBeat: currentBeat,
          });
        }
      });

      // Calculate measure duration
      const beatsPerMeasure = (result.timeSignature.beats * 4) / result.timeSignature.beatType;
      const measureDuration = currentBeat - measureStartBeat || beatsPerMeasure;

      // Check for repeats
      const barline = measureEl.querySelector('barline');
      let repeatStart = false;
      let repeatEnd = false;
      let repeatCount = 1;

      if (barline) {
        const repeat = barline.querySelector('repeat');
        if (repeat) {
          const direction = repeat.getAttribute('direction');
          repeatStart = direction === 'forward';
          repeatEnd = direction === 'backward';
          const times = repeat.getAttribute('times');
          if (times) repeatCount = parseInt(times);
        }
      }

      track.measures.push({
        number: measureNumber,
        startBeat: measureStartBeat,
        duration: measureDuration,
        repeatStart,
        repeatEnd,
        repeatCount,
      });
    });

    result.tracks.push(track);
    result.totalBeats = Math.max(result.totalBeats, currentBeat);
    result.totalMeasures = Math.max(result.totalMeasures, measureNumber);
  });

  // Copy measures from first track to global measures
  if (result.tracks.length > 0) {
    result.measures = [...result.tracks[0].measures];
  }

  // Try to detect sections from rehearsal marks
  doc.querySelectorAll('direction-type rehearsal').forEach((rehearsal) => {
    const text = rehearsal.textContent || '';
    const direction = rehearsal.closest('direction');
    const measure = direction?.closest('measure');
    const measureNumber = measure?.getAttribute('number');

    if (measureNumber && result.measures.length > 0) {
      const measureIdx = parseInt(measureNumber) - 1;
      const measureData = result.measures[measureIdx];

      if (measureData) {
        const sectionType = text.toLowerCase().includes('verse') ? 'verse'
          : text.toLowerCase().includes('chorus') ? 'chorus'
          : text.toLowerCase().includes('bridge') ? 'bridge'
          : text.toLowerCase().includes('intro') ? 'intro'
          : text.toLowerCase().includes('outro') ? 'outro'
          : text.toLowerCase().includes('solo') ? 'solo'
          : 'custom';

        result.sections.push({
          id: `section-${result.sections.length}`,
          name: text,
          type: sectionType,
          startBeat: measureData.startBeat,
          endBeat: measureData.startBeat + measureData.duration,
        });
      }
    }
  });

  return result;
}

// Parse from File object
export async function parseMusicXMLFile(file: File): Promise<ParsedNotation> {
  const text = await file.text();
  return parseMusicXML(text);
}
