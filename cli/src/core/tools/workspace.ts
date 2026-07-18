import { pathFor, platformForRoot } from '../workspace/platformPath.js';

/**
 * Raised when a requested path resolves outside the session Workspace Binding.
 * (ADR 0008: "Resolve the workspace boundary before permitting file operations.")
 */
export class WorkspaceBoundaryError extends Error {
  constructor(candidate: string, root: string) {
    super(`Path escapes workspace boundary: ${candidate} is outside ${root}`);
    this.name = 'WorkspaceBoundaryError';
  }
}

/**
 * Resolve `candidate` against the workspace `root` and guarantee the result is
 * inside the workspace. Handles Windows drive letters, backslashes, spaces, and
 * case-insensitive comparison (Node's win32 path.relative is case-folding),
 * plus `..` traversal and cross-drive absolute escapes.
 *
 * `platform` selects the path flavor; when omitted it is inferred from the shape
 * of `root` (see platformForRoot) so a POSIX-rooted workspace resolves with POSIX
 * separators and a Windows-rooted one with backslashes, regardless of host OS.
 * The path separator is governed by the root's shape, not by the workspace's
 * declared case/Unicode platform probe.
 *
 * Returns the absolute, normalized path on success; throws WorkspaceBoundaryError
 * otherwise. UNC and macOS/Linux specifics are handled by the platform's own
 * `path` implementation.
 */
export function resolveWithinWorkspace(
  root: string,
  candidate: string,
  platform: string | undefined = platformForRoot(root),
): string {
  const p = pathFor(platform);
  const resolvedRoot = p.resolve(root);
  const resolved = p.resolve(resolvedRoot, candidate);
  const rel = p.relative(resolvedRoot, resolved);

  const escapes =
    rel === '..' ||
    rel.startsWith(`..${p.sep}`) ||
    p.isAbsolute(rel); // different drive / UNC root => absolute relative path

  if (escapes) {
    throw new WorkspaceBoundaryError(candidate, resolvedRoot);
  }
  return resolved;
}
