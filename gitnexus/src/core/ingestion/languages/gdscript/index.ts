import Parser from 'tree-sitter';
import gdscript from 'tree-sitter-gdscript';
import { GDSCRIPT_QUERIES } from '../../tree-sitter-queries.js';
import { loadParser, loadLanguage } from '../../../tree-sitter/parser-loader.js';
import { defineLanguage,
        type LanguageProvider,
        type ImportSemantics} from '../../language-provider.js';
import { SupportedLanguages } from 'gitnexus-shared';
import type {
  MroStrategy,
  Capture,
  CaptureMatch
} from 'gitnexus-shared';
import type { ImportResult, ImportResolverFn, ResolveCtx } from '../../import-resolvers/types.js';
import type { LanguageTypeConfig } from '../../type-extractors/types.js';
import type { ExportChecker } from '../../export-detection.js';

// 1. Constants & Built-ins
const BUILT_INS: ReadonlySet<string> = new Set([
  'int', 'float', 'String', 'Node', 'Resource', 'Array', 'Dictionary', 
  'Vector2', 'Vector3', 'bool', 'StringName', 'Color', 'Rect2', 
  'Transform2D', 'Transform3D', 'Plane', 'AABB', 'Quaternion'
]);

/**
 * A module-scoped cache to bridge the gap between parsing and interpretation.
 * Key: A unique string representing the node's location (filePath:line:col)
 * Value: The actual Tree-Sitter SyntaxNode
 */
const nodeCache = new Map<string, Parser.SyntaxNode>();

/**
 * Generates a unique key for a node based on its location in a specific file.
 */
//const getCacheKey = (filePath: string, range: any) =>
//  `${filePath}:${range.startLine}:${range.startTreeSitterColumn}`;
const getCacheKey = (filePath: string, startLine: number, startCol: number) =>
  `${filePath}:${startLine}:${startCol}`;

const GDScriptTreeSitterQueries = GDSCRIPT_QUERIES;

// 2. Helper Functions (Internal to the module)
const getClassName = (node: Parser.SyntaxNode): string | undefined => {
  let current = node.parent;
  while (current && current.type !== 'root') {
    if (current.type === 'class_definition') {
      const nameNode = current.children.find(c => c.type === 'identifier');
      return nameNode ? nameNode.text : undefined;
    }
    current = current.parent;
  }
  return undefined;
};

const extractTypeFromNode = (node: Parser.SyntaxNode): string | undefined => {
  const typeNode = node.children.find(child => 
    child.type === 'type' || child.type === 'type_identifier'
  );
  return typeNode ? typeNode.text : undefined;
};

// 3. The Provider Definition
export const gdscriptProvider: LanguageProvider = defineLanguage({
  id: SupportedLanguages.GDScript,
  extensions: ['.gd'],
  importSemantics: 'wildcard-leaf' as ImportSemantics,
  heritageDefaultEdge: 'EXTENDS',
  mroStrategy: 'first-wins' as MroStrategy,
  builtInNames: BUILT_INS,
  treeSitterQueries: GDScriptTreeSitterQueries,

  /**
   * The "Matcher": Converts Tree-Sitter matches into CaptureMatch objects.
   * FIXED: Now includes the underlying SyntaxNode so interpretImport can traverse it.
   */
  emitScopeCaptures: (sourceText, filePath, cachedTree) => {
    const parser = new Parser();
    parser.setLanguage(gdscript);

    const rootNode = cachedTree
      ? (cachedTree as Parser.SyntaxNode)
      : parser.parse(sourceText).rootNode;

    const query = new Parser.Query(gdscript, GDScriptTreeSitterQueries);
    const matches = query.matches(rootNode);

    return matches.map((match) => {
      // 1. Create an array of [key, value] pairs (entries)
      const entries: [string, Capture][] = match.captures.map((capture) => {
        const name = capture.name;
        const node = capture.node;
        const range = {
          startLine: node.startPosition.row + 1,
          startCol: node.startPosition.column,
          endLine: node.endPosition.row + 1,
          endCol: node.endPosition.column
        };

        // 2. Handle the sidecar cache
        const key = getCacheKey(filePath, range.startLine, range.startCol);
        nodeCache.set(key, node);

        // 3. Return the pair for this specific capture
        return [
          name,
          {
            name: name,
            text: node.text,
            range: range
          }
        ];
      });

      // 4. Transform the entries array into the required CaptureMatch object
      // Object.fromEntries is inherently "writing" to a new object,
      // so it bypasss the Readonly restriction on the final type.
      return Object.fromEntries(entries) as CaptureMatch;
    });
  },

    /**
   * The "Semanticist": Interprets imports (preload/extends).
   */
  interpretImport: (captures) => {
    if (!captures) return null;

    // Handle extends (class inheritance)
    if (captures['@extends']) {
      return {
        kind: 'extends',
        targetRaw: captures['@extends'].text.replace(/['"]/g, ''),
      } as any;
    }

    // Handle preload/load imports (res:// URIs)
    if (captures['@import.statement'] && captures['@import.source']) {
      return {
        kind: 'import',
        targetRaw: captures['@import.source'].text.replace(/['"]/g, ''),
      } as any;
    }

    // Handle class_definition as a "Symbol Export"
    if (captures['@definition.class']) {
      return {
        kind: 'symbol_export',
        symbolName: captures['@definition.class'].text.replace(/['"]/g, ''),
        targetRaw: captures['@definition.class'].text.replace(/['"]/g, ''),
      } as any;
    }

    return null;
  },

  /**
   * The "Structuralist": Defines how types are extracted.
   */
  typeConfig: {
    declarationNodeTypes: new Set([
      'variable_statement',
      'function_definition',
      'signal_definition',
      'enum_definition',
      'const_definition',
      'class_definition'
    ]),
    extractDeclaration: (node, env) => {
      const idNode = node.children.find(c => c.type === 'identifier' || c.type === 'name');
      const typeNode = node.children.find(c => c.type === 'type' || c.type === 'type_identifier');
    
      if (idNode) {
        // For signals/enums/consts, we often just want the name
        // For variables, we want name + type
        const name = idNode.text;
        const type = typeNode?.text || 'unknown';
    
        env.set(name, type);
    
        // NEW: If this is a class definition, we explicitly map the class name
        // to the current file in the environment.
//        if (node.type === 'class_definition') {
//          // This allows the engine to resolve 'MyClass' -> 'path/to/file.gd'
//          env.setSymbolToPath(name, 'current_file_context');
//        }
      }
    },
    extractParameter: (node, env) => {
      const idNode = node.children.find(c => c.type === 'identifier');
      const typeNode = node.children.find(c => c.type === 'type');
      if (idNode) env.set(idNode.text, typeNode?.text || 'unknown');
    }
  } as LanguageTypeConfig,

  exportChecker: () => true,

  importResolver: (rawPath, _filePath, resolveCtx) => {
    const cleanedPath = rawPath.replace(/['"]/g, '');
    if (cleanedPath.startsWith('res://')) {
      const relativePath = cleanedPath.replace('res://', '');
      const resolved = resolveCtx.resolveCache.get(relativePath);
      if (resolved) return { kind: 'files', files: [resolved] };
      
      const found = Array.from(resolveCtx.allFilePaths).find(p => p.endsWith(relativePath));
      if (found) {
        resolveCtx.resolveCache.set(relativePath, found);
        return { kind: 'files', files: [found] };
      }
    }
    return null;
  }
});
