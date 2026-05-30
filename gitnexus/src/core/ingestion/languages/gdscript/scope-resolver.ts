/**
 * GDScript `ScopeResolver` registered in `SCOPE_RESOLVERS` and consumed
 * by the generic `runScopeResolution` orchestrator.
 *
 * GDScript is dynamically typed with a simple "first-wins" MRO (no C3 linearization needed).
 * Class methods are found via inheritance chain. Signal connections create special call edges.
 * Scene node references ($NodeName, %UniqueNode) resolve to their attached scripts.
 */

import type { ParsedFile } from 'gitnexus-shared';
import { SupportedLanguages } from 'gitnexus-shared';
import { buildMro, defaultLinearize } from '../../scope-resolution/passes/mro.js';
import { populateClassOwnedMembers } from '../../scope-resolution/scope/walkers.js';
import type { ScopeResolver } from '../../scope-resolution/contract/scope-resolver.js';
import { gdscriptProvider } from '../gdscript/index.js';
import type { ScopeResolutionIndexes } from '../../model/scope-resolution-indexes.js';

/**
 * Build a workspace-wide node-name → script-path lookup from scene files.
 * This enables $NodeName resolution to find the attached script.
 */
function buildSceneNodeLookup(parsedFiles: readonly ParsedFile[]): Map<string, string> {
  const nodeToScript = new Map<string, string>();
  
  for (const parsed of parsedFiles) {
    // Look for Symbol definitions from .tscn files
    if (parsed.filePath.endsWith('.tscn')) {
      for (const def of parsed.localDefs) {
        if (def.type === 'Symbol' && def.qualifiedName !== undefined) {
          // The script path is stored in declaredType (set via @declaration.field-type)
          const scriptPath = def.declaredType;
          nodeToScript.set(def.qualifiedName, scriptPath ?? '');
        }
      }
    }
  }
  
  return nodeToScript;
}

/**
 * Populate namespace siblings for GDScript scene node + autoload resolution.
 * This hook makes scene node symbols and autoload symbols visible as bindings
 * in .gd files, enabling $NodeName.method() and AutoloadName.method() to
 * resolve to the attached script's methods.
 */
function populateSceneNodeBindings(
  parsedFiles: readonly ParsedFile[],
  indexes: ScopeResolutionIndexes,
  ctx: { fileContents: ReadonlyMap<string, string> },
): void {
  // Build lookup: node name → script path (from .tscn files)
  const nodeToScript = buildSceneNodeLookup(parsedFiles);
  
  // Also process autoload entries from project.godot files
  // Autoload pattern: Symbol named "PlayerData" has target "res://player_data.gd"
  for (const parsed of parsedFiles) {
    if (parsed.filePath.endsWith('project.godot')) {
      for (const def of parsed.localDefs) {
        if (def.type === 'Symbol' && def.qualifiedName !== undefined) {
          // Autoload entries store their target script path in declaredType
          const targetFile = def.declaredType;
          if (targetFile) {
            nodeToScript.set(def.qualifiedName, targetFile);
          }
        }
      }
    }
  }
  
  // For each .gd file, add bindings for scene nodes and autoloads
  for (const parsed of parsedFiles) {
    if (!parsed.filePath.endsWith('.gd')) continue;
    
    const moduleScope = parsed.scopes.find(s => s.kind === 'Module');
    if (!moduleScope) continue;
    
    // Get or create the augmentation bucket for this module scope
    // Must cast to mutable Map per Invariant I8
    const augmentations = indexes.bindingAugmentations as Map<string, Map<string, any>>;
    let moduleBindings = augmentations.get(moduleScope.id);
    if (moduleBindings === undefined) {
      moduleBindings = new Map();
      augmentations.set(moduleScope.id, moduleBindings);
    }
    
    for (const [nodeName, scriptPath] of nodeToScript) {
      if (!scriptPath) continue;
      
      // Clean the script path: strip quotes (autoload captures include them) and res:// prefix
      const cleanScriptPath = scriptPath.replace(/^"|"$/g, '').replace('res://', '');
      
      // Find the target file in the workspace
      const targetFilePath = Array.from(ctx.fileContents.keys()).find(
        p => p.endsWith(cleanScriptPath),
      );
      
      if (!targetFilePath) continue;
      
      // Find the class definition in the target file (via qualified name lookup)
      // The autoload/class name IS the class name in GDScript
      const classDefs = indexes.qualifiedNames.get(nodeName) ?? [];
      
      for (const defId of classDefs) {
        const classDef = indexes.defs.get(defId);
        // Only add Class definitions (not Symbol) - the Symbol from .tscn files
        // is the source for the script path, but we bind to the actual Class
        if (classDef && classDef.type === 'Class') {
          // Add a binding that points to the target class for:
          // 1. The plain node name (for method resolution after prefix stripping)
          // 2. The $prefix name (for scene node access)
          const existing = moduleBindings.get(nodeName) ?? [];
          if (!existing.some(b => b.def.nodeId === classDef.nodeId)) {
            moduleBindings.set(nodeName, [...existing, { def: classDef, origin: 'import' } as any]);
          }
          // Also add binding for $NodeName to handle $Player.method() directly
          const prefixedName = '$' + nodeName;
          const existingPrefixed = moduleBindings.get(prefixedName) ?? [];
          if (!existingPrefixed.some(b => b.def.nodeId === classDef.nodeId)) {
            moduleBindings.set(prefixedName, [...existingPrefixed, { def: classDef, origin: 'import' } as any]);
          }
          // And for %UniqueNode style access
          const uniquePrefixedName = '%' + nodeName;
          const existingUnique = moduleBindings.get(uniquePrefixedName) ?? [];
          if (!existingUnique.some(b => b.def.nodeId === classDef.nodeId)) {
            moduleBindings.set(uniquePrefixedName, [...existingUnique, { def: classDef, origin: 'import' } as any]);
          }
        }
      }
    }
  }
}

