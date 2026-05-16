# GDScript Call Resolution Implementation

**Date:** 2026-05-15  
**Branch:** `feature/gdscript-support`  
**Status:** COMPLETE - All tests passing

## Overview

This document describes the implementation of Phase C/3 (Call & Connection Resolution) for GDScript in GitNexus, enabling CALLS edges for method calls on built-in Godot types (`Button.new()`, `btn.pressed.connect()`, `Label.new()`, etc.).

## Problem Statement

GDScript method calls on built-in Godot types were not emitting CALLS edges because:
1. The scope resolution correctly found `__builtin:Signal.connect` as a candidate
2. But the edge emission failed because synthetic built-in definitions had no corresponding graph nodes
3. The `resolveDefGraphId` function couldn't find target nodes for `<godot-builtins>` file path

## Solution

Added synthetic built-in definitions as graph nodes immediately after finalizing the scope model and before resolving reference sites. This ensures the rebuilt nodeLookup includes synthetic nodes that can be resolved during edge emission.

## Key Changes

### 1. Synthetic Node Emission (`run.ts`)

```typescript
// In run.ts, after building initial nodeLookup but before resolveReferenceSites
const nodeLookupWithSynthetic =
  syntheticDefs !== undefined
    ? (() => {
        for (const def of syntheticDefs) {
          if (def.type === 'Method' || def.type === 'Function') {
            const nodeId = `${def.type}:${def.filePath}:${def.qualifiedName}`;
            if (graph.getNode(nodeId) === undefined) {
              graph.addNode({
                id: nodeId,
                label: def.type,
                properties: {
                  name: def.qualifiedName,
                  filePath: def.filePath,
                },
              });
            }
          }
        }
        return buildGraphNodeLookup(graph);
      })()
    : nodeLookup;
```

### 2. Files Modified

| File | Change |
|------|--------|
| `gitnexus/src/core/ingestion/scope-resolution/pipeline/run.ts` | Emit synthetic nodes, rebuild nodeLookup |
| `gitnexus/src/core/ingestion/resolve-references.ts` | Pass `receiverMixedChain` to lookup |
| `gitnexus/src/core/ingestion/scope-extractor.ts` | Extract `receiverMixedChain` from captures |
| `gitnexus/src/core/ingestion/utils/call-analysis.ts` | Handle GDScript attribute nodes |
| `gitnexus-shared/src/scope-resolution/types.ts` | Add `MixedChainStep` type |
| `gitnexus-shared/src/scope-resolution/reference-site.ts` | Add `receiverMixedChain` field |
| `gitnexus-shared/src/scope-resolution/registries/lookup-core.ts` | Add `walkMixedChain` function |
| `gitnexus-shared/src/scope-resolution/registries/method-registry.ts` | Add `receiverMixedChain` to options |
| `gitnexus/src/core/ingestion/languages/gdscript/` | Full GDScript language provider |

### 3. Mixed Chain Resolution

The `walkMixedChain` function in `lookup-core.ts` handles compound receivers like `btn.pressed.connect()`:

1. Resolve base receiver type (e.g., `btn` → `Button`)
2. Walk each step in the mixed chain to resolve intermediate types:
   - `Button.pressed` → `Signal` (via `declaredType` on Property)
3. Use final type as receiver for method lookup:
   - `Signal.connect` → finds the method

## Test Results

```
✓ test/integration/resolvers/gdscript.test.ts (2 tests)
  ✓ indexes the Game class
  ✓ emits CALLS edges for method calls on built-in types

✓ test/unit/registry-primary-flag.test.ts (16 tests)
  ✓ all tests pass with GDScript in MIGRATED_LANGUAGES
```

## Architecture Notes

### How CALLS Edges Are Emitted for GDScript

1. **Provider** (`gitnexus/src/core/ingestion/languages/gdscript/index.ts`):
   - Tree-sitter query matches `btn.pressed.connect(_on_pressed)`
   - Emits `@reference.call.member` capture for `connect`
   - Synthesizes `@reference.chain` with `[{kind:'field', name:'pressed'}]`

2. **Scope Extractor** (`scope-extractor.ts`):
   - `extractReceiverMixedChain` extracts chain into `ReferenceSite.receiverMixedChain`
   - Populates `site.receiverMixedChain = [{kind:'field', name:'pressed'}]`

3. **Reference Resolution** (`resolve-references.ts`):
   - Passes `site.receiverMixedChain` to `methodRegistry.lookup`

4. **Method Lookup** (`method-registry.ts` → `lookup-core.ts`):
   - `walkReceiverTypeBinding` resolves `btn` → `Button`
   - `walkMixedChain` resolves `Button.pressed` → `Signal`
   - Finds `Signal.connect` method in MRO walk

5. **Edge Emission** (`references-to-edges.ts`):
   - `resolveDefGraphId` finds `Signal.connect` node via rebuilt `nodeLookupWithSynthetic`
   - Emits CALLS edge: `_ready -> connect (scope-resolution: call)`

## Extending This Implementation

To add support for additional Godot types or method patterns:

1. Add built-in definitions to `createGdscriptBuiltinDefs()` in `run.ts`
2. Ensure synthetic definitions have proper `declaredType` for field properties
3. Add tree-sitter queries in `gitnexus/src/core/ingestion/languages/gdscript/index.ts`
4. Run `npm test -- --run test/integration/resolvers/gdscript.test.ts`

## Related Documentation

- `GDSCRIPT_BUG_CHASE_STATUS.md` - Historical investigation notes
- `ARCHITECTURE.md` - Scope-Resolution Pipeline section
- `CONTRIBUTING.md` - Testing guidelines