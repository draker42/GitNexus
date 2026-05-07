import Parser from 'tree-sitter';
import gdscript from 'tree-sitter-gdscript';
import { GDSCRIPT_QUERIES } from '../../tree-sitter-queries.js';
import { defineLanguage,
        type LanguageProvider,
        type ImportSemantics} from '../../language-provider.js';
import { SupportedLanguages } from 'gitnexus-shared';
import type {
  MroStrategy,
  Capture,
  CaptureMatch,
  MixedChainStep,
} from 'gitnexus-shared';
import type { LanguageTypeConfig } from '../../type-extractors/types.js';
import { gdscriptTypeConfig } from '../../type-extractors/gdscript.js';
import { createCallExtractor } from '../../call-extractors/generic.js';
import { gdscriptCallConfig } from '../../call-extractors/configs/gdscript.js';
import { createHeritageExtractor } from '../../heritage-extractors/generic.js';
import { synthesizeGdscriptTypeBindings } from './type-binding.js';
import { synthesizeGdscriptReceiverBinding } from './receiver-binding.js';
import { interpretGdscriptTypeBinding, gdscriptReceiverBinding } from './interpret.js';
import { extractMixedChain } from '../../utils/call-analysis.js';

// 1. Constants & Built-ins
const BUILT_INS: ReadonlySet<string> = new Set([
  'int', 'float', 'String', 'Node', 'Resource', 'Array', 'Dictionary', 
  'Vector2', 'Vector3', 'bool', 'StringName', 'Color', 'Rect2', 
  'Transform2D', 'Transform3D', 'Plane', 'AABB', 'Quaternion',
  // Godot built-in control nodes
  'Button', 'Label', 'LineEdit', 'TextEdit', 'Control', 'Node2D', 'Sprite2D',
  'TextureRect', 'Panel', 'PanelContainer', 'HBoxContainer', 'VBoxContainer',
  'GridContainer', 'CenterContainer', 'MarginContainer', 'ScrollContainer',
  'ItemList', 'Tree', 'GraphEdit', 'FileDialog', 'AcceptDialog',
  // Other common Godot built-ins
  'Object', 'Reference', 'Script', 'PackedScene', 'Resource',
  'Timer', 'AnimationPlayer', 'AnimationTree', 'AudioStreamPlayer',
]);

const GDScriptTreeSitterQueries = GDSCRIPT_QUERIES;

/** Lazy singleton parser for GDScript – reused across files. */
let gdscriptParser: Parser | null = null;
const getGDScriptParser = (): Parser => {
  if (gdscriptParser === null) {
    gdscriptParser = new Parser();
    gdscriptParser.setLanguage(gdscript);
  }
  return gdscriptParser;
};

