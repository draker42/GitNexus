// gitnexus/src/core/ingestion/languages/gdscript/type-binding.ts

import type { CaptureMatch } from 'gitnexus-shared';
import { syntheticCapture, type SyntaxNode } from '../../utils/ast-helpers.js';

/**
 * Synthesize type bindings for GDScript constructor calls.
 * Handles `var btn = Button.new()` → btn has type Button
 */
export function synthesizeGdscriptTypeBindings(rootNode: SyntaxNode): CaptureMatch[] {
  const out: CaptureMatch[] = [];

  // Handle variable_statement with constructor initializer
  // GDScript tree-sitter: first named child is 'name', second is value
  for (const node of rootNode.descendantsOfType('variable_statement')) {
    const nameNode = node.namedChild(0);
    const valueNode = node.namedChild(1);
    
    if (!nameNode || !valueNode) continue;
    
    const varName = nameNode.text;
    if (!varName) continue;

    // Check if value is Class.new() pattern
    // In GDScript tree-sitter, Button.new() produces an attribute node
    // with identifier (Button) as first child and attribute_call (new()) as last
    if (valueNode.type === 'attribute') {
      // Check if last named child is attribute_call with method 'new'
      const lastChild = valueNode.namedChild(valueNode.namedChildCount - 1);
      if (lastChild?.type === 'attribute_call') {
        const methodNameNode = lastChild.namedChild(0);
        const methodName = methodNameNode?.text;
        
        if (methodName === 'new' || methodName === 'instance' || methodName === 'create') {
          // The receiver class name is the first named child of the attribute
          const classNameNode = valueNode.namedChild(0);
          const className = classNameNode?.text;
          
          if (className) {
            out.push({
              '@type-binding.constructor': syntheticCapture('@type-binding.constructor', node, 'new'),
              '@type-binding.name': syntheticCapture('@type-binding.name', nameNode, varName),
              '@type-binding.type': syntheticCapture('@type-binding.type', classNameNode, className),
            });
          }
        }
      }
    }

    // Check if value is a direct base_call like getWidget()
    if (valueNode.type === 'base_call') {
      const calleeNode = valueNode.namedChild(0);
      const calleeName = calleeNode?.text;
      
      if (calleeName) {
        out.push({
          '@type-binding.call-return': syntheticCapture('@type-binding.call-return', node, calleeName),
          '@type-binding.name': syntheticCapture('@type-binding.name', nameNode, varName),
          '@type-binding.type': syntheticCapture('@type-binding.type', calleeNode, calleeName),
        });
      }
    }
  }

  // Handle assignment statements: btn = Button.new() (not using var)
  for (const node of rootNode.descendantsOfType('assignment')) {
    // assignment has left and right - check named children
    const left = node.namedChild(0);
    const right = node.namedChild(1);
    
    if (!left || !right) continue;
    
    const varName = left.text;
    if (!varName) continue;

    // Button.new() pattern
    if (right.type === 'attribute') {
      const lastChild = right.namedChild(right.namedChildCount - 1);
      if (lastChild?.type === 'attribute_call') {
        const methodNameNode = lastChild.namedChild(0);
        const methodName = methodNameNode?.text;
        
        if (methodName === 'new' || methodName === 'instance' || methodName === 'create') {
          const classNameNode = right.namedChild(0);
          const className = classNameNode?.text;
          
          if (className) {
            out.push({
              '@type-binding.constructor': syntheticCapture('@type-binding.constructor', node, 'new'),
              '@type-binding.name': syntheticCapture('@type-binding.name', left, varName),
              '@type-binding.type': syntheticCapture('@type-binding.type', classNameNode, className),
            });
          }
        }
      }
    }
  }

  // Handle for loops: for btn in get_buttons() 
  // Try to infer element type from the iterable's return type
  for (const node of rootNode.descendantsOfType('for_statement')) {
    // for_statement structure: (for <name> in <iterable>)
    // First named child is the loop variable name
    const varNode = node.namedChild(0);
    if (!varNode) continue;
    
    const varName = varNode.text;
    if (!varName) continue;

    // Get the iterable - typically the last named child
    const iterableNode = node.namedChild(node.namedChildCount - 1);
    if (!iterableNode) continue;

    // For now, just create a binding that will be resolved later
    // The type resolution will use return type from the callee
    if (iterableNode.type === 'attribute' || iterableNode.type === 'base_call') {
      const calleeName = extractCalleeName(iterableNode);
      if (calleeName) {
        out.push({
          '@type-binding.range': syntheticCapture('@type-binding.range', node, varName),
          '@type-binding.name': syntheticCapture('@type-binding.name', varNode, varName),
          '@type-binding.type': syntheticCapture('@type-binding.type', iterableNode, calleeName + '[]'),
        });
      }
    }
  }

  return out;
}

/** Extract callee/method name from a call node */
function extractCalleeName(node: SyntaxNode): string | undefined {
  if (node.type === 'attribute') {
    // For Button.new() pattern, we want 'new' as the method name
    const lastChild = node.namedChild(node.namedChildCount - 1);
    if (lastChild?.type === 'attribute_call') {
      return lastChild.namedChild(0)?.text;
    }
    // If no attribute_call, return the receiver type for member access
    return node.namedChild(0)?.text;
  }
  if (node.type === 'base_call') {
    return node.namedChild(0)?.text;
  }
  return undefined;
}