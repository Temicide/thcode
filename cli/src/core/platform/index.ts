import { InMemoryCredentialStore, type CredentialStore } from './credentialStore.js';
import { WindowsCredentialStore } from './windowsCredentialStore.js';

export * from './credentialStore.js';
export * from './paths.js';
export { WindowsCredentialStore } from './windowsCredentialStore.js';

/**
 * Select the platform CredentialStore. Windows uses the DPAPI-file adapter;
 * other platforms currently fall back to an in-memory store with a TODO for
 * native Keychain / Secret Service adapters (ADR 0008 deferred).
 */
export function createCredentialStore(): CredentialStore {
  if (process.platform === 'win32') {
    return new WindowsCredentialStore();
  }
  // TODO(platform-macos): macOS Keychain adapter.
  // TODO(platform-linux): Secret Service adapter.
  return new InMemoryCredentialStore();
}
