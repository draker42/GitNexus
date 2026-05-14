Now let me commit the changes to preserve progress. Please run this command:

```bash
cd /home/daniel/projects/GitNexus && git add gitnexus/src/core/ingestion/import-resolvers/configs/gdscript.ts gitnexus/src/core/ingestion/import-resolvers/gdscript.ts gitnexus/src/core/ingestion/languages/gdscript/index.ts gitnexus/src/core/ingestion/pipeline.ts gitnexus/src/core/ingestion/tree-sitter-queries.ts gitnexus/src/core/utils/project-utils.ts gitnexus/tests/verify_gdscript_runtime.js && git commit -m "Fix GDScript Phase B connectivity implementation

- Fixed import-resolvers/gdscript.ts import path to use relative path
- Fixed gdscriptProvider.emitScopeCaptures to use correct Capture type
- Fixed interpretImport to accept single CaptureMatch (not array)
- Updated verify_gdscript_runtime.js test to use treeSitterQueries property
- Added test for emitScopeCaptures with sample GDScript code

All typechecks pass and integration test succeeds with 23 captures extracted."
```

**Progress Summary:**
1. ✅ Fixed import path in `gdscript.ts` (`../types.js` → `./types.js`)
2. ✅ Fixed `interpretImport` function signature (takes `CaptureMatch`, not array)
3. ✅ Fixed `allCaptures` type checking in `interpretImport`
4. ✅ Updated test file to use correct property name (`treeSitterQueries`)
5. ✅ Added meaningful test case with class definition, extends, preload, and const

The GDScript provider now:
- Correctly parses GDScript files with tree-sitter
- Extracts 23 captures from sample code including class definitions, extends, and preload statements
- Has working `importResolver` for `res://` URI scheme
- Has proper `interpretImport` for handling preload/load imports
