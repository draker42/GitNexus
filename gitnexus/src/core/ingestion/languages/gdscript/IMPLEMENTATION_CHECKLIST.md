```markdown
    [ ] Implement parse(ctx, rootNode):
        Use the Parser instance to parse the file content.
        Iterate through the GDSCRIPT_QUERIES defined in captures.ts.
    [ ] Extract Node Types:
        Look for class_definition $\to$ Create Class symbol.
            Look for function_definition $\to$ Create Function symbol.
        Look for var_declaration $\to$ Create Variable symbol.
    [ ] Resolve Scopes:
        Use your GDScriptScopeResolver to handle extends and preload statements so that dependencies are correctly linked in the Knowledge Graph.
    [ ] Update Tests:
        Create a new test file: tests/verify_gdscript_extraction.js.
        This test should pass a string of actual GDScript code and assert that the number of extracted symbols is $> 0$.
```
