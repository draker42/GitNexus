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
        Create a new test file: tests/verify_gdscript_extraction.js.
        This test should pass a string of actual GDScript code and assert that the number of extracted symbols is $> 0$.

# Plan to finish above items is as follows:

Phase 1: Fix Provider Registration (Critical)

    Complete gdscriptProvider Interface: Implement the missing properties identified in the source code:
        importSemantics: Handle preload and extends logic. cap heritageDefaultEdge: Define how extends creates EXTENDS relations.
        mroStrategy: Implement GDScript-specific Method Resolution Order logic.
        isBuiltInName: Define GDScript built-in types (e.g., int, float, String, Node).

Phase 2: Implement Dependency Linking

    Implement extends logic: When an extends_statement is matched, use ctx.model.addDependency to link the current class to the base type src/core/ingestion/languages/gdscript/captures.ts:32.
    Implement preload logic: Parse preload_statement to create IMPORTS relations between the current file and the target resource src/core/ingestion/languages/gdscript/captures.ts:35.

Phase 3: Robustness & Testing

    Fix Native Binding: Ensure the npm rebuild tree-sitter-gdscript step is part of the standard postinstall or prepare lifecycle to prevent the "parser not available" error in CI/CD.
    Expand Test Suite: Update tests/verify_gdscript_runtime.js to include complex scenarios:
        Inheritance chains (extends).
        Resource loading (preload).
        Nested class definitions.

```
