// File effects barrel export (Story 3.5, Story 3.6).

export * from './types.js';
export { previewFileEffect } from './preview.js';
export { applyFileEffect } from './fileEffect.js';
export type { FileEffectContext } from './fileEffect.js';
export { revalidateFileEffect } from './revalidate.js';
export type { FileEffectStaleResult } from './revalidate.js';
export { detectConflict } from './conflict.js';
export type { ConflictDetectionInput } from './conflict.js';

// Story 3.6: Guarded destructive deletion with quarantine
export * from './deletionTypes.js';
export { previewDeletion } from './deletionPreview.js';
export { applyDeletionEffect } from './deletionEffect.js';
export type { DeletionEffectContext } from './deletionTypes.js';
