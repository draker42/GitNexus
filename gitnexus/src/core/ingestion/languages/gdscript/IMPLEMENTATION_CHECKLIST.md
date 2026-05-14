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

## 🚀 Next Up: Phase 3 (Intelligence)
- [ ] **Signal Tracking**: Implement logic in `emitScopeCaptures` to detect `.connect()` calls and link signals to callables.
- [ ] **Node Reference Resolution**: Add `typeConfig` logic to recognize `$NodeName` and `%UniqueNode` patterns.
- [ ] **Inheritance Resolution**: Implement `super` keyword detection to trace method calls up the hierarchy.
- [ ] **Global Class Registry**: Register all `class_name` declarations in a workspace-wide registry.
- [ ] **Engine Callbacks**: Identify engine virtual methods (`_ready`, `_process`, `_physics_process`).
- [ ] **Static Access**: Class-based static method calls (`ClassName.static_method()`).

## 🧪 Testing & Robustness
- [x] **Basic Runtime Verification**: `verify_gdscript_runtime.js` passes with 23 captures extracted from sample code.
- [ ] **Expand Test Suite**: Update `verify_gdscript_runtime.js` with:
  [ ]  - Inheritance chains.
  [ ]  - Resource loading (`preload`/`load`).
  [ ]  - Signal-to-method connections.
  [ ]  - Node reference resolution (`$NodeName`, `%UniqueNode`).
