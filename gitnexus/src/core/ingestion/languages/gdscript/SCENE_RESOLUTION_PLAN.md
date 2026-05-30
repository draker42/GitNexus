# GDScript Scene Reference Resolution - Implementation

## Overview

This document describes the implemented solution for resolving scene node references (`$NodeName`, `%UniqueNode`) in GDScript code to their attached scripts and methods.

## Implementation Details

### Language Detection (`gitnexus-shared/src/language-detection.ts`)
- Added `.tscn` extension to GDScript language extensions
- Scene files are now recognized as part of the GDScript language ecosystem

### Scene File Parsing Queries (`gitnexus/src/core/ingestion/tree-sitter-queries.ts`)
- Added `GODOT_SCENE_QUERIES` for extracting node names from `.tscn` files
- Queries capture:
  - `@scene.node.section` - node section headers
  - `@scene.node.name` - node names
  - `@scene.ext.resource` - external resource definitions with path and ID

### GDScript Provider Updates (`gitnexus/src/core/ingestion/languages/gdscript/index.ts`)
- Added `.tscn` to extensions array (line 314)
- Added `emitGodotSceneCaptures` function that:
  - Parses `.tscn` files using `tree-sitter-godot-resource`
  - Builds a map of ext_resource IDs to script paths
  - Extracts node names and their associated script paths
  - Creates Symbol definitions for scene nodes with `@declaration.symbol` captures
- **Critical fix**: Separated `@scope.module` into its own match object (lines 185-237) to ensure correct topic classification for Symbol creation

### Scope Resolver Implementation (`gitnexus/src/core/ingestion/languages/gdscript/scope-resolver.ts`)

#### `buildSceneNodeLookup` function (lines 22-39)
```typescript
function buildSceneNodeLookup(parsedFiles: readonly ParsedFile[]): Map<string, string> {
  const nodeToScript = new Map<string, string>();
  for (const parsed of parsedFiles) {
    if (parsed.filePath.endsWith('.tscn')) {
      for (const def of parsed.localDefs) {
        if (def.type === 'Symbol' && def.qualifiedName !== undefined) {
          const scriptPath = def.declaredType;
          nodeToScript.set(def.qualifiedName, scriptPath ?? '');
        }
      }
    }
  }
  return nodeToScript;
}
```

#### `populateSceneNodeBindings` function (lines 47-132)
The key resolution hook that:
1. Builds the node-to-script lookup from `.tscn` files
2. Processes autoload entries from `project.godot` files
3. For each `.gd` file, adds bindings to `bindingAugmentations` for scene node names
4. **Critical fix**: Adds bindings for three name variants to handle different receiver formats:
   - Plain name (`Player`) - for autoload resolution
   - `$ prefixed name (`$Player`) - for scene node access
   - `% prefixed name (`%Player`) - for unique node access
5. Cleans autoload script paths by stripping quotes: `scriptPath.replace(/^"|"$/g, '')`
6. Only adds `Class` definitions (not Symbol) to avoid type mismatches in resolution

### Call Analysis Updates (`gitnexus/src/core/ingestion/utils/call-analysis.ts`)
- Updated `extractReceiverName` to handle `get_node` nodes (for `$NodeName` and `%UniqueNode`)
- `get_node` receiver text is stripped to get the node name (`Player` from `$Player`)

### Symbol Node Property Addition (`gitnexus/src/core/ingestion/scope-resolution/pipeline/run.ts`)
- Added `declaredType` property to Symbol node creation (lines 486-500)
- This preserves the script path from scene files for later resolution

## Resolution Flow

1. **Scene files define nodes**: `[node name="Player" type="Node2D"]` with `script = ExtResource(1)`
2. **External resources map IDs to paths**: `[ext_resource path="res://Player.gd" id=1]`
3. **In GDScript code**: `$Player.take_damage()` calls method on the node (captured as `get_node` receiver with name "Player")
4. **Resolution flow**:
   - `$Player` is captured, receiver name becomes "Player" via `extractReceiverName`
   - `populateNamespaceSiblings` hook adds binding for "Player" → Player.gd class
   - `findClassBindingInScope` finds the Player class binding
   - MRO walk finds `take_damage` method on Player class
   - CALLS edge is emitted from the call site to the method

## Test Fixtures (`test/fixtures/lang-resolution/gdscript-scene/`)

- `main.tscn` - Scene file defining Player node connected to Player.gd
- `Player.gd` - Script with `take_damage` and `heal` methods
- `Game.gd` - Script calling `$Player.take_damage()` and `$Player.heal()`

## Test Results

All 9 integration tests pass:
- ✅ `indexes the Player class from script`
- ✅ `indexes scene nodes as Symbol definitions`
- ✅ `emits CALLS edges for $Player.take_damage() resolution`
- ✅ `resolves $Player.heal() to Player class method`

## Files Modified

1. `gitnexus-shared/src/language-detection.ts` - Added `.tscn` extension
2. `gitnexus/src/core/ingestion/tree-sitter-queries.ts` - Added GODOT_SCENE_QUERIES
3. `gitnexus/src/core/ingestion/languages/gdscript/index.ts` - Added scene capture logic
4. `gitnexus/src/core/ingestion/utils/call-analysis.ts` - Handle get_node receivers
5. `gitnexus/src/core/ingestion/languages/gdscript/scope-resolver.ts` - Implemented scene resolution
6. `gitnexus/src/core/ingestion/scope-resolution/pipeline/run.ts` - Added declaredType to Symbol nodes
7. `gitnexus/src/core/ingestion/scope-extractor.ts` - Added @declaration.target fallback for declaredType
8. `test/integration/resolvers/gdscript.test.ts` - Added scene resolution tests