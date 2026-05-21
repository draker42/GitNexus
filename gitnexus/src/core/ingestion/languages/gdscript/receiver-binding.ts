// gitnexus/src/core/ingestion/languages/gdscript/receiver-binding.ts

/**
 * Synthesize `@type-binding.self` captures for GDScript methods.
 * GDScript methods implicitly receive `self` as the first parameter.
 *
 * In GDScript, the tree structure is:
 *   (source (class_name_statement name: ...) (extends_statement ...) (function_definition ...))
 * Unlike Python, functions are siblings of class_name_statement, not nested inside a class_definition.
 */

import type { CaptureMatch } from 'gitnexus-shared';
import { syntheticCapture, type SyntaxNode } from '../../utils/ast-helpers.js';

/**
 * Find the class name from a GDScript file.
 * Looks for class_name_statement or class_definition preceding/sibling to the function.
 */
function findClassName(rootNode: SyntaxNode, fnNode: SyntaxNode): string | null {
  // Look for class_name_statement anywhere in the file (GDScript style)
  for (const classStmt of rootNode.descendantsOfType('class_name_statement')) {
    const nameChild = classStmt.childForFieldName('name');
    if (nameChild) return nameChild.text;
  }
  // Also check for class_definition (traditional style)
  for (const classDef of rootNode.descendantsOfType('class_definition')) {
    const nameChild = classDef.childForFieldName('name');
    if (nameChild) return nameChild.text;
  }
  return null;
}

/**
 * Check if this function is inside any class context by looking at the file structure.
 * In GDScript, if there's a class_name_statement anywhere in the file, all functions
 * are methods of that class.
 */
function isInClassContext(rootNode: SyntaxNode): boolean {
  // Check if there's a class_name_statement or class_definition in the file
  for (const node of rootNode.children) {
    if (node.type === 'class_name_statement' || node.type === 'class_definition') {
      return true;
    }
  }
  return false;
}

/**
 * Build a `@type-binding.self` match for a GDScript method.
 * GDScript methods always have `self` as implicit receiver.
 */
export function synthesizeGdscriptReceiverBinding(fnNode: SyntaxNode): CaptureMatch | null {
  // Get the root source node
  let root: SyntaxNode = fnNode;
  while (root.parent !== null) {
    root = root.parent;
  }
  
  if (!isInClassContext(root)) return null;
  
  const className = findClassName(root, fnNode);
  if (className === null) return null;

  // In GDScript, `self` is always the receiver in methods
  return {
    '@type-binding.self': syntheticCapture('@type-binding.self', fnNode, 'self'),
    '@type-binding.name': syntheticCapture('@type-binding.name', fnNode, 'self'),
    '@type-binding.type': syntheticCapture('@type-binding.type', fnNode, className),
  };
}
