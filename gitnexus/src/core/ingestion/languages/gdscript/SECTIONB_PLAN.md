To implement the Static Loading requirement (preload("res://path/to/script.gd")), we need to extend the existing import resolution infrastructure to recognize GDScript's res:// URI scheme and map it to the local filesystem.

Based on the codebase structure, the implementation should follow this architectural path:

# 1. Proposed Implementation Strategy

The resolution of preload is not a standard file-system import (like import in TS or from in Python), but a function call with a string literal. Therefore, we need a multi-layered approach.

# 2. Detailed Action Plan

Task	Component	Description
## 1. Query Update	tree-sitter-queries.ts	Add a new query pattern to capture preload and load calls specifically, capturing the string argument as a dependency.
## 2. Resolver Logic	import-resolvers/	Create or extend a GDScript-specific resolver (likely via resolver-factory.ts) that handles the res:// to filesystem path translation.
## 3. Path Mapping	utils/ or config/	Implement a utility to resolve res:// relative to the project root (where project.godot resides).
## 4. Integration	import-processor.ts	Ensure the import-processor triggers the GDScript resolver when it encounters these specific call patterns during the ingestion phase.

# 3. Immediate Next Steps

To proceed, I recommend we perform the following technical deep-dives:

    Analyze existing Import Resolvers: I need to examine gitnexus/src/core/ingestion/import-resolvers/standard.ts and gitnexus/src/core/ingestion/import-resolvers/factory.ts to see how the system currently handles language-specific import logic.
    Define the res:// mapping utility: We need to determine how the "Project Root" is identified during the filesystem-walker phase so that res:// can be anchored correctly.
    Draft the Tree-Sitter Query: We need to write the specific pattern for (call_expression function: (identifier) @func_name argument: (string_literal) @import_path).

-----

# Proposed Implementation Plan (Technical Detail)

I will implement a new resolver strategy that follows the pattern used by Rust and TypeScript.

## Step 1: The Resolver Logic

We need a function that:

  - Checks if importPath starts with res://.
  - If it does, strips res://.
  - Prepends the Project Root (the directory containing project.godot).
  - Validates that the resulting path exists in allFiles.

## Step 2: Integration via resolver-factory.ts

We should register a new ImportResolverStrategy for GDScript. Based on the createStandardStrategy pattern src/core/ingestion/import-resolvers/standard.ts:181, we can create a createGDScriptStrategy.

## Step 3: The "Project Root" Problem

The resolveImportPath function receives currentFile but does not explicitly receive the projectRoot. However, since res:// is absolute to the project, we can derive the project root by finding the highest directory in the allFiles set that contains a project.godot file, or by tracking the root during the filesystem-walker phase.

Architectural Findings

    The Factory Pattern: createImportResolver takes an ImportResolutionConfig and returns a single ImportResolverFn. It iterates through an array of strategies and returns the first non-null ImportResult src/core/ingestion/import-resolvers/resolver-factory.ts:31-36.
    The Strategy Signature: Each strategy (and the final resolver) follows the signature: (rawImportPath: string, filePath: string, ctx: ResolveCtx) => ImportResult src/core/ingestion/import-resolvers/types.ts:56.
    The Result Types: A strategy can return:
        { kind: 'files'; files: string[] }: Direct file mapping (Perfect for preload).
        { kind: 'package'; files: string[]; dirSuffix: string }: Directory/Package mapping (Perfect for res:// folders).
        null: Pass the responsibility to the next strategy in the chain.

Implementation Plan for GDScript

To implement the Static Loading requirement, I will follow the existing pattern of creating a language-specific strategy and injecting it into the factory.
## 1. Create gdscript-resolver.ts

I will implement a new strategy file: src/core/ingestion/import-resolvers/gdscript.ts.

STATUS: DONE!

The Logic:
export const gdscriptResResolver: ImportResolverStrategy = (rawPath, filePath, ctx) => {
  if (!rawPath.startsWith("res://")) return null; // Pass to next strategy

  // 1. Convert res:// to filesystem path
  // We need to find the project root.
  // Strategy: Find the highest directory in ctx.allFilePaths that contains 'project.godot'
  const projectRoot = findProjectRoot(ctx);
  const filesystemPath = rawPath.replace("res://", projectRoot + "/");

  // 2. Validate existence
  if (ctx.allFilePaths.has(filesystemPath)) {
    return { kind: 'files', files: [filesystemPath] };
  }

  return null; // Path not found in current workspace
};

## 2. Update language-config.ts (or equivalent)

I need to find where ImportResolutionConfig is instantiated for each language. I will look for the language-provider or language-config logic to register the gdscriptResResolver into the strategies array for the gdscript language.

3. Update tree-sitter-queries.ts

I will add the query to capture the string literal inside preload() or load() calls.
This is still not right:
```
(call
  function: (identifier) @func_name
  (#match? @func_name "^(preload|load)$")
  arguments: (argument_list (string_literal) @import_path)
) @import_call
```

This is the syntax for `call` in the `node-types.json`:
```
======= "call" ========
"call"
true
{ "arguments": { "multiple": false, "required": true, "types": [ { "type": "arguments", "named": true } ] } } { "multiple": false, "required": true, "types": [ { "type": "_primary_expression", "named": true } ] }
```
Here is my current (working) `tree-sitter-queries.ts` entry for `call`.
```
(call arguments:
  (arguments) @call_arguments) @call_function
```
We have to get the syntax *perfect*.
