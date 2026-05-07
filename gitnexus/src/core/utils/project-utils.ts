import type { ResolveCtx } from '../ingestion/import-resolvers/types.js';

export function findProjectRoot(ctx: ResolveCtx): string | null {
  // Find the highest directory in ctx.allFilePaths that contains 'project.godot'
  const projectGodotFiles = Array.from(ctx.allFilePaths).filter((filePath) => filePath.includes('project.godot'));
  if (projectGodotFiles.length === 0) return null; // No project.godot file found

  const projectRoot = projectGodotFiles[0].split('/').slice(0, -1).join('/');
  return projectRoot;
}
