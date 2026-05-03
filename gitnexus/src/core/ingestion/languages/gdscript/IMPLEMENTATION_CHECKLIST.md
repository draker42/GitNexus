```markdown
# Original checklist, partially completed with some dummy functions:

    [.] Implement parse(ctx, rootNode):
        Use the Parser instance to parse the file content.
        Iterate through the GDSCRIPT_QUERIES defined in captures.ts.
    [.] Extract Node Types:
        Look for class_definition $\to$ Create Class symbol.
            Look for function_definition $\to$ Create Function symbol.
        Look for var_declaration $\to$ Create Variable symbol.
    [.] Resolve Scopes:
        Use your GDScriptScopeResolver to handle extends and preload statements so that dependencies are correctly linked in the Knowledge Graph.
    [ ] Update Tests:
        Create a new test file: `gitnexus/tests/verify_gdscript_extraction.js`.
        This test should pass a string of actual GDScript code and assert that the number of extracted symbols is $> 0$.

# Plan to finish above items is as follows:

## Phase 1: Fix Provider Registration (Critical)

    Complete gdscriptProvider Interface: Implement the missing properties identified in the source code:
    [x] importSemantics: Handle preload and extends logic. cap
    [x] heritageDefaultEdge: Define how extends creates EXTENDS relations.
    [x] mroStrategy: Implement GDScript-specific Method Resolution Order logic.
    [x] isBuiltInName: Define GDScript built-in types (e.g., int, float, String, Node).

## Phase 2: Implement Dependency Linking

    [.] Implement extends logic: When an extends_statement is matched, use ctx.model.addDependency to link the current class to the base type src/core/ingestion/languages/gdscript/captures.ts:32.
    [.] Implement preload logic: Parse preload_statement to create IMPORTS relations between the current file and the target resource src/core/ingestion/languages/gdscript/captures.ts:35.

## Phase 3: Robustness & Testing

    Fix Native Binding: Ensure the npm rebuild tree-sitter-gdscript step is part of the standard postinstall or prepare lifecycle to prevent the "parser not available" error in CI/CD.
    Expand Test Suite: Update `gitnexus/tests/verify_gdscript_runtime.js` to include complex scenarios:
     [ ] Inheritance chains (extends).
     [ ] Resource loading (preload).
     [ ] Nested class definitions.


# Critical Gaps
| Category |	Missing Requirement |	Impact |
| Symbols |	signal, enum, const, class_name |	Incomplete Knowledge Graph; cannot track signal-driven logic. |
| Dependencies	| load(), project.godot (Autoloads) |	Broken call graphs for dynamically loaded resources and singletons. |
| Call Graph |	signal.connect(), $Node, %Node |	Cannot trace execution flow from signals to methods or node-based calls. |
| Context |	super calls, Static access |	Inability to resolve inheritance-based method overrides. |

# Detailed Task Breakdown
## Phase 1: Symbol Expansion (The "Completeness" Phase)

    [x] Update typeConfig.declarationNodeTypes: Include signal_definition, enum_definition, const_definition, and class_definition index.ts:118.
    [x] Implement class_name extraction: Ensure class_name declarations are indexed to populate the Global Registry.
    [ ] Enhance Variable Extraction: Support @export and @onready annotations specifically.

## Phase 2: Dependency & Global Scope (The "Connectivity" Phase)

    [ ] Implement load() Resolver: Extend interpretImport to handle load("res://...") patterns.
    [ ] Autoload Integration: Create a new parser for project.godot to identify [autoload] entries and add them to the importResolver index.ts:134.
    [ ] Global Registry: Implement a mechanism to cross-reference class_name declarations with extends statements.

## Phase 3: Call & Connection Logic (The "Intelligence" Phase)

    [ ] Signal Tracking: Implement logic in emitScopeCaptures to detect .connect() calls and link the signal to the target callable.
    [ ] Node Reference Resolution: Add logic to typeConfig to recognize $NodeName and %UniqueNode patterns and resolve them to the scene tree.
    [ ] Inheritance Resolution: Implement super keyword detection to trace method calls up the class hierarchy.

```
