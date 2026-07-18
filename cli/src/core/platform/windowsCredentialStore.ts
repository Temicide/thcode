import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { CredentialId, CredentialStore, CredentialStoreAvailability } from './credentialStore.js';
import { credentialsDir } from './paths.js';

/**
 * Windows credential backing for BYOK secrets (ADR 0007/0008).
 *
 * CHOICE (documented per task requirement): rather than shelling `cmdkey`
 * (which cannot read a stored password back without a native CredRead P/Invoke),
 * we store each secret as a **DPAPI-encrypted file** under
 * `%LOCALAPPDATA%\thcode\credentials\<id>.cred`. Encryption uses PowerShell 7's
 * `ConvertFrom-SecureString` (CurrentUser DPAPI scope) and decryption uses
 * `ConvertTo-SecureString`. This needs no native npm dependency, ties the
 * ciphertext to the current OS user, and keeps everything behind the
 * CredentialStore interface so a macOS Keychain / Linux Secret Service adapter
 * can replace it later.
 *
 * Secrets are passed to PowerShell over stdin (never argv) and are never logged.
 */
export class WindowsCredentialStore implements CredentialStore {
  private readonly dir: string;
  private readonly shell: string;

  constructor(dir: string = credentialsDir()) {
    this.dir = dir;
    this.shell = 'pwsh.exe';
  }

  private fileFor(id: CredentialId): string {
    // Sanitize id to a safe filename; ids are internal (provider names / DEK id).
    const safe = id.replace(/[^A-Za-z0-9_.-]/g, '_');
    return path.join(this.dir, `${safe}.cred`);
  }

  async has(id: CredentialId): Promise<boolean> {
    return existsSync(this.fileFor(id));
  }

  async get(id: CredentialId): Promise<string | null> {
    const file = this.fileFor(id);
    if (!existsSync(file)) return null;
    const enc = await readFile(file, 'utf8');
    const script = [
      '$enc = [Console]::In.ReadToEnd()',
      '$sec = ConvertTo-SecureString $enc',
      '$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)',
      'try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }',
      'finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }',
    ].join('; ');
    const out = await this.runPwsh(script, enc);
    return out.replace(/\r?\n$/, '');
  }

  async set(id: CredentialId, secret: string): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const file = this.fileFor(id);
    const script = [
      '$plain = [Console]::In.ReadToEnd()',
      '$enc = ConvertTo-SecureString -String $plain -AsPlainText -Force | ConvertFrom-SecureString',
      '[Console]::Out.Write($enc)',
    ].join('; ');
    const enc = await this.runPwsh(script, secret);
    await writeFile(file, enc, { encoding: 'utf8', mode: 0o600 });
  }

  async delete(id: CredentialId): Promise<void> {
    await rm(this.fileFor(id), { force: true });
  }

  availability(): CredentialStoreAvailability {
    // Non-mutating: the backing is DPAPI-file under pwsh.exe. We do not check
    // pwsh availability here (that is the shell probe's job); we only declare
    // the backend kind. If pwsh is missing, set/get will surface a typed error
    // at first real use — preflight never writes a credential.
    return { kind: 'ok', backend: 'windows-dpapi' };
  }

  private runPwsh(script: string, stdin: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const child = spawn(
        this.shell,
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { windowsHide: true },
      );
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => (out += d.toString()));
      child.stderr.on('data', (d) => (err += d.toString()));
      child.on('error', (e) =>
        reject(new Error(`CredentialStore requires PowerShell 7 (pwsh.exe): ${e.message}`)),
      );
      child.on('close', (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(`CredentialStore pwsh failed (exit ${code}): ${err.trim()}`));
      });
      child.stdin.write(stdin);
      child.stdin.end();
    });
  }
}
