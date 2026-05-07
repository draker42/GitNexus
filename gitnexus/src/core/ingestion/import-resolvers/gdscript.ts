import { findProjectRoot } from '../../utils/project-utils.js';
import type { ImportResolverStrategy, ResolveCtx } from './types.js';

/**
 * GDScript import resolver strategy for res:// URI scheme.
 * Handles `preload("res://...")` and `load("res://...")` patterns.
 */
export const gdscriptResResolver: ImportResolverStrategy = (rawPath, _filePath, ctx) => {
  if (!rawPath.startsWith("res://")) return null; // Pass to next strategy

  // 1. Convert res:// to filesystem path
  // We need to find the project root.
  // Strategy: Find the highest directory in ctx.allFilePaths that contains 'project.godot'
  const projectRoot = findProjectRoot(ctx);
  if (!projectRoot) return null; // No project root found

  const filesystemPath = rawPath.replace("res://", projectRoot + "/");

  // 2. Validate existence
  if (ctx.allFilePaths.has(filesystemPath)) {
    return { kind: 'files', files: [filesystemPath] };
  }

  return null; // Path not found in current workspace
};
