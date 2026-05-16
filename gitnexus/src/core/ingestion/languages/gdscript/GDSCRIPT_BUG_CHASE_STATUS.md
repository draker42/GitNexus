# GDScript Call Resolution Bug Chase - Status Report

**Date:** 2026-05-15  
**Branch:** `feature/gdscript-support` (vs `main`)  
**Status:** COMPLETE ✅ (see GDSCRIPT_IMPLEMENTATION.md for final solution)

## Test Discrepancy Analysis (CONFIRMED)

| Branch | Tests Failed | Notes |
|--------|--------------|-------|
| `main` | 1 test | `has one provider per SupportedLanguages enum member` - **passes** on feature branch because gdscript IS registered |
| `feature/gdscript-support` | 1 test | `emits CALLS edges for method calls on built-in types` - **fails** because CALLS edges not being resolved |

**This is the OPPOSITE of what you expected!** The feature branch:
1. Fixes the "missing provider" test (gdscript is now registered)
2. BUT breaks the actual GDScript functionality test (no CALLS edges emitted)

This means your work on the provider side is **correct and complete** - the issue is in the resolution pipeline.

## Summary

The goal is to implement Phase C/3 (Call & Connection Resolution) for GDScript in GitNexus to enable CALLS edges for method calls on built-in Godot types (`Button.new()`, `btn.pressed.connect()`, `Label.new()`, etc.).

## Current State

### What's Working
- ✅ Tree-sitter grammar loads correctly
- ✅ Parser is functional
- ✅ Provider ID and extensions configured
- ✅ `emitScopeCaptures` returns 33 captures
- ✅ Build passes (`npm run build` succeeds)
- ✅ MixedChainStep type added to shared types
- ✅ `receiverMixedChain` field added to ReferenceSite interface

### What's Failing
- ❌ Integration test `test/integration/resolvers/gdscript.test.ts` fails
- ❌ No CALLS edges are being emitted for `btn.pressed.connect()` calls
- ❌ Test expects `connectCalls.length > 0` but gets 0

## Work Completed

### 1. GDScript Provider Setup
- **File:** `gitnexus/src/core/ingestion/languages/gdscript/index.ts`
- Created full GDScript language provider with:
  - Tree-sitter query patterns
  - `synthesizeGdscriptReceiverBinding` for `@type-binding.self` synthesis
  - `emitScopeCaptures` function that synthesizes `@reference.chain` captures
  - Type binding synthesis for `Button.new()` pattern
  - Extended BUILT_INS set with Godot types

### 2. Shared Types Extension
- **File:** `gitnexus-shared/src/scope-resolution/types.ts`
- Added `MixedChainStep` type

- **File:** `gitnexus-shared/src/scope-resolution/reference-site.ts`
- Added `receiverMixedChain` field to `ReferenceSite` interface

- **File:** `gitnexus-shared/src/index.ts`
- Exported `MixedChainStep`

### 3. Scope Resolution Updates
- **File:** `gitnexus/src/core/ingestion/scope-extractor.ts`
- Added `extractReceiverMixedChain` function
- Updated `pass5CollectReferences` to populate `receiverMixedChain`

### 4. GDScript Integration
- **File:** `gitnexus/src/core/ingestion/languages/gdscript/scope-resolver.ts`
- Created GDScript ScopeResolver
- Added GDScript to `MIGRATED_LANGUAGES`
- Registered in `SCOPE_RESOLVERS`

- **File:** `gitnexus/src/core/ingestion/languages/gdscript/type-binding.ts`
- Created `synthesizeTypeBindings` for GDScript

- **File:** `gitnexus/src/core/ingestion/languages/gdscript/interpret.ts`
- Created `interpretGdscriptTypeBinding`

- **File:** `gitnexus/src/core/ingestion/languages/gdscript/receiver-binding.ts`
- Created `synthesizeGdscriptReceiverBinding`

### 5. Built-in Type Definitions
- **File:** `gitnexus/src/core/ingestion/scope-resolution/pipeline/run.ts`
- Added synthetic SymbolDefinitions for built-in types (Button, Label, etc.)
- Added `createGdscriptBuiltinDefs()` function
- Added synthetic signal properties (`pressed`, `button_down`, etc.)

