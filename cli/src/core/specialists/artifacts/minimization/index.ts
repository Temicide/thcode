// Minimization barrel export (Story 4.7).

export type {
  MinimizationResult,
  ArtifactMinimizer,
  ArtifactMinimizerRegistry,
} from './types.js';

export { TextMinimizer, countGraphemes, truncateTextAtGrapheme } from './textMinimizer.js';
export { ImageMinimizer, parseImageDimensions } from './imageMinimizer.js';
export { AudioMinimizer } from './audioMinimizer.js';
export {
  createDefaultMinimizerRegistry,
  minimizeArtifact,
} from './registry.js';
