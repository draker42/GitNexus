/**
 * GDScript `ScopeResolver` registered in `SCOPE_RESOLVERS` and consumed
 * by the generic `runScopeResolution` orchestrator.
 *
 * GDScript is dynamically typed with a simple "first-wins" MRO (no C3 linearization needed).
 * Class methods are found via inheritance chain. Signal connections create special call edges.
 */

import type { ParsedFile } from 'gitnexus-shared';
import { SupportedLanguages } from 'gitnexus-shared';
import { buildMro, defaultLinearize } from '../../scope-resolution/passes/mro.js';
import { populateClassOwnedMembers } from '../../scope-resolution/scope/walkers.js';
import type { ScopeResolver } from '../../scope-resolution/contract/scope-resolver.js';
import { gdscriptProvider } from '../gdscript/index.js';

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
};

export { gdscriptScopeResolver };