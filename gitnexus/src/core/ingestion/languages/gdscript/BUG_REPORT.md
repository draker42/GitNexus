# Bug Report: GDScript CALLS Edges Not Emitted for Built-in Types

**Date:** 2026-05-15  
**Reporter:** Poolside Laguna M.1  
**Severity:** High (feature completely non-functional)  
**Status:** FIXED

## Summary

GDScript method calls on built-in Godot types (e.g., `btn.pressed.connect(_on_pressed)`, `Button.new()`) were not emitting CALLS edges in the knowledge graph.

## Affected Functionality

- Call resolution for built-in Godot types
- Integration test `test/integration/resolvers/gdscript.test.ts`
- Scope-resolution pipeline for GDScript

## Root Cause Analysis

### Initial Symptom
Integration test failed with:
```
AssertionError: expected 0 to be greater than 0
    at test/integration/resolvers/gdscript.test.ts:38:33
```
No CALLS edges were being emitted for `btn.pressed.connect()`.

### Investigation Path

1. **Provider side working correctly** - `emitScopeCaptures` returns 33 captures, tree-sitter queries match correctly

2. **Resolution finding candidates** - Debug output showed:
   ```
   [DEBUG lookupCore] perCandidate.size after all steps: 1
   candidate: { defId: '__builtin:Signal.connect', type: 'Method', signals: { kindMatch: true, typeBindingMroDepth: 0, ownerMatch: true } }
   ```

3. **Edge emission failing** - The `resolveDefGraphId` function logs showed:
   ```
   [resolveDefGraphId] filePath=<godot-builtins>, qn=connect, type=Method
   [resolveDefGraphId] qualifiedHit for key <q>:<godot-builtins>::Method::connect: undefined
   [resolveDefGraphId] simpleHit for key <godot-builtins>::connect: undefined
   ```

### Root Cause

The synthetic built-in definitions (Button, Signal, etc.) created by `createGdscriptBuiltinDefs()` were added to the scope resolution indexes but **never emitted as graph nodes**. When `resolveDefGraphId` tried to look up target nodes using `qualifiedKey(filePath, def.type, qn)`, the graph had no nodes for `<godot-builtins>` file path, so the lookup returned `undefined` and edges were skipped.

## Solution Implemented

In `run.ts` (lines 287-318), after building the initial nodeLookup but before `resolveReferenceSites`:

1. Emit synthetic Method/Function nodes to the graph for built-in types
2. Rebuild nodeLookup to include these synthetic nodes  
3. Use the rebuilt lookup in `emitReceiverBoundCalls`, `emitFreeCallFallback`, and `emitReferencesViaLookup`

## Files Changed

| File | Change |
|------|--------|
| `gitnexus/src/core/ingestion/scope-resolution/pipeline/run.ts` | Added synthetic node emission and rebuilt nodeLookup |
| `gitnexus/src/core/ingestion/resolve-references.ts` | Pass `receiverMixedChain` to lookup |
| `gitnexus/src/core/ingestion/scope-extractor.ts` | Extract `receiverMixedChain` from captures |
| `gitnexus/src/core/ingestion/utils/call-analysis.ts` | Handle GDScript attribute nodes |
| `gitnexus-shared/src/scope-resolution/types.ts` | Add `MixedChainStep` type |
| `gitnexus-shared/src/scope-resolution/reference-site.ts` | Add `receiverMixedChain` field |
| `gitnexus-shared/src/scope-resolution/registries/lookup-core.ts` | Add `walkMixedChain` function |
| `gitnexus-shared/src/scope-resolution/registries/method-registry.ts` | Add `receiverMixedChain` to options |
| `gitnexus/src/core/ingestion/languages/gdscript/` | Full GDScript language provider |
| `gitnexus/src/core/ingestion/registry-primary-flag.ts` | Added GDScript to MIGRATED_LANGUAGES |

## Testing

After fix:
```
✓ test/integration/resolvers/gdscript.test.ts (2 tests)
  ✓ indexes the Game class
  ✓ emits CALLS edges for method calls on built-in types

✓ test/unit/registry-primary-flag.test.ts (16 tests)
  ✓ all tests pass
```

Full test suite: 8078 tests pass

## Lessons Learned

1. **Synthetic definitions need graph nodes for edge emission** - Scope resolution indexes alone aren't sufficient; downstream edge emission requires graph nodes to exist.

2. **Debug logging is invaluable** - Adding `console.log` in `resolveDefGraphId` and `buildGraphNodeLookup` quickly revealed the missing node issue.

3. **Mixed chain resolution requires full pipeline support** - The `receiverMixedChain` mechanism needed to be wired through:
   - Provider (synthesize chain)
   - Scope extractor (extract chain)
   - Resolve references (pass to lookup)
   - Lookup core (handle chain)
   - Edge emission (find target nodes)