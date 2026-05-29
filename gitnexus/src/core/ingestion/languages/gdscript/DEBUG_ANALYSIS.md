# GDScript Autoload Implementation - Final Verification Report

## Problem Summary (RESOLVED)
The autoload entries in `project.godot` files needed to create `Symbol` nodes for global singleton access. The initial implementation incorrectly routed autoload entries through the import pathway, which cannot create Symbol nodes.

## Root Cause Analysis

### Primary Issue
**The Wrong Model: Imports vs Declarations**

**The Fundamental Problem:** `Symbol` nodes are created from `parsed.localDefs` when `def.type === 'Symbol'` (see `run.ts` lines 464-482).

However, `ParsedImport` does NOT support creating Symbol nodes. The `ParsedImport` type only supports:
- `named`, `alias`, `namespace`, `reexport`, `wildcard`, `dynamic-unresolved`, `dynamic-resolved`, `side-effect`

There is NO `import` kind variant that includes `symbolName`. Autoload entries must be emitted as **declarations**, not imports.

### Original Query Problem (FIXED)
**Original Query (line 1058-1068 in `tree-sitter-queries.ts`):**
```tree-sitter
(section
  (identifier) @section.name
  (#eq? @section.name "autoload")
  (property
    (path) @declaration.name
    (string) @import.source) @import.statement)
```

**Problem:** The anchor `@import.statement` categorizes this as an **import** topic, routing to `pass3CollectImports`, but `interpretImport` was returning an invalid shape for `ParsedImport`.

## The Fix (IMPLEMENTED AND VERIFIED)

### Query Change
Changed `GODOT_RESOURCE_QUERIES` to use `@declaration.symbol` anchor:
```tree-sitter
(section
  (identifier) @section.name
  (#eq? @section.name "autoload")
  (property
    (path) @declaration.name
    (string) @declaration.target) @declaration.symbol)
```

### Implementation Details

1. **`tree-sitter-queries.ts`** - Updated GODOT_RESOURCE_QUERIES to use `@declaration.symbol` anchor
2. **`gdscript/index.ts`** - Added `emitGodotResourceCaptures` function that:
   - Parses `project.godot` files using `tree-sitter-godot-resource` parser
   - Extracts autoload entries from `[autoload]` section
   - Creates Symbol nodes for each autoload entry (PlayerData, GameState)
3. **`gdscript/index.ts`** - Added `.godot` extension to the language provider
4. **`gdscript/index.ts`** - Added lazy singleton parser for Godot resource grammar

### Verification Results

**Test Run:** `npx vitest run test/integration/resolvers/gdscript.test.ts`
```
✓ test/integration/resolvers/gdscript.test.ts (4 tests) 810ms
```

All 4 tests pass:
- ✓ indexes the Game class
- ✓ emits CALLS edges for method calls on built-in types
- ✓ indexes autoload entries from project.godot
- ✓ indexes the PlayerData class

**Typecheck:** `npx tsc --noEmit` - No errors

## Files Modified

1. `gitnexus/src/core/ingestion/tree-sitter-queries.ts` - Updated GODOT_RESOURCE_QUERIES
2. `gitnexus/src/core/ingestion/languages/gdscript/index.ts` - Added Godot resource parsing
3. `gitnexus/src/core/ingestion/model/registration-table.ts` - Added tree-sitter-godot-resource
4. `gitnexus/package.json` - Added tree-sitter-godot-resource dependency
5. `gitnexus/src/core/ingestion/languages/gdscript/IMPLEMENTATION_CHECKLIST.md` - Updated checklist
6. `.gitignore` - Updated for vendored grammar
7. `gitnexus-shared/src/graph/types.ts` - Added GDScript to migrated languages (if applicable)
8. `gitnexus-shared/src/language-detection.ts` - Added .godot extension support
9. `gitnexus-web/src/lib/constants.ts` - Added web constants (if applicable)
10. `test/integration/resolvers/gdscript.test.ts` - Updated tests
11. `test/fixtures/lang-resolution/gdscript-autoload/` - Added test fixtures

## Summary

The `tree-sitter-godot-resource` support is fully implemented and verified. Autoload entries in `project.godot` files are now correctly parsed and indexed as Symbol nodes, enabling cross-file symbol resolution for Godot's singleton pattern.
