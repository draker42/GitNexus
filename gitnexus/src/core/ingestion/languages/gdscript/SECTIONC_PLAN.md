# Section C: Call & Connection Resolution Plan

## Overview
This plan implements the final stage of GDScript support: building a functional call graph with signal connections, node references, and inheritance resolution.

## Feature Request Requirements (Section C)
- [ ] **Node-to-Method**: Method calls via node references (e.g., `$Player.take_damage(10)`)
- [ ] **Signal-to-Callable**: Connection tracking (e.g., `health_changed.connect(_on_health_changed)`)
- [ ] **Engine Callbacks**: Identification of engine virtual methods (`_ready`, `_process`, `_physics_process`)
- [ ] **Inheritance**: `super` calls and class hierarchy (extends)
- [ ] **Static Access**: Class-based static method calls (e.g., `ClassName.static_method()`)

## Phase 1: Call Graph Resolution

### 1.1 Node References (`$NodeName`)
**Pattern:** `$Player`, `$Weapon` - GDScript built-in shortcut for `get_node("Player")`

**Implementation:**
- Add `typeConfig` entry for `$` prefix node references
- Tree-sitter query: `(node_reference (identifier) @node.ref)`
- Create `CALLS` edges to target nodes in the scene tree

**File:** `src/core/ingestion/languages/gdscript/node-queries.ts`

### 1.2 Scene Unique Nodes (`%UniqueNode`)
**Pattern:** `%HealthBar` - References to nodes marked as "Scene Unique" in the editor

**Implementation:**
- Tree-sitter query: `(scene_unique_reference (identifier) @scene_unique.ref)`
- Track these as special node references with uniqueness constraint

**File:** `src/core/ingestion/languages/gdscript/node-queries.ts`

## Phase 2: Signal Connection Resolution

### 2.1 Signal Declaration Tracking
**Pattern:** `signal health_changed(new_health: int)`

**Current Status:** Already captured as symbols via `typeConfig`

**Enhancement:**
- Add `signal` type to symbol extraction
- Store signal name and parameters in symbol metadata

### 2.2 Connection Detection
**Pattern:** `health_changed.connect(_on_health_changed)`

**Implementation:**
- Tree-sitter query for `.connect(` method calls
- Query: `(call (member) @signal.connect (#eq? @signal.connect "connect"))`
- Capture the signal name (receiver) and callable (first argument)
- Create bidirectional edges: `Signal` → `Callable` and `Callable` → `Signal`

**File:** `src/core/ingestion/languages/gdscript/signal-queries.ts`

## Phase 3: Inheritance Resolution

### 3.1 `super` Calls
**Pattern:** `super._ready()`, `super.take_damage(amount)`

**Implementation:**
- Tree-sitter query: `(super_call (identifier)? @super.method)`
- Trace calls up the inheritance chain
- Create `METHOD_CALLS` edges with inheritance context

### 3.2 Class Hierarchy
**Pattern:** `class_name Player extends CharacterBody3D`

**Current Status:** Already captured via `extends_statement` in `GDSCRIPT_QUERIES`

**Enhancement:**
- Ensure `EXTENDS` relations are created in `interpretImport`
- Implement MRO (Method Resolution Order) traversal for method lookup

## Phase 4: Engine Virtual Methods

### 4.1 Callback Identification
**Patterns:** `_ready`, `_process`, `_physics_process`, `_input`, `_unhandled_input`

**Implementation:**
- Mark these functions with `isEngineCallback: true` in symbol metadata
- Add to built-ins list with special handling
- Tree-sitter query: Already covered by function capture, just add semantic flag

## Phase 5: Static Class Access

### 5.1 Static Method Calls
**Pattern:** `ClassName.static_method()`

**Implementation:**
- Tree-sitter query: `(call (identifier) @static.class)`
- Requires symbol resolution to identify if identifier is a `class_name`
- Look up class in global registry, link to method

## Implementation Order (High to Low Priority)

| Priority | Feature | File | Complexity |
|----------|---------|------|------------|
| 1 | Signal-to-Callable connections | signal-queries.ts | Medium |
| 2 | `super` calls | inheritance.ts | Low |
| 3 | Node references (`$`, `%`) | node-queries.ts | Medium |
| 4 | Static class access | static-access.ts | High |
| 5 | Engine callbacks | Already in typeConfig | Low |

## Testing Strategy

Add to `verify_gdscript_runtime.js`:
```javascript
const signalCode = `
signal health_changed(new_health: int)
func _on_health_changed(health):
\tpass
func _ready():
\thealth_changed.connect(_on_health_changed)
`;
const nodeCode = `
func _ready():
\t$Player.take_damage(10)
\t%HealthBar.value = 50
`;
const superCode = `
func _ready():
\tsuper._ready()
\tsuper.take_damage(10)
`;
```

## Dependency Notes
- Requires global class registry (Phase 2 output)
- Signal resolution depends on symbol extraction (Phase 1 output)
- Node resolution requires scene tree analysis (future enhancement)