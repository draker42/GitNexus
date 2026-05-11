/**
 * GDSCript import resolution config.
 * Require/require_relative suffix matching — no standard fallback.
 */

import { SupportedLanguages } from 'gitnexus-shared';
import type { ImportResolutionConfig, ImportResolverStrategy } from '../types.js';
import { suffixResolve } from '../utils.js';


/** GDScript require/require_relative resolution strategy. */
// export const gdscriptRequireStrategy: ImportResolverStrategy = (rawImportPath, _filePath, ctx) => {
  const pathParts = rawImportPath.replace(/^\.\//, '').split('/').filter(Boolean);
//   const resolved = suffixResolve(pathParts, ctx.normalizedFileList, ctx.allFileList, ctx.index);
//   return resolved ? { kind: 'files', files: [resolved] } : null;
// };

// export const gdscriptImportConfig: ImportResolutionConfig = {
//   language: SupportedLanguages.GDScript,
//   strategies: [gdscriptRequireStrategy],
// };
