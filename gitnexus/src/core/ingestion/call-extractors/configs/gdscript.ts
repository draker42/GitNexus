// gitnexus/src/core/ingestion/call-extractors/configs/gdscript.ts

import { SupportedLanguages } from 'gitnexus-shared';
import type { CallExtractionConfig, ExtractedCallSite } from '../../call-types.js';
import type { SyntaxNode } from '../../utils/ast-helpers.js';
import {
  extractMixedChain,
} from '../../utils/call-analysis.js';

/**
 * GDScript-specific call site extraction.
 * 
 * Handles compound chains like `btn.pressed.connect()` where:
 * - The outer `attribute` node spans `btn.pressed.connect`
 * - `attribute_call` is the method call portion (`connect(_on_pressed)`)
 * - We need to extract the mixed chain `[{kind:'field', name:'pressed'}]` from the attribute node
 */
function extractGdscriptCallSite(callNode: SyntaxNode): ExtractedCallSite | null {
  // GDScript: attribute node with attribute_call child is a member call
  if (callNode.type !== 'attribute') return null;

  // Look for attribute_call child
  let attributeCall: SyntaxNode | null = null;
  for (const child of callNode.children) {
    if (child.type === 'attribute_call' && child.isNamed) {
      attributeCall = child;
      break;
    }
  }
  if (!attributeCall) return null;

  // Extract the method name from attribute_call
  const methodNameNode = attributeCall.namedChildren.find((c) => c.type === 'identifier');
  if (!methodNameNode) return null;

  const calledName = methodNameNode.text;

  // Extract receiver - the attribute node itself holds the mixed chain
  // For GDScript, the receiver of attribute_call inside attribute is the attribute node itself
  // We need to walk back from attribute_call to get the full chain receiver
  // The receiver is the first identifier inside the attribute, before any attribute_call
  const mixedChainResult = extractMixedChain(callNode);
  const receiverName = mixedChainResult?.baseReceiverName;

  return {
    calledName,
    callForm: 'member',
    ...(receiverName !== undefined ? { receiverName } : {}),
    argCount: attributeCall.namedChildren.length,
    ...(mixedChainResult?.chain !== undefined && mixedChainResult.chain.length > 0
      ? { receiverMixedChain: mixedChainResult.chain }
      : {}),
  };
}

// Re-export BUILT_INS for use in receiver resolution
// export { GDSCRIPT_BUILT_INS };

export const gdscriptCallConfig: CallExtractionConfig = {
  language: SupportedLanguages.GDScript,
  extractLanguageCallSite: extractGdscriptCallSite,
};