/** Lazy singleton query for GDScript scope captures. */
let gdscriptScopeQuery: Parser.Query | null = null;
const getGDScriptScopeQuery = (): Parser.Query => {
  if (gdscriptScopeQuery === null) {
    gdscriptScopeQuery = new Parser.Query(gdscript, GDScriptTreeSitterQueries);
  }
  return gdscriptScopeQuery;
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
   * Entry point patterns for GDScript functions.
   * Matches: func_ready, func_process, etc.
   */
  entryPointPatterns: [/^func_/, /^var_/],

  /**
   * AST-based framework detection patterns for GDScript.
   * GDScript uses node paths and signals rather than decorators,
   * so no AST patterns are defined here.
   */
  astFrameworkPatterns: [],

  callExtractor: createCallExtractor(gdscriptCallConfig),
  heritageExtractor: createHeritageExtractor(SupportedLanguages.GDScript),

  /**
   * The "Matcher": Converts Tree-Sitter matches into CaptureMatch objects.
   * For GDScript, we also synthesize a file-level Class scope when `class_name`
   * is present, since GDScript's class_name_statement only spans one line but
   * the file body is semantically the class body.
   */
  emitScopeCaptures: (sourceText, filePath, cachedTree) => {
    const parser = getGDScriptParser();
    const query = getGDScriptScopeQuery();

    // Use the cached tree from the worker if provided, otherwise parse fresh
    let tree: Parser.Tree;
    if (cachedTree) {
      // Validate that cachedTree is a proper Tree object with a rootNode
      if (typeof cachedTree !== 'object' || cachedTree === null || !('rootNode' in cachedTree)) {
        throw new Error('[gdscript] cachedTree is not a valid Tree object');
      }
      tree = cachedTree as Parser.Tree;
    } else {
      tree = parser.parse(sourceText);
    }

    const rootNode = tree.rootNode;
    const matches = query.matches(rootNode);

    // Find class_name_statement and its range
    let classNameStatement: { startLine: number; endLine: number } | null = null;
    for (const node of rootNode.descendantsOfType('class_name_statement')) {
      classNameStatement = {
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
      };
      break; // Only handle the first one
    }

    // Group tree-sitter matches first
    const out: CaptureMatch[] = [];
    for (const match of matches) {
      const grouped: Record<string, Capture> = {};
      // Store nodes for later access (needed for chain extraction)
      const capturedNodes = new Map<string, Parser.SyntaxNode>();
      for (const c of match.captures) {
        const tag = '@' + c.name;
        grouped[tag] = {
          name: tag,
          range: {
            startLine: c.node.startPosition.row + 1,
            startCol: c.node.startPosition.column,
            endLine: c.node.endPosition.row + 1,
            endCol: c.node.endPosition.column,
          },
          text: c.node.text,
        };
        capturedNodes.set(tag, c.node);
      }
      if (Object.keys(grouped).length === 0) continue;
      
      out.push(grouped as CaptureMatch);
      
      // Synthesize @type-binding.self for methods (functions inside a class)
      if (grouped['@scope.function'] !== undefined) {
        const fnCapture = grouped['@scope.function'];
        // Find the function_definition node at this range
        for (const node of rootNode.descendantsOfType('function_definition')) {
          const start = node.startPosition;
          const end = node.endPosition;
          if (start.row + 1 === fnCapture.range.startLine && 
              start.column === fnCapture.range.startCol) {
            const synth = synthesizeGdscriptReceiverBinding(node);
            if (synth !== null) out.push(synth);
            break;
          }
        }
      }
      
      // Synthesize @reference.chain for member calls to capture the full receiver chain
      // e.g., for btn.pressed.connect() we want to capture that 'pressed' is a step on the chain
      if (grouped['@reference.call.member'] !== undefined) {
        const outerAttributeNode = capturedNodes.get('@reference.call.member');
        if (outerAttributeNode) {
          // Extract the mixed chain from the attribute node
          const chainResult = extractMixedChain(outerAttributeNode);
          if (chainResult && chainResult.chain.length > 0) {
            // The chain represents intermediate steps between the receiver and the final method
            // For btn.pressed.connect(), chain = [{kind:'field', name:'pressed'}]
            // We need to synthesize a capture with this information
            const chainCapture: Capture = {
              name: '@reference.chain',
              range: {
                startLine: grouped['@reference.call.member'].range.startLine,
                startCol: grouped['@reference.call.member'].range.startCol,
                endLine: grouped['@reference.call.member'].range.endLine,
                endCol: grouped['@reference.call.member'].range.endCol,
              },
              text: JSON.stringify(chainResult.chain),
            };
            const chainMatch: CaptureMatch = { '@reference.chain': chainCapture };
            // Also include the original reference captures so they stay together
            const combinedMatch = { ...grouped, ...chainMatch };
            // Replace the last push with our enhanced version
            out[out.length - 1] = combinedMatch;
          }
        }
      }
    }

    // For GDScript, synthesize a file-level Class scope when class_name is present.
    // The class_name_statement only captures one line, but in GDScript the file
    // body is the class body. We create a Class scope spanning from the extends/class_name
    // lines to the end of the file.
    //
    // IMPORTANT: We do NOT emit @scope.class for class_name_statement in the query
    // (it only emits @declaration.class). This avoids sibling overlap issues.
    if (classNameStatement !== null) {
      // Find the last line and column of the file (for scope range)
      const lines = sourceText.split('\n');
      const lastLine = lines.length;
      const lastCol = lines[lastLine - 1]?.length ?? 0;
      
      // Create a synthetic Class scope that starts at the extends/class_name line
      // and spans to the end of the file. This makes variable/function scopes
      // children of the Class scope rather than siblings under Module.
      // Start at line 1 (extends_statement) to capture all class body content.
      const classStartLine = 1; // Start from first line (extends or class_name)
      out.push({
        '@scope.class': {
          name: '@scope.class',
          range: {
            startLine: classStartLine,
            startCol: 0,
            endLine: lastLine,
            endCol: lastCol,
          },
          text: 'class_body',
        }
      });
    }

    // Layer on type-binding synthesis (Button.new() pattern)
    const synthesized = synthesizeGdscriptTypeBindings(rootNode);
    return [...out, ...synthesized];
  },

    /**
   * The "Semanticist": Interprets imports (preload/extends) and signal connections/super calls.
   */
  interpretImport: (captures) => {
    if (!captures) return null;

    // Handle extends (class inheritance) - from heritage capture
    if (captures['@heritage.extends']) {
      return {
        kind: 'extends',
        targetRaw: captures['@heritage.extends'].text.replace(/['"]/g, ''),
      } as any;
    }

    // Handle extends statement (legacy format)
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
    if (captures['@declaration.class']) {
      return {
        kind: 'symbol_export',
        symbolName: captures['@declaration.class'].text.replace(/['"]/g, ''),
        targetRaw: captures['@declaration.class'].text.replace(/['"]/g, ''),
      } as any;
    }

    // Handle signal connections: receiver.signal.connect(callable)
    // Creates a bidirectional link between signal and callable
    // signal.name is the signal property name (e.g., "pressed"), callable is the callback
    if (captures['@signal.connection'] && captures['@signal.name'] && captures['@signal.callable']) {
      return {
        kind: 'signal_connection',
        signalName: captures['@signal.name'].text,
        callableName: captures['@signal.callable'].text,
        ...(captures['@signal.receiver'] ? { receiverName: captures['@signal.receiver'].text } : {}),
      } as any;
    }

    // Handle super calls: super.method()
    // Creates inheritance-aware call edge
    if (captures['@super.call'] && captures['@super.method']) {
      return {
        kind: 'super_call',
        methodName: captures['@super.method'].text,
      } as any;
    }

    return null;
  },

  /**
   * The "Structuralist": Defines how types are extracted.
   */
  typeConfig: {
    ...gdscriptTypeConfig,
    // GDScript for loops start with 'for' keyword
    forLoopNodeTypes: new Set(['for_statement', 'for']),
  } as LanguageTypeConfig,

  interpretTypeBinding: interpretGdscriptTypeBinding,
  receiverBinding: gdscriptReceiverBinding,

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