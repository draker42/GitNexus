import Parser from 'tree-sitter';
import { GDScriptQueries } from './captures.js';
import gdscript from 'tree-sitter-gdscript';
import { ResolutionContext } from '../../model/resolution-context.js';
import { generateId } from '../../../../lib/utils.js';

/**
 * Traverses up the AST to find if the current node is contained within a class.
 * Returns a stable ID for the class if found, otherwise undefined.
 */
const getClassName = (node: Parser.SyntaxNode): string | undefined => {
  let current = node.parent;
  while (current && current.type !== 'root') {
    // 1. Check if the parent is a class definition
    // Note: 'class_definition' is the Tree-Sitter node type for GDScript
    if (current.type === 'class_definition') {
      // Find the identifier child (the class name)
      const nameNode = current.children.find(c => c.type === 'identifier');
      return nameNode ? nameNode.text : undefined; // ✅ Return the text, not the node
    }
    current = current.parent;
  }
  return undefined;
};

/**
 * Extracts the type of a variable or property.
 * Looks for a child node of type 'type' or 'type_identifier'.
 * 
 * @param node The variable_definition or property node.
 * @returns The string representation of the type (e.g., "int", "String") or undefined.
 */
const extractTypeFromNode = (node: Parser.SyntaxNode): string | undefined => {
  // Search children for the type declaration node
  const typeNode = node.children.find(child => 
    child.type === 'type' || child.type === 'type_identifier'
  );
  
  return typeNode ? typeNode.text : undefined;
};

/**
 * Counts the number of parameters in a function definition.
 * 
 * @param node The function_definition node.
 * @returns The number of parameter nodes found.
 */
const countParameters = (node: Parser.SyntaxNode): number => {
  // 1. Find the 'parameters' container node within the function
  const paramsContainer = node.children.find(child => child.type === 'parameters');
  
  if (!paramsContainer) {
    return 0;
  }

  // 2. Count only the children that are specifically 'parameter' nodes
  // This avoids counting commas, parentheses, or whitespace
  return paramsContainer.children.filter(child => child.type === 'parameter').length;
};

/**
 * Extracts the return type from a function definition.
 * 
 * @param node The function_definition node.
 * @returns The string representation of the return type (e.g., "void", "float") or undefined.
 */
const extractReturnType = (node: Parser.SyntaxNode): string | undefined => {
  // 1. Find the 'return_type' node
  const returnTypeNode = node.children.find(child => child.type === 'return_type');
  
  // 2. Return the text content of that node
  // In Tree-Sitter, the text of the 'return_type' node includes the type name
  return (returnTypeNode ? returnTypeNode.text : undefined);
};


/**     
 * GDScript Language Provider for GitNexus.
 */

export const gdscriptProvider = {
  id: 'gdscript',
  extensions: ['.gd'],
  queries: GDScriptQueries,

 /**
   * The parsing phase implementation.
   * Iterates through Tree-Sitter captures and registers symbols in the context.
   */
  /**
   * @param ctx The resolution context (provides access to model.symbols)
   * @param rootNode The Tree-Sitter root node for the current file
   * @param filePath The path of the file being parsed (CRITICAL for symbol registration)
   */
  async parse(ctx: ResolutionContext, rootNode: Parser.SyntaxNode, filePath: string) {
    let symbolsExtracted = 0;
    let dependenciesProcessed = 0;

    // 1. Initialize the Query Engine
    const query = new Parser.Query(gdscript, GDScriptQueries.definitions);
    const matches = query.matches(rootNode);

    // 2. Process Matches
    for (const match of matches) {
      // Each match contains 'captures' (the nodes identified by @name)
      for (const capture of match.captures) {
        const node = capture.node;
        const captureName = capture.name; // e.g., 'definition.class'
        const nodeName = node.text;

        // 3. Determine if this variable belongs to a class (is it a property?)
        if (captureName.includes('definition.function')) {

          const className = getClassName(node);
          // If it's a top-level function:
//          const funcId = generateId('Function', `${filePath}:${name}`);
          const funcName = node.text;
          const funcId = className 
            ? generateId('Method', `${filePath}:${className}.${funcName}`)
            : generateId('Function', `${filePath}:${funcName}`);

          const qualifiedName = className 
            ? `${className}.${funcName}` 
            : funcName;
          const paramCount = countParameters(node);
          const returnType = extractReturnType(node);

          // 4. Inject into the Symbol Table
          ctx.model.symbols.add(
            filePath,
            funcName,
            funcId,
            'Function',
            {
              parameterCount: paramCount,
              returnType: returnType,
            // If ownerId is undefined, it's a top-level function
              ownerId: className ? `gdscript:${filePath}:${className}` : undefined,
              qualifiedName: qualifiedName
            }
          );
          
          symbolsExtracted++;
        }

        // 5. Class definitions
        if (captureName.includes('definition.class')) {
          // 1. Extract the class name from the identifier child
          const nameNode = node.children.find(c => c.type === 'identifier');
          const className = nameNode ? nameNode.text : 'UnknownClass';
        
          // 2. Generate an ID for the class (used by methods/properties as ownerId)
          // Use the path and the class name to ensure uniqueness across the repo
          const classId = generateId('Class', `${filePath}:${className}`);

          // If it's a method (inside a class):
          // const methodId = generateId('Method', `${filePath}:${className}.${funcName}`);
          // 3. Register the class in the Semantic Model
          ctx.model.symbols.add(
            filePath,
            className,
            classId,
            'Class',
            {
              // Classes don't have parameters, but we can provide the type info
              declaredType: className, 
              ownerId: undefined, // Top-level class
              qualifiedName: className,
            }
          );
        
          symbolsExtracted++;
        }

        // 6. Variable defintions
        if (captureName.includes('definition.variable')) {
          // 1. Extract the variable name
          const nameNode = node.children.find(c => c.type === 'identifier');
          const varName = nameNode ? nameNode.text : 'unknown_var';
        
          // 2. Determine if this variable belongs to a class (is it a property?)
          const className = getClassName(node);

          const varId = className 
            ? generateId('Property', `${filePath}:${className}.${varName}`)
            : generateId('Variable', `${filePath}:${varName}`);

          const qualifiedName = className ? `${className}.${varName}` : varName; 
          const declaredType = extractTypeFromNode(node);

          // 3. Register the variable
          ctx.model.symbols.add(
            filePath,
            varName,
            varId,
            'Variable',
            {
              declaredType: declaredType, // e.g., "int", "String", or "Node"
              ownerId: className ? `gdscript:${filePath}:${className}` : undefined,
              qualifiedName: qualifiedName
            }
          );

          symbolsExtracted++;
        }

        // 7. Handle Dependencies (e.g., 'extends' or 'preload')
        if (captureName === 'extends' || captureName === 'preload') {
          // Logic to find the target node and register the edge
          // This usually involves ctx.model.addDependency(...)
          dependenciesProcessed++;
        }
      }
    }
    return { symbolsExtracted, dependenciesProcessed };
  }

  // 🛠️ Add the missing required properties as stubs
//  async importSemantics: async () => { /* TODO: Implement GDScript import logic */ },
//  async heritageDefaultEdge: undefined, 
//  async mroStrategy: 'none', // or whatever the expected type is
//  async isBuiltInName: (name: string) => ['int', 'float', 'String'].includes(name),
  // ... add the other 4 missing properties mentioned in the error
};
