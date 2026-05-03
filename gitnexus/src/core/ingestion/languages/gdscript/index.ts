import Parser from 'tree-sitter';
import gdscript from 'tree-sitter-gdscript';
import { GDScriptQueries } from './captures.js';
import { loadParser, loadLanguage } from '../../../tree-sitter/parser-loader.js';
import { defineLanguage, type LanguageProvider } from '../../language-provider.js';
import { SupportedLanguages } from 'gitnexus-shared';
import type {
  MroStrategy,
  CaptureMatch,
  Capture,
} from 'gitnexus-shared';
import type { ImportResult, ImportResolverFn, ResolveCtx } from '../../import-resolvers/types.js';
import type { LanguageTypeConfig } from '../../type-extractors/types.js';
import type { ExportChecker } from '../../export-detection.js';
import type { ImportSemantics } from '../../language-provider.js';

// 1. Constants & Built-ins
const BUILT_INS: ReadonlySet<string> = new Set([
  'int', 'float', 'String', 'Node', 'Resource', 'Array', 'Dictionary', 
  'Vector2', 'Vector3', 'bool', 'StringName', 'Color', 'Rect2', 
  'Transform2D', 'Transform3D', 'Plane', 'AABB', 'Quaternion'
]);

const GDScriptTreeSitterQueries = Object.values(GDScriptQueries).join('\n');

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
   */
  emitScopeCaptures: (sourceText, filePath, cachedTree) => {
    // Note: In a production environment, the parser should be pre-loaded.
    // For this implementation, we assume the engine provides a valid parser.
    // We use a synchronous approach to satisfy the interface.
    const parser = new Parser();
    parser.setLanguage(gdscript);

    const rootNode = cachedTree 
      ? (cachedTree as Parser.SyntaxNode) 
      : parser.parse(sourceText).rootNode;

    const query = new Parser.Query(gdscript, GDScriptTreeSitterQueries);
    const matches = query.matches(rootNode);

    return matches.map((match): CaptureMatch => {
      const matchRecord: Record<string, Capture> = {};
      for (const capture of match.captures) {
        const name = capture.name;
        const node = capture.node;
        matchRecord[name] = {
          name: name,
          text: node.text,
          range: {
            startLine: node.startPosition.row + 1,
            startCol: node.startPosition.column,
            endLine: node.endPosition.row + 1,
            endCol: node.endPosition.column
          }
        };
      }
      return matchRecord;
    });
  },

  /**
   * The "Semanticist": Interprets imports (preload/extends).
   */
  interpretImport: (capture) => {
    // 1. Handle existing preload/extends logic
    if (capture.name.text === 'preload' || capture.name.text === 'extends') {
      return {
        kind: 'import',
        targetRaw: capture.node.text,
      } as any;
    }
  
    // 2. NEW: Handle class_definition as a "Symbol Export"
    // If the node being processed is a class_definition, we treat it as a
    // declaration that populates the global scope.
    if (capture.node.type === 'class_definition') {
      const classNameNode = capture.node.children.find(c => c.type === 'identifier' || c.type === 'name');
      if (classNameNode) {
        return {
          kind: 'symbol_export',
          symbolName: classNameNode.text,
          targetRaw: classNameNode.text
        } as any;
      }
    }
  
    return null;
  },

  /**
   * The "Structuralist": Defines how types are extracted.
   */
  typeConfig: {
    declarationNodeTypes: new Set(['variable_statement', 'function_definition']),
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
        if (node.type === 'class_definition') {
          // This allows the engine to resolve 'MyClass' -> 'path/to/file.gd'
          env.setSymbolToPath(name, 'current_file_context');
        }
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
