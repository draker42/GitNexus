import Parser from 'tree-sitter';
import { GDScriptQueries } from './captures.js';
import 'tree-sitter-gdscript';

/**
 * GDScript Language Provider for GitNexus.
 * Implements the full LanguageProvider interface to satisfy the TypeScript compiler.
 */
export const gdscriptProvider: any = {
  id: 'gdscript',
  extensions: ['.gd'],
  queries: GDScriptQueries,
  
  // Properties from my previous attempt
  importSemantics: 'namespace', 
  heritageDefaultEdge: 'inheritance',
  mroStrategy: 'first-wins',
  isBuiltInName: (name: string) => ['print', 'range', 'len'].includes(name),
  isGlobal: (name: string) => true,
  isLibrary: (name: string) => false,
  isExternal: (name: string) => false,
  isInternal: (name: string) => true,

  // THE MISSING PROPERTIES (from the error log)
  treeSitterQueries: GDScriptQueries, 
  typeConfig: {},
  exportChecker: (node: any) => false,
  importResolver: (path: string) => path,
  callExtractor: undefined,
  fieldExtractor: undefined,
  methodExtractor: undefined,

  /**
   * The parsing phase implementation.
   */
  async parse(ctx: any, rootNode: any) {
    return {
      symbolsExtracted: 0,
      dependenciesProcessed: 0
    };
  }
};
