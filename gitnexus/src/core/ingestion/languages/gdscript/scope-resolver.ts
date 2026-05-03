import { GDSCRIPT_QUERIES } from '../../tree-sitter-queries.js';

/**
 * GDScript Scope Resolver.
 * Handles GDScript-specific symbol visibility, including 'extends' and 'preloads'.
 */
export class GDScriptScopeResolver {
  constructor(private treeCache: any, private context: any) {}

  /**
   * Processes dependency nodes like 'extends' and 'preloads'.
   * 
   * @param node The AST node representing a dependency.
   * @param currentFile The path of the file being processed.
   */
  async processDependency(node: any, currentFile: string): Promise<void> {
    const { graph } = this.context;

    // Handle 'extends'
    // The query captures @dependency.extends from the 'extends_statement'
    if (node.type === 'extends_statement') {
      const baseTypeNode = node.childForFieldName('base_type');
      if (baseTypeNode) {
        const baseClassName = baseTypeNode.text;
        console.log(`[GDScriptResolver] Found extends: ${baseClassName} in ${currentFile}`);
        
        // Create the inheritance edge in the graph
        // We use a generic 'CLASS_INHERITS' relation
        graph.addEdge(currentFile, baseClassName, { type: 'CLASS_INHERITS' });
      }
    }

    // Handle 'preload'
    // The query captures @dependency.preload from the 'preload_statement'
    if (node.type === 'preload_statement') {
      const pathNode = node.childForFieldName('path');
      if (pathNode) {
        const resourcePath = pathNode.text.replace(/['"]/g, ''); // Strip quotes
        console.log(`[GDScriptResolver] Found preload: ${resourcePath} in ${currentFile}`);
        
        // Create the preload edge in the graph
        graph.addEdge(currentFile, resourcePath, { type: 'PRELOADS' });
      }
    }
  }

  /**
   * Resolves the target of a call or property access in GDScript.
   * 
   * @param callNode The AST node representing the call site.
   * @param currentFile The path of the file being processed.
   */
  async resolve(callNode: any, currentFile: string): Promise<any> {
    const { graph } = this.context;

    // 1. Check if the call is to a local symbol in the current file
    // This is a simplified lookup. A full implementation would traverse the 'CLASS_INHERITS' edges.
    const localSymbols = graph.getIncomingEdges(currentFile, 'DEFINES');
    const match = localSymbols.find(s => s.target === callNode.text);

    if (match) {
      return {
        resolved: true,
        target: match.target,
        type: 'local'
      };
    }

    // 2. Check the inheritance chain (Simplified)
    const inheritanceEdges = graph.getIncomingEdges(currentFile, 'CLASS_INHERITS');
    for (const edge of inheritanceEdges) {
      const parentClass = edge.target;
      const parentSymbols = graph.getIncomingEdges(parentClass, 'DEFINES');
      const parentMatch = parentSymbols.find(s => s.target === callNode.text);
      
      if (parentMatch) {
        return {
          resolved: true,
          target: parentMatch.target,
          type: 'inherited'
        };
      }
    }

    return null; // Not found in local or immediate parent
  }
}