## Key Technical Details

### AST Structure for GDScript
```
btn.pressed.connect(_on_pressed)
```
- Single `attribute` node with 5 children:
  1. `identifier: btn`
  2. `.`
  3. `identifier: pressed`
  4. `.`
  5. `attribute_call: connect(_on_pressed)`

### The Chain Problem
For `btn.pressed.connect()`:
- The mixed chain should be `[{kind:'field', name:'pressed'}]`
- This represents the intermediate field access before the `connect` method call
- `extractMixedChain` in `gitnexus/src/core/ingestion/utils/call-analysis.ts` needs to handle this correctly

### Resolution Flow
1. Provider emits `@reference.call.member` capture for `btn.pressed.connect`
2. Provider synthesizes `@reference.chain` with `[{kind:'field', name:'pressed'}]`
3. `scope-extractor.ts` extracts chain into `ReferenceSite.receiverMixedChain`
4. `resolve-references.ts` uses `MethodRegistry.lookup` to resolve the call
5. Lookup should use `receiverMixedChain` to find `pressed` field → Signal type → `connect` method

## Outstanding Questions - ANSWERED

1. **Does `resolve-references.ts` pass `receiverMixedChain` to the lookup?** ❌ **NO** - This is the root cause!

2. **Does `MethodRegistry.lookup` handle `receiverMixedChain`?** ❌ **NO** - `MethodLookupOptions` doesn't have a `receiverMixedChain` field.

3. **Does `lookupCore` have code paths for compound receivers?** ❌ **NO** - It only handles simple `explicitReceiver` (a single name), not mixed chains.

## Root Cause Analysis

The `_resolve-references.ts` `lookupForSite` function (lines 172-211) does NOT pass `receiverMixedChain` to `methodRegistry.lookup`:

```typescript
case 'call': {
  const opts: Parameters<MethodRegistry['lookup']>[2] = {
    ...(site.arity !== undefined ? { callsite: { arity: site.arity } } : {}),
    ...(site.explicitReceiver !== undefined ? { explicitReceiver: site.explicitReceiver } : {}),
    // NOTE: receiverMixedChain is NOT passed here!
  };
  return methodRegistry.lookup(site.name, site.inScope, opts);
}
```

Meanwhile, the **legacy path** in `call-processor.ts` (lines 2804-2841) DOES have full mixed-chain handling:
- It resolves the base receiver type (e.g., `btn` → `Button`)
- Then walks the mixed chain using `walkMixedChain()`
- Each step resolves the type (e.g., `Button.pressed` → `Signal`)
- Finally resolves the target method (e.g., `Signal.connect`)

## The Fix Required

The registry-primary path needs similar mixed-chain support. This involves:

1. **Add `receiverMixedChain` to `MethodLookupOptions`** in `gitnexus-shared/src/scope-resolution/registries/method-registry.ts`

2. **Pass it to `CoreLookupParams`** in the same file

3. **Handle `receiverMixedChain` in `lookup-core.ts`** - add a new Step 2b that:
   - Resolves the base receiver type (from `explicitReceiver` or implicit `self`)
   - Walks each step in `receiverMixedChain` to resolve intermediate types
   - Uses the final type as the receiver for the method lookup

4. **Update `resolve-references.ts`** to pass `site.receiverMixedChain` in the options

## Next Investigation Steps

1. Trace the full resolution path:
   - `emitScopeCaptures` → `extractReceiverMixedChain` → `ReferenceSite` → `lookupForSite` → `methodRegistry.lookup` → `lookupCore`

2. Check if `lookup-core.ts` needs a `receiverMixedChain` parameter that:
   - Resolves the intermediate types
   - Walks through the chain to find the final receiver type

3. Verify the synthetic built-in definitions are correct:
   - `Button.new()` should return a Button instance
   - `Button.pressed` should be a `Signal` property
   - `Signal.connect` should be a method

## Investigation Commands

```bash
# Run the specific failing test
cd gitnexus && npx vitest run test/integration/resolvers/gdscript.test.ts --reporter=verbose

# Run all tests to see overall state
npx vitest run

# Compare branches
git diff main...feature/gdscript-support --stat
```

