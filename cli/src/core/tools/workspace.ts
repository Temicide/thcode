import path from 'node:path';

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
 * Returns the absolute, normalized path on success; throws WorkspaceBoundaryError
 * otherwise. UNC and macOS/Linux specifics are handled by the platform's own
 * `path` implementation.
 */
export function resolveWithinWorkspace(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, candidate);
  const rel = path.relative(resolvedRoot, resolved);

  const escapes =
    rel === '..' ||
    rel.startsWith(`..${path.sep}`) ||
    path.isAbsolute(rel); // different drive / UNC root => absolute relative path

  if (escapes) {
    throw new WorkspaceBoundaryError(candidate, resolvedRoot);
  }
  return resolved;
}
