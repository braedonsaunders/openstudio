// Notation parsing utilities
export * from './types';
export { parseMusicXML, parseMusicXMLFile } from './musicxml-parser';
export { parseGuitarPro, parseGuitarProFile } from './guitarPro-parser';

import type { ParsedNotation } from './types';
import { parseMusicXMLFile } from './musicxml-parser';
import { parseGuitarProFile } from './guitarPro-parser';

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
export function getNotationFileType(filename: string): 'musicxml' | 'gp' | 'unknown' {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();

  if (['.xml', '.musicxml', '.mxl'].includes(ext)) {
    return 'musicxml';
  }

  if (['.gp', '.gp3', '.gp4', '.gp5', '.gpx', '.gp7'].includes(ext)) {
    return 'gp';
  }

  return 'unknown';
}

// Unified parser that detects file type
export async function parseNotationFile(file: File): Promise<ParsedNotation> {
  const fileType = getNotationFileType(file.name);

  switch (fileType) {
    case 'musicxml':
      return parseMusicXMLFile(file);
    case 'gp':
      return parseGuitarProFile(file);
    default:
      throw new Error(`Unsupported file type: ${file.name}`);
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