## Files Modified/Created

### Created
- `gitnexus/src/core/ingestion/languages/gdscript/scope-resolver.ts`
- `gitnexus/src/core/ingestion/languages/gdscript/type-binding.ts`
- `gitnexus/src/core/ingestion/languages/gdscript/interpret.ts`
- `gitnexus/src/core/ingestion/languages/gdscript/receiver-binding.ts`

### Modified
- `gitnexus/src/core/ingestion/languages/gdscript/index.ts`
- `gitnexus/src/core/ingestion/scope-extractor.ts`
- `gitnexus-shared/src/scope-resolution/types.ts`
- `gitnexus-shared/src/scope-resolution/reference-site.ts`
- `gitnexus-shared/src/index.ts`
- `gitnexus/src/core/ingestion/scope-resolution/pipeline/run.ts`

## Git Commands for Resume

```bash
# Check branch status
git status
git log --oneline -10

# Sync with main
git fetch origin
git merge origin/main

# Run tests
cd gitnexus && npm run build
npx vitest run test/integration/resolvers/gdscript.test.ts
```

## Cleanup Recommendations - Files to Review/Remove

### Unnecessary Files
These files should be cleaned up before PR:

| File | Action | Reason |
|------|--------|--------|
| `captures-ts.bak` | DELETE | Backup file, not needed |
| `FEATURE_REQUEST.md` | DELETE | Implementation planning doc |
| `IMPLEMENTATION_CHECKLIST.md` | DELETE | Planning doc |
| `SECTIONB_PLAN.md` | DELETE | Planning doc |
| `SECTIONB_REPORT.md` | DELETE | Planning doc |
| `SECTIONC_PLAN.md` | DELETE | Planning doc |
| `get_node.sh` | DELETE | Debug script |
| `node-types.json` | REVIEW | Large (49KB) - needed for tree-sitter? |
| `builtins.ts` | REVIEW | Check if used or redundant with `run.ts` |
| `.poolside/` | IGNORE | Agent working directory |
| `GDSCRIPT_BUG_CHASE_STATUS.md` | KEEP | This documentation file |

### npm clean equivalent
```bash
# Clean build artifacts
cd gitnexus && rm -rf dist node_modules
cd ../gitnexus-shared && rm -rf dist node_modules
# Then reinstall fresh
npm install
```

## Impact Analysis - Is GDScript Support Safe?

**LOW RISK** - The changes are well-isolated:

### Files touched outside GDScript:
1. `scope-extractor.ts` - Added `extractReceiverMixedChain` (doesn't break existing code)
2. `resolve-references.ts` - Currently doesn't use the new field (safe to add)
3. `run.ts` - Added `createGdscriptBuiltinDefs()` (only called for GDScript)
4. Shared types - Added optional fields (backward compatible)

### Languages affected:
- **GDScript only** - New language support
- Other languages continue to use legacy path (call-processor.ts)

### Recommendation:
The changes are **safe to merge** once the resolution fix is complete. The registry-primary path is only enabled for migrated languages (Python, GDScript, TypeScript, C#), and GDScript is currently the only one with mixed-chain test requirements.

---

## Final Solution (Added 2026-05-15)

### Root Cause
The synthetic built-in definitions (Button, Signal, etc.) were added to scope resolution indexes but never emitted as graph nodes. When `resolveDefGraphId` tried to look up target nodes, the graph had no nodes for `<godot-builtins>` file path.

### Fix Applied
In `run.ts`, after building the initial nodeLookup but before `resolveReferenceSites`:
1. Emit synthetic Method/Function nodes to the graph for built-in types
2. Rebuild nodeLookup to include these synthetic nodes
3. Use the rebuilt lookup in `emitReceiverBoundCalls`, `emitFreeCallFallback`, and `emitReferencesViaLookup`

### Result
- All 2 tests in `test/integration/resolvers/gdscript.test.ts` pass
- All 16 tests in `test/unit/registry-primary-flag.test.ts` pass
- Full test suite (8078 tests) passes

See `GDSCRIPT_IMPLEMENTATION.md` for the complete technical documentation.