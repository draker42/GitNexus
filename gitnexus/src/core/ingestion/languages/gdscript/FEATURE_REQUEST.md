# Technical Handover Report: GDScript (Godot) Support Implementation
**Status:** Feature Request / Implementation Phase

## 1. Objective
Implement GDScript language support and Godot engine resource analysis within GitNexus to enable cross-file call graph analysis, signal connection tracking, and scene tree mapping.

## 2. Core Technical Assets
### Parser/Grammar
* **Tree-sitter Grammar:** `tree-sitter-gdscript` is available and ready for integration.

## 3. Implementation Requirements

### A. Symbol Extraction Targets
The following language elements must be identified and indexed:
* **Classes:** `class_name` definitions (e.g., `class_name Player extends CharacterBody3D`).
* **Functions:** Standard and virtual methods (e.g., `func _ready()`, `func take_damage(amount: int) -> void`).
* **Signals:** Signal declarations (e.g., `signal health_changed(new_health: int)`).
* **Variables:** `@export` and `@onready` members (e.g., `@export var speed: float = 300.0`).
* **Enums/Constants:** `enum State { IDLE, ... }` and `const MAX_HEALTH: int = 100`.
* **Classes (Internal):** Inner `class` definitions.

### B. Import & Dependency Resolution
To build a functional call graph, the following resolution logic is required:
* **Static Loading:** Resolve `preload("res://path/to/script.gd")`.
* **Dynamic Loading:** Resolve `load("res://path/to/resource.tres")`.
* **Global Registry:** Implement a registry for all `class_name` declarations across the workspace.
* **Autoloads:** Parse `project.godot` `[autoload]` section to identify global singletons.
* **Scene References:** Support `%UniqueNode` (Scene Unique Nodes) references.

### C. Call & Connection Resolution
The knowledge graph must resolve:
* **Node-to-Method:** Method calls via node references (e.g., `$Player.take_damage(10)`).
* **Signal-to-Callable:** Connection tracking (e.g., `health_changed.connect(_on_health_changed)`).
* **Engine Callbacks:** Identification of engine virtual methods (`_ready`, `_process`, `_physics_process`).
* **Inheritance:** `super` calls and class hierarchy (extends).
* **Static Access:** Class-based static method calls (e.g., `ClassName.static_method()`).

## 4. File Scope & Filtering

| Extension | Role | Action |
| :--- | :--- | :--- |
| `.gd` | GDScript Source | Primary parsing target |
| `project.godot` | Project Config | Autoloads, Input Map, and Project Settings |

**Excluded Directories:**
* `.godot/` (Internal engine cache/metadata)
* `addons/` (Third-party plugins - optional, suggest excluding by default to reduce noise)
