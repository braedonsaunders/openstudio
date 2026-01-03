// Notation parsing utilities
export * from './types';
export { parseMusicXML, parseMusicXMLFile } from './musicxml-parser';
export { parseGuitarPro, parseGuitarProFile } from './guitarPro-parser';

import type { ParsedNotation } from './types';
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
export function getNotationFileType(filename: string): 'musicxml' | 'mxl' | 'gp' | 'unknown' {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();

  if (['.xml', '.musicxml'].includes(ext)) {
    return 'musicxml';
  }

  if (ext === '.mxl') {
    return 'mxl'; // Compressed MusicXML
  }

  if (['.gp', '.gp3', '.gp4', '.gp5', '.gpx', '.gp7'].includes(ext)) {
    return 'gp';
  }

  return 'unknown';
}

// Parse compressed MusicXML (.mxl) file
async function parseMxlFile(file: File): Promise<ParsedNotation> {
  // .mxl files are ZIP archives containing XML files
  // The main content is usually in "META-INF/container.xml" which points to the root file
  // or directly in a file like "*.xml" at the root

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check ZIP signature
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
    throw new Error('Invalid .mxl file: Not a valid ZIP archive');
  }

  // Use JSZip if available, otherwise provide helpful error
  if (typeof window !== 'undefined') {
    // Try to dynamically import JSZip
    try {
      // For now, provide a helpful error message
      // A full implementation would use JSZip to extract the XML
      throw new Error(
        'Compressed MusicXML (.mxl) files require extraction. ' +
        'Please export as uncompressed MusicXML (.xml) from your notation software, ' +
        'or use a tool like MuseScore to convert the file.'
      );
    } catch {
      throw new Error(
        'Compressed MusicXML (.mxl) files are not yet supported. ' +
        'Please export as uncompressed MusicXML (.xml or .musicxml) instead.'
      );
    }
  }

  throw new Error('MXL parsing not supported in this environment');
}

// Parse Guitar Pro file with better error handling
async function parseGuitarProWithFallback(file: File): Promise<ParsedNotation> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check for GPX format (ZIP-based, used in GP6+)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
    throw new Error(
      'Guitar Pro 6/7 format (.gpx/.gp7) uses a compressed format that requires additional processing. ' +
      'Please export as Guitar Pro 5 (.gp5) or MusicXML from your notation software.'
    );
  }

  // Check for valid GP3/4/5 header
  const headerBytes = bytes.slice(0, 31);
  const header = new TextDecoder('latin1').decode(headerBytes);

  if (!header.includes('FICHIER GUITAR PRO')) {
    throw new Error(
      'Invalid Guitar Pro file format. ' +
      'Please ensure you are using a valid .gp3, .gp4, or .gp5 file.'
    );
  }

  // Try to parse with the GP parser
  try {
    const { parseGuitarPro } = await import('./guitarPro-parser');
    return parseGuitarPro(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Provide helpful error messages
    if (message.includes('bounds') || message.includes('DataView') || message.includes('length')) {
      throw new Error(
        'Unable to parse this Guitar Pro file. The file format may be corrupted or use an unsupported variation. ' +
        'Try exporting as MusicXML from your notation software instead.'
      );
    }

    throw new Error(`Guitar Pro parsing failed: ${message}`);
  }
}

// Unified parser that detects file type
export async function parseNotationFile(file: File): Promise<ParsedNotation> {
  const fileType = getNotationFileType(file.name);

  switch (fileType) {
    case 'musicxml': {
      try {
        const text = await file.text();
        return parseMusicXML(text);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('Start tag expected')) {
          throw new Error(
            'Invalid MusicXML file. The file appears to be corrupted or not in XML format. ' +
            'If this is a compressed .mxl file, please rename it with the .mxl extension.'
          );
        }
        throw error;
      }
    }

    case 'mxl':
      return parseMxlFile(file);

    case 'gp':
      return parseGuitarProWithFallback(file);

    default:
      throw new Error(
        `Unsupported file type: ${file.name}. ` +
        `Supported formats: MusicXML (.xml, .musicxml), Guitar Pro (.gp3, .gp4, .gp5)`
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
