# Technical Plan: tree-sitter-godot-resource Integration for Autoload Support

## Overview

Add `tree-sitter-godot-resource` grammar to parse `project.godot` files and extract `[autoload]` section entries. This will enable cross-file symbol resolution for Godot's singleton pattern, completing the GDScript feature set.

**Key insight**: Autoload entries like `PlayerData="res://data/player_data.gd"` define global symbol names that should resolve to their target scripts across the entire codebase.

## Implementation Approach

### Step 1: Add Dependency and Vendor Grammar
**File: `gitnexus/package.json`**
```json
"dependencies": {
  ...
  "tree-sitter-godot-resource": "^0.7.0"
}
```

**File: `gitnexus/scripts/materialize-vendor-grammars.cjs`**
- Add `tree-sitter-godot-resource` to vendored grammars list (for Windows compatibility)

### Step 2: Extend Language Support (Alternative: No New Language Needed)
**Decision**: Handle `.godot` files within GDScript provider rather than creating a new `GodotResource` language type. This keeps autoload symbols in the same resolution context.

### Step 3: Add Godot Resource Queries
**File: `gitnexus/src/core/ingestion/tree-sitter-queries.ts`**
```typescript
// Add after GDSCRIPT_QUERIES
export const GODOT_RESOURCE_QUERIES = `
;; project.godot autoload extraction
(config_section
  name: (identifier) @config.name
  (#eq? @config.name "autoload")
  body: (config_body
    (config_entry
      key: (identifier) @autoload.name
      value: (string) @autoload.path))) @autoload.section

;; Each entry: name = path
(config_entry
  key: (identifier) @declaration.name) @autoload.entry
  value: (string) @autoload.path
`;

// Add to LANGUAGE_QUERIES map - but we won't use it directly since
// we're handling this in GDScript provider
```

### Step 4: Update GDScript Provider to Handle project.godot
**File: `gitnexus/src/core/ingestion/languages/gdscript/index.ts`**

Add new method to `defineLanguage` config:
```typescript
// Add to gdscriptProvider:
const GODOT_RESOURCE_QUERIES = `...`; // inline or imported

// Handle project.godot files specially in emitScopeCaptures
// Check if filename is 'project.godot', use different query
```

**Key changes**:
1. Extend `extensions` array to include `.godot`
2. Add conditional query selection in `emitScopeCaptures`:
```typescript
emitScopeCaptures: (sourceText, filePath, cachedTree) => {
  const isProjectGodot = filePath.endsWith('project.godot');
  const query = isProjectGodot 
    ? getGodotResourceQuery() 
    : getGDScriptScopeQuery();
  // ... rest of extraction
}
```

### Step 5: Implement Autoload Interpretation
**File: `gitnexus/src/core/ingestion/languages/gdscript/index.ts`**

Extend `interpretImport` to handle autoload entries:
```typescript
// In interpretImport:
if (captures['@autoload.entry']) {
  return {
    kind: 'autoload',
    symbolName: captures['@autoload.name'].text,
    targetRaw: captures['@autoload.path'].text.replace(/res:\/\//, ''),
  };
}
```

### Step 6: Update Scope Resolver for Autoload Resolution
**File: `gitnexus/src/core/ingestion/languages/gdscript/scope-resolver.ts`**

Extend `resolveImportTarget` to handle autoload paths:
```typescript
// Add to gdscriptResolveImportTarget:
// Handle autoload pattern: symbolName -> res://path/script.gd
// The resolved script's class_name defines the symbol
```

### Step 7: Register Autoload Symbols in Global Registry
**File: `gitnexus/src/core/ingestion/languages/gdscript/index.ts`**

The autoload entries should:
1. Be indexed as symbol exports (like `class_name`)
2. Create a synthetic global scope entry
3. Resolve to the target script's class when referenced

### Step 8: Update Implementation Checklist
**File: `gitnexus/src/core/ingestion/languages/gdscript/IMPLEMENTATION_CHECKLIST.md`**

Mark autoload integration as completed.

## Testing Strategy

1. **Unit test**: Create `test/unit/godot-resource-parser.test.ts` with:
   - Parse sample `project.godot` content
   - Verify autoload entries extracted correctly
   - Test path resolution `res://data/script.gd` → filesystem path

2. **Integration test**: Add to `test/integration/resolvers/gdscript.test.ts`:
   - Create fixture with `project.godot` + autoloaded script
   - Verify `AutoloadName.method()` resolves correctly
   - Test cross-file call resolution via autoload

3. **Manual verification**:
   - Run `npx vitest run test/integration/resolvers/gdscript.test.ts`
   - Run `npx tsc --noEmit` for typecheck
