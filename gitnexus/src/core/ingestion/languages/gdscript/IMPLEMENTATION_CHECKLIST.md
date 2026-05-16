# GDScript Implementation Status

## ✅ Completed
- [x] **Provider Registration**: `gdscriptProvider` fully defined with MRO and Built-ins.
- [x] **Symbol Expansion**: `typeConfig` supports `signal`, `enum`, `const`, and `class_definition`.
- [x] **Class Exporting**: `class_definition` nodes are exported as symbols to the global registry.

## ✅ Completed: Phase 2 (Connectivity)
- [x] **Refine Dependency Linking**: 
    - Update `interpretImport` to explicitly handle `extends` by creating `EXTENDS` relations.
    - Implement `preload` logic to create `IMPORTS` relations between files.
- [x] **Implement `load()` Resolver**: Extend `importResolver` to handle `load("res://...")` patterns.
    - Created `gdscriptResResolver` in `import-resolvers/gdscript.ts`
    - Handles `res://` URI scheme to filesystem path translation
    - Uses `findProjectRoot` utility to locate project root (where `project.godot` resides)
- [ ] **Autoload Integration**: Implement parser for `project.godot` to identify `[autoload]` entries.

## ✅ Completed: Phase 3/3 (Call & Connection Resolution)
- [x] **Signal Tracking**: Tree-sitter query captures `.connect()` calls with `@signal.connection`, `@signal.name`, `@signal.connect`, and `@signal.callable`.
- [x] **Signal Connection Interpretation**: `interpretImport` handles `signal_connection` kind to link signals to callables.
- [x] **Node Reference Resolution**: `@node.reference` capture for `$NodeName` and `%UniqueNode` patterns.
- [x] **Super Call Resolution**: `@super.call` and `@super.method` captures with `super_call` interpretation.
- [x] **Call Extractor**: Created `gdscriptCallConfig` and added `callExtractor` property to provider for CALLS edge generation.
- [x] **Method Call Patterns**: Added `@call`/`@call.name` patterns for `attribute_call` and `base_call` nodes.
- [x] **Built-in Type Resolution**: `createGdscriptBuiltinDefs()` synthesizes SymbolDefinitions for `Button`, `Label`, `Signal`, etc.
- [x] **Mixed Chain Resolution**: `walkMixedChain` resolves compound receivers like `btn.pressed.connect()`.
- [x] **CALLS Edge Emission**: Integration test `emits CALLS edges for method calls on built-in types` passes.

## 🧪 Testing & Robustness
- [x] **Basic Runtime Verification**: `verify_gdscript_runtime.js` passes with 23 captures extracted from sample code.
- [x] **Integration Test**: `test/integration/resolvers/gdscript.test.ts` passes (2/2 tests).
- [ ] **Expand Test Suite**: Update `verify_gdscript_runtime.js` with:
  [ ]  - Inheritance chains.
  [ ]  - Resource loading (`preload`/`load`).
  [ ]  - Node reference resolution (`$NodeName`, `%UniqueNode`).