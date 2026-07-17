// Pure media-type detection via extension map + magic-byte sniff (Story 4.6).
// Unknown types return `application/octet-stream`. No fs/network/Date/random.

import { extname } from 'node:path';

// --- Extension-to-media-type map ---

export const EXTENSION_MAP: Record<string, string> = {
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',

  // Audio
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',

  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',

  // Text / code
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.toml': 'text/toml',
  '.ini': 'text/plain',
  '.cfg': 'text/plain',
  '.conf': 'text/plain',

  // Source code
  '.ts': 'text/plain',
  '.tsx': 'text/plain',
  '.js': 'text/plain',
  '.jsx': 'text/plain',
  '.py': 'text/plain',
  '.rs': 'text/plain',
  '.go': 'text/plain',
  '.java': 'text/plain',
  '.c': 'text/plain',
  '.cpp': 'text/plain',
  '.h': 'text/plain',
  '.hpp': 'text/plain',
  '.css': 'text/plain',
  '.scss': 'text/plain',
  '.less': 'text/plain',
  '.sh': 'text/plain',
  '.bash': 'text/plain',
  '.zsh': 'text/plain',
  '.fish': 'text/plain',
  '.ps1': 'text/plain',
  '.bat': 'text/plain',
  '.cmd': 'text/plain',
  '.sql': 'text/plain',
  '.rb': 'text/plain',
  '.php': 'text/plain',
  '.swift': 'text/plain',
  '.kt': 'text/plain',
  '.dart': 'text/plain',
  '.lua': 'text/plain',
  '.r': 'text/plain',
  '.pl': 'text/plain',
  '.pm': 'text/plain',

  // Documents
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',

  // Archives
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.bz2': 'application/x-bzip2',
  '.xz': 'application/x-xz',
  '.7z': 'application/x-7z-compressed',
  '.rar': 'application/vnd.rar',
};

// --- Known media types set ---

export const KNOWN_MEDIA_TYPES: ReadonlySet<string> = new Set(Object.values(EXTENSION_MAP));

// --- Magic-byte signatures ---

interface MagicSignature {
  readonly offset: number;
  readonly bytes: readonly number[];
  readonly mediaType: string;
}

const MAGIC_SIGNATURES: readonly MagicSignature[] = [
  // PNG: 89 50 4E 47
  { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47], mediaType: 'image/png' },
  // JPEG: FF D8 FF
  { offset: 0, bytes: [0xff, 0xd8, 0xff], mediaType: 'image/jpeg' },
  // PDF: 25 50 44 46
  { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46], mediaType: 'application/pdf' },
  // GIF: 47 49 46 (GIF8)
  { offset: 0, bytes: [0x47, 0x49, 0x46], mediaType: 'image/gif' },
  // BMP: 42 4D
  { offset: 0, bytes: [0x42, 0x4d], mediaType: 'image/bmp' },
  // TIFF (little-endian): 49 49 2A 00
  { offset: 0, bytes: [0x49, 0x49, 0x2a, 0x00], mediaType: 'image/tiff' },
  // TIFF (big-endian): 4D 4D 00 2A
  { offset: 0, bytes: [0x4d, 0x4d, 0x00, 0x2a], mediaType: 'image/tiff' },
  // Office ZIP (docx/xlsx/pptx): 50 4B 03 04
  { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04], mediaType: 'application/zip' },
  // WebP: RIFF .... WEBP
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46], mediaType: 'image/webp' },
];

/**
 * Detect the media type of a file from its path extension and optional content
 * bytes. Extension-based detection is tried first; if the extension is unknown
 * or maps to `application/octet-stream`, a magic-byte sniff is attempted.
 *
 * Returns the detected media type string, or `application/octet-stream` when
 * neither extension nor magic bytes yield a known type.
 */
export function detectMediaType(path: string, bytes?: Uint8Array): string {
  // Extension-based detection.
  const ext = extname(path).toLowerCase();
  const fromExt = EXTENSION_MAP[ext];
  if (fromExt) {
    return fromExt;
  }

  // Magic-byte sniff fallback.
  if (bytes && bytes.length > 0) {
    for (const sig of MAGIC_SIGNATURES) {
      if (bytes.length < sig.offset + sig.bytes.length) continue;
      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (bytes[sig.offset + i] !== sig.bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return sig.mediaType;
      }
    }
  }

  return 'application/octet-stream';
}

/**
 * Check whether a media type is text-like (decodable as UTF-8 text).
 */
export function isTextLike(mediaType: string): boolean {
  return (
    mediaType.startsWith('text/') ||
    mediaType === 'application/json' ||
    mediaType === 'application/csv' ||
    mediaType === 'application/xml' ||
    mediaType === 'text/markdown' ||
    mediaType === 'text/csv' ||
    mediaType === 'text/xml'
  );
}