/**
 * Simple merge bindings for GDScript - no complex LEGB like Python.
 * For GDScript, class members shadow outer scope, and imports bring symbols.
 */
function gdscriptMergeBindings(
  existing: readonly import('gitnexus-shared').BindingRef[],
  incoming: readonly import('gitnexus-shared').BindingRef[],
  _scopeId: string,
): import('gitnexus-shared').BindingRef[] {
  // Simple: local declarations win, then imports/wildcard
  const seen = new Map<string, import('gitnexus-shared').BindingRef>();

  // First incoming (imports, wildcard), then existing (locals)
  // This lets locals shadow imports
  for (const ref of incoming) {
    seen.set(ref.def.nodeId, ref);
  }
  for (const ref of existing) {
    seen.set(ref.def.nodeId, ref);
  }

  return Array.from(seen.values());
}

/**
 * GDScript arity compatibility - for dynamically typed language,
 * we accept all calls as "compatible" to avoid filtering.
 */
function gdscriptArityCompatibility(
  callsite: import('gitnexus-shared').Callsite,
  _def: import('gitnexus-shared').SymbolDefinition,
): import('gitnexus-shared').ArityVerdict {
  // GDScript is dynamically typed - accept all calls
  return 'unknown';
}

/**
 * Resolve GDScript import targets (preload/load statements).
 * GDScript uses res:// URIs and relative paths.
 */
function gdscriptResolveImportTarget(
  targetRaw: string,
  fromFile: string,
  allFilePaths: ReadonlySet<string>,
): string | readonly string[] | null {
  const cleaned = targetRaw.replace(/['"]/g, '');

  // Handle res:// URIs
  if (cleaned.startsWith('res://')) {
    const relativePath = cleaned.replace('res://', '');
    const found = Array.from(allFilePaths).find((p) => p.endsWith(relativePath));
    return found ? found : null;
  }

  // Handle relative paths (starting with .)
  if (cleaned.startsWith('.')) {
    const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/') + 1);
    const resolved = fromDir + cleaned.replace('./', '');
    const found = Array.from(allFilePaths).find((p) => p === resolved || p.endsWith(resolved));
    return found ? found : null;
  }

  // Handle simple class names - look for matching .gd file
  const found = Array.from(allFilePaths).find(
    (p) =>
      p.endsWith(`/${cleaned}.gd`) ||
      (p.endsWith('.gd') && p.split('/').pop()?.replace('.gd', '') === cleaned),
  );
  return found ? found : null;
}

const gdscriptScopeResolver: ScopeResolver = {
  language: SupportedLanguages.GDScript,
  languageProvider: gdscriptProvider,
  importEdgeReason: 'gdscript-scope: import',

  resolveImportTarget: (targetRaw, fromFile, allFilePaths) =>
    gdscriptResolveImportTarget(targetRaw, fromFile, allFilePaths),

  // GDScript: class members shadow outer scopes
  mergeBindings: (existing, incoming, scopeId) =>
    gdscriptMergeBindings(existing, incoming, scopeId),

  arityCompatibility: (callsite, def) => gdscriptArityCompatibility(callsite, def),

  buildMro: (graph, parsedFiles, nodeLookup) =>
    buildMro(graph, parsedFiles, nodeLookup, defaultLinearize),

  populateOwners: (parsed: ParsedFile) => populateClassOwnedMembers(parsed),

  // GDScript uses `super.method()` pattern
  isSuperReceiver: (text) => text === 'super',

  // GDScript is dynamically typed - both defaults are fine
  fieldFallbackOnMethodLookup: true,
  propagatesReturnTypesAcrossImports: true,

  // Scene node and autoload resolution - wire the populate hook
  populateNamespaceSiblings: populateSceneNodeBindings,
};

export { gdscriptScopeResolver };
