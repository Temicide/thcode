// Platform-aware path selection. thcode is Windows-first (ADR 0008) but its
// containment/inspection/effect logic must be governed by the *workspace's
// declared platform*, not the host OS that happens to run the process. A
// WorkspaceIdentity carries `platform.platform` ('win32' | 'darwin' | 'linux' |
// …); path math against `canonicalRoot` must use the matching separator/drive
// semantics or a POSIX-rooted test fixture breaks on a Windows host (and vice
// versa). In production host === declared platform, so this is a no-op there.

import path from 'node:path';

/**
 * Return the `path` submodule matching a declared platform.
 * - `'win32'` → `path.win32` (backslashes, drive letters, case-fold)
 * - `'darwin'` / `'linux'` → `path.posix` (forward slashes)
 * - unknown / undefined → host `node:path` (production default)
 *
 * ponytail: string switch, not a registry — three platforms is the whole set.
 */
export function pathFor(platform?: string): path.PlatformPath {
  switch (platform) {
    case 'win32':
      return path.win32;
    case 'darwin':
    case 'linux':
      return path.posix;
    default:
      return path;
  }
}

/**
 * Infer a platform tag from the shape of an already-canonical root path, for the
 * rare call site that holds only the root string and not a WorkspaceIdentity
 * (e.g. the specialist artifact resolver). A Windows drive-letter or backslash
 * root is `win32`; a leading-slash root is a POSIX platform; anything else falls
 * back to the host. Prefer passing an explicit platform where one is available.
 */
export function platformForRoot(root: string): NodeJS.Platform | undefined {
  // POSIX absolute first: a leading slash is unambiguous, and backslash is a
  // legal filename char on POSIX, so don't let a stray '\' misclassify it.
  if (root.startsWith('/')) return 'linux';
  if (/^[a-zA-Z]:[\\/]/.test(root) || root.includes('\\')) return 'win32';
  return undefined;
}
