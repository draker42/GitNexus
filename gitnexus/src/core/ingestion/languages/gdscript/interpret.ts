import type { CaptureMatch, ParsedTypeBinding, TypeRef } from 'gitnexus-shared';
import type { Scope } from 'gitnexus-shared';

/**
 * Interpret type-binding captures for GDScript.
 * Converts @type-binding.* captures into ParsedTypeBinding objects.
 */
export function interpretGdscriptTypeBinding(captures: CaptureMatch): ParsedTypeBinding | null {
  const name = captures['@type-binding.name']?.text;
  const type = captures['@type-binding.type']?.text;
  if (name === undefined || type === undefined) return null;

  let source: ParsedTypeBinding['source'] = 'annotation';

  if (captures['@type-binding.constructor'] !== undefined) {
    source = 'constructor-inferred';
  } else if (captures['@type-binding.call-return'] !== undefined) {
    source = 'constructor-inferred';
  } else if (captures['@type-binding.range'] !== undefined) {
    source = 'constructor-inferred';
  } else if (captures['@type-binding.self'] !== undefined) {
    source = 'self';
  }

  return {
    boundName: name,
    rawTypeName: type,
    source,
  };
}

/**
 * GDScript receiverBinding hook.
 * GDScript uses `self` inside methods to refer to the current instance.
 * Returns the type binding for `self` if in a function scope, null otherwise.
 */
export function gdscriptReceiverBinding(functionScope: Scope): TypeRef | null {
  if (functionScope.kind !== 'Function') return null;
  return functionScope.typeBindings.get('self') ?? null;
}