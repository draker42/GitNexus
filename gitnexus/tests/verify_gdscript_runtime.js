import { gdscriptProvider } from '../dist/core/ingestion/languages/gdscript/index.js';
import fs from 'fs';
import path from 'path';
// 1. Import the utility from the 'module' built-in
import { createRequire } from 'module';
import Parser from 'tree-sitter';
import 'tree-sitter-gdscript';

// 2. Create a local 'require' function
const require = createRequire(import.meta.url);

// 3. Now you can safely use require for CJS packages
try {
    const gdscript = require('tree-sitter-gdscript');
    const parser = new Parser();
    parser.setLanguage(gdscript);
    console.log("✅ GDScript Grammar loaded successfully");
    console.log("✅ Parser is functional");
} catch (e) {
    console.error("❌ GDScript Grammar failed to load:");
    console.error(e.message);
    process.exit(1);
}

async function runTest() {
  console.log('🚀 Starting GDScript Provider Integration Test...');

  try {
    // 1. Verify Provider Identity
    console.log(`Checking provider ID: ${gdscriptProvider.id}`);
    if (gdscriptProvider.id !== 'gdscript') {
      throw new Error(`Expected ID 'gdscript', but got '${gdscriptProvider.id}'`);
    }
    console.log('✅ Provider ID is correct.');

    // 2. Verify Extensions
    console.log(`Checking extensions: ${gdscriptProvider.extensions.join(', ')}`);
    if (!gdscriptProvider.extensions.includes('.gd')) {
      throw new Error('GDScript extension (.gd) is missing from provider!');
    }
    console.log('✅ Extensions are correctly configured.');

    // 3. Verify Queries existence
    if (!gdscriptProvider.queries || Object.keys(gdscriptProvider.queries).length === 0) {
      throw new Error('GDScript queries are empty or missing!');
    }
    console.log('✅ Tree-Sitter queries are loaded.');

    // 4. Simulate Parse Call (Structural Check)
    console.log('Simulating parse() execution...');
    const mockCtx = {
      graph: { addNode: () => {}, addEdge: () => {} },
      treeCache: {},
      currentFilePath: '/test/game.gd',
      generateId: (id) => `id-${id}`,
      queryResults: {
        definitions: [],
        properties: [],
        calls: [],
        dependencies: []
      }
    };
    const mockNode = { type: 'source' };

    const result = await gdscriptProvider.parse(mockCtx, mockNode);
    
    if (result && typeof result.symbolsExtracted === 'number') {
      console.log('✅ parse() executed successfully and returned valid metrics.');
    } else {
      throw new Error('parse() did not return expected result structure.');
    }

    console.log('\n✨ ALL GDScript INTEGRATION TESTS PASSED! ✨');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error(error.message);
    process.exit(1);
  }
}

runTest();
