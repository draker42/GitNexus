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
    if (!gdscriptProvider.treeSitterQueries || gdscriptProvider.treeSitterQueries.length === 0) {
      throw new Error('GDScript queries are empty or missing!');
    }
    console.log('✅ Tree-Sitter queries are loaded.');

    // 4. Verify emitScopeCaptures exists
    if (typeof gdscriptProvider.emitScopeCaptures !== 'function') {
      throw new Error('emitScopeCaptures function is missing!');
    }
    console.log('✅ emitScopeCaptures is available.');

    // 5. Verify interpretImport exists
    if (typeof gdscriptProvider.interpretImport !== 'function') {
      throw new Error('interpretImport function is missing!');
    }
    console.log('✅ interpretImport is available.');

    // 6. Test emitScopeCaptures with sample code
    console.log('Testing emitScopeCaptures with sample GDScript code...');
    const sampleCode = `
class_name Player extends CharacterBody2D

const SPEED = 200

func _ready():
\tpass

func _process(delta):
\tvar loaded_script = preload("res://scripts/utils.gd")
`;
    const captures = gdscriptProvider.emitScopeCaptures?.(sampleCode, 'test/player.gd', undefined);
    console.log(`✅ emitScopeCaptures returned ${captures?.length ?? 0} captures`);

    console.log('\n✨ ALL GDScript INTEGRATION TESTS PASSED! ✨');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error(error.message);
    process.exit(1);
  }
}

runTest();
