import path from 'node:path';
import os from 'node:os';

// Native user-state location for thcode data (ADR 0017):
//   Windows: %LOCALAPPDATA%\thcode
//   macOS:   ~/Library/Application Support/thcode   (deferred)
//   Linux:   $XDG_STATE_HOME/thcode with home fallback (deferred)
export function thcodeStateDir(): string {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'thcode');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'thcode');
  }
  const xdg = process.env.XDG_STATE_HOME ?? path.join(os.homedir(), '.local', 'state');
  return path.join(xdg, 'thcode');
}

export function credentialsDir(): string {
  return path.join(thcodeStateDir(), 'credentials');
}

export function sessionsDbPath(): string {
  return path.join(thcodeStateDir(), 'sessions.db');
}
