# GDScript Scene Resolution - Implementation Summary

## Status: ✅ COMPLETED - All issues resolved as of 2026-05-29

## Problem Summary (Original)

Scene reference resolution (`$NodeName`, `%UniqueNode`) for GDScript/Godot was partially implemented but incomplete. The core issue was that while scene nodes were being captured, the method calls on them were not resolving to the correct class methods.

## Key Fixes Applied

### 1. Fixed `emitGodotSceneCaptures` topic classification (`index.ts` lines 185-237)
- Separated `@scope.module` into its own match object instead of combining with `@declaration.symbol`
- This ensures Symbol definitions are created correctly for scene nodes (prevents topic misclassification)

### 2. Added `declaredType` property for Symbol nodes (`run.ts` lines 486-500)
- The script path from `.tscn` files is now stored in `declaredType` on Symbol definitions
- This preserves the `res://Player.gd` path for later resolution

### 3. Fixed `populateSceneNodeBindings` to use `declaredType` (`scope-resolver.ts`)
- Changed from non-existent `scriptPath` property to `declaredType`

### 4. Fixed autoload script path cleaning (`scope-resolver.ts` line 91)
- Added quote stripping: `scriptPath.replace(/^"|"$/g, '')` to handle autoload values like `"res://player_data.gd"`

### 5. Added bindings for all receiver name variants (`scope-resolver.ts` lines 108-127)
- Plain name (`Player`) - for autoload resolution
- `$ prefixed name (`$Player`) - for scene node access
- `% prefixed name (`%Player`) - for unique node access
- This enables method resolution when the receiver is `$NodeName` or `%UniqueNode`

### 6. Fixed type checking in binding resolution (`scope-resolver.ts` line 108)
- Changed from `(def.type === 'Class' || def.type === 'Symbol')` to only `def.type === 'Class'`
- The Symbol from `.tscn` files is the source for the script path, but we bind to the actual Class

### 7. Added `@declaration.target` fallback for `declaredType` (`scope-extractor.ts` line 603)
- Autoload captures use `@declaration.target` to store the script path
- Added fallback so `declaredType` is populated from target captures

## Resolution Flow

1. **Scene files define nodes**: `[node name="Player" type="Node2D"]` with `script = ExtResource(1)`
2. **External resources map IDs to paths**: `[ext_resource path="res://Player.gd" id=1]`
3. **In GDScript code**: `$Player.take_damage()` calls method on the node (captured as `get_node` receiver)
4. **Resolution flow**:
   - `$Player` is captured, receiver name becomes "Player" via `extractReceiverName`
   - `populateNamespaceSiblings` hook adds binding for `$Player` → Player.gd class
   - `findClassBindingInScope` finds the Player class binding
   - MRO walk finds `take_damage` method on Player class
   - CALLS edge is emitted from the call site to the method

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