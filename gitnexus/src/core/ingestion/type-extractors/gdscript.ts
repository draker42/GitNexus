// gitnexus/src/core/ingestion/type-extractors/gdscript.ts

import type { SyntaxNode } from '../utils/ast-helpers.js';
import type { LanguageTypeConfig, ReturnTypeLookup, ForLoopExtractorContext } from './types.js';
import { extractSimpleTypeName } from './shared.js';

// GDScript variable declarations: `var name` or `var name = value` or `var name: Type = value`
const DECLARATION_NODE_TYPES: ReadonlySet<string> = new Set([
  'variable_statement',
  'assignment',
  'augmented_assignment',
]);

/**
 * GDScript: Extract type binding from a variable declaration.
 * Handles:
 *   - `var name` → no type (undefined)
 *   - `var name = value` → no explicit type annotation
 *   - `var name: Type = value` → Type
 */
const extractDeclaration = (node: SyntaxNode, env: Map<string, string>): void => {
  // GDScript tree-sitter: variable_statement has name and optional type children
  if (node.type === 'variable_statement') {
    const nameNode = node.childForFieldName('name');
    const typeNode = node.childForFieldName('type');
    
    if (!nameNode) return;
    const varName = nameNode.text;
    if (!varName) return;

    if (typeNode) {
      const typeName = extractSimpleTypeName(typeNode) ?? typeNode.text;
      env.set(varName, typeName);
    }
    return;
  }

  // Assignment: `name = value` (may be inside expression_statement)
  // For `var btn = Button.new()`, the tree-sitter produces an assignment node
  if (node.type === 'assignment') {
    const left = node.childForFieldName('left');
    if (left?.type === 'name' || left?.type === 'identifier') {
      // Don't set type here - extractInitializer handles constructor inference
    }
  }
};

/**
 * GDScript: parameter with optional type annotation
 * `func name(param):` or `func name(param: Type):`
 */
const extractParameter = (node: SyntaxNode, env: Map<string, string>): void => {
  let nameNode: SyntaxNode | null = null;
  let typeNode: SyntaxNode | null = null;

  // GDScript function parameters
  if (node.type === 'parameter') {
    nameNode = node.childForFieldName('name') ?? node.firstNamedChild;
    typeNode = node.childForFieldName('type');
  } else if (node.type === 'default_parameter') {
    nameNode = node.childForFieldName('name');
    typeNode = node.childForFieldName('type');
  }

  if (!nameNode) return;
  const varName = nameNode.text;
  if (!varName) return;

  if (typeNode) {
    const typeName = extractSimpleTypeName(typeNode) ?? typeNode.text;
    env.set(varName, typeName);
  }
};

/**
 * GDScript: Infer variable type from constructor call.
 * `var btn = Button.new()` → btn has type Button
 * `var label = Label.new()` → label has type Label
 */
const extractInitializer = (
  node: SyntaxNode,
  env: Map<string, string>,
  classNames: { has(name: string): boolean },
): void => {
  let left: SyntaxNode | null = null;
  let right: SyntaxNode | null = null;

  if (node.type === 'assignment') {
    left = node.childForFieldName('left');
    right = node.childForFieldName('right');
    // Skip if already has type annotation
    if (node.childForFieldName('type')) return;
  } else {
    return;
  }

  if (!left || !right) return;
  
  const varName = left.text;
  if (!varName || env.has(varName)) return;

  // Handle Button.new() pattern - attribute_call inside attribute
  // For `Button.new()`, the structure is: attribute(identifier:Button, attribute_call(identifier:new))
  if (right.type === 'attribute') {
    const callNode = right.lastNamedChild;
    if (callNode?.type === 'attribute_call') {
      // Check if the method name is 'new' or a constructor-like name
      const methodNameNode = callNode.childForFieldName('name') ?? callNode.firstNamedChild;
      const methodName = methodNameNode?.text;
      
      if (methodName === 'new' || methodName === 'instance' || methodName === 'create') {
        // The receiver class name is the first child of the attribute
        const className = right.firstNamedChild?.text;
        if (className && (classNames.has(className) || isBuiltInType(className))) {
          env.set(varName, className);
        }
      }
    }
  }

  // Handle base_call pattern: `Button.new()` as a direct call
  if (right.type === 'base_call') {
    const callee = right.childForFieldName('name') ?? right.firstNamedChild;
    const calleeName = callee?.text;
    if (calleeName && (classNames.has(calleeName) || isBuiltInType(calleeName))) {
      env.set(varName, calleeName);
    }
  }
};

/** Built-in Godot types that don't have explicit class definitions */
function isBuiltInType(name: string): boolean {
  const builtins = new Set([
    'int', 'float', 'String', 'Node', 'Resource', 'Array', 'Dictionary',
    'Vector2', 'Vector3', 'bool', 'StringName', 'Color', 'Rect2',
    'Transform2D', 'Transform3D', 'Plane', 'AABB', 'Quaternion',
    'Button', 'Label', 'Control', 'Node2D', 'Node3D', 'Object',
    'PackedScene', 'ResourceLoader', 'File', 'DirAccess'
  ]);
  return builtins.has(name);
}

/**
 * GDScript: Scan for `var = Class.new()` or `var = Class()` patterns.
 * Called during buildTypeEnv walk to collect constructor bindings.
 */
const scanConstructorBinding = (node: SyntaxNode): { varName: string; calleeName: string } | undefined => {
  if (node.type !== 'assignment') return undefined;

  const left = node.childForFieldName('left');
  const right = node.childForFieldName('right');
  if (!left || !right) return undefined;

  // Handle `var = Class.new()`
  if (right.type === 'attribute') {
    const callNode = right.lastNamedChild;
    if (callNode?.type === 'attribute_call') {
      const methodNameNode = callNode.childForFieldName('name') ?? callNode.firstNamedChild;
      const methodName = methodNameNode?.text;
      
      if (methodName === 'new' || methodName === 'instance' || methodName === 'create') {
        const className = right.firstNamedChild?.text;
        if (className) {
          return { varName: left.text, calleeName: className };
        }
      }
    }
  }

  // Handle `var = Class()`
  if (right.type === 'base_call') {
    const callee = right.childForFieldName('name') ?? right.firstNamedChild;
    const calleeName = callee?.text;
    if (calleeName) {
      return { varName: left.text, calleeName };
    }
  }

  return undefined;
};

/**
 * GDScript: Extract loop variable type from for-in loops.
 * `for child in items:` - tries to infer child's type from items variable.
 */
const extractForLoopBinding = (node: SyntaxNode, ctx: ForLoopExtractorContext): void => {
  if (node.type !== 'for_statement' && node.type !== 'for') return;

  const varNode = node.childForFieldName('name');
  if (!varNode || varNode.type !== 'identifier') return;

  const varName = varNode.text;
  if (!varName || ctx.scopeEnv.has(varName)) return;

  // Get the iterable expression
  const iterableNode = node.childForFieldName('iterable') ?? node.namedChildren[1];
  if (!iterableNode) return;

  // For `for child in collection.get_children()`:
  // The iterable is an attribute call - we need the receiver type
  if (iterableNode.type === 'attribute' || iterableNode.type === 'call') {
    // Try to find the return type of the call
    const callName = extractCallName(iterableNode);
    if (callName) {
      const elemType = ctx.returnTypeLookup.lookupReturnType(callName);
      if (elemType) {
        ctx.scopeEnv.set(varName, elemType);
      }
    }
  }
};

/** Extract the call/function name from an attribute or call node */
function extractCallName(node: SyntaxNode): string | undefined {
  // For `obj.method()`, get 'method' from attribute_call
  if (node.type === 'attribute') {
    const callNode = node.lastNamedChild;
    if (callNode?.type === 'attribute_call') {
      const nameNode = callNode.childForFieldName('name') ?? callNode.firstNamedChild;
      return nameNode?.text;
    }
  }
  // For `method()` as a base_call
  if (node.type === 'base_call') {
    const nameNode = node.childForFieldName('name') ?? node.firstNamedChild;
    return nameNode?.text;
  }
  return undefined;
}

export const gdscriptTypeConfig: LanguageTypeConfig = {
  declarationNodeTypes: DECLARATION_NODE_TYPES,
  extractDeclaration,
  extractParameter,
  extractInitializer,
  scanConstructorBinding,
  extractForLoopBinding,
};
