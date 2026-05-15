/**
 * `MethodRegistry` — scope-aware lookup for method / function / constructor
 * dispatch (RFC §4.4; Ring 2 SHARED #917).
 *
 * Thin wrapper over `lookupCore`, specialized for callable kinds:
 *
 *   - `acceptedKinds` = Method / Function / Constructor.
 *   - `useReceiverTypeBinding` is **true** — the type-binding + MRO walk
 *     (Step 2) is the primary evidence path for receiver-dispatched calls.
 *   - `callsite.arity` flows through to `provider.arityCompatibility`
 *     when provided. When the provider is absent, arity evidence is
 *     `unknown` (neutral signal).
 */

import type { Callsite, MixedChainStep, Resolution, ScopeId } from '../types.js';
import { lookupCore, type CoreLookupParams } from './lookup-core.js';
import type { OwnerScopedContributor, RegistryContext } from './context.js';
import { METHOD_KINDS } from './context.js';

/**
 * Extra per-call parameters that vary across call sites but NOT across
 * registries. Kept as a separate shape so `MethodRegistry.lookup` stays
 * concise while still exposing the explicit-receiver + owner-contributor +
 * arity knobs the RFC algorithm needs.
 */
export interface MethodLookupOptions {
  /** Call-site arity for `provider.arityCompatibility`. */
  readonly callsite?: Callsite;
  /** Explicit receiver (e.g., `user` in `user.save()`). See §4.1. */
  readonly explicitReceiver?: { readonly name: string };
  /** Optional per-owner contributor (Step 3). */
  readonly ownerScopedContributor?: OwnerScopedContributor;
  /**
   * Mixed receiver chain for compound receivers (e.g., `svc.getUser().address.save()`).
   * Each step describes a property access or method call on the receiver chain.
   * Used to resolve the final receiver type before method lookup.
   */
  readonly receiverMixedChain?: readonly MixedChainStep[];
}

export interface MethodRegistry {
  lookup(name: string, scope: ScopeId, options?: MethodLookupOptions): readonly Resolution[];
}

export function buildMethodRegistry(ctx: RegistryContext): MethodRegistry {
  return {
    lookup(name: string, scope: ScopeId, options: MethodLookupOptions = {}) {
      const params: CoreLookupParams = {
        acceptedKinds: METHOD_KINDS,
        useReceiverTypeBinding: true,
        ownerScopedContributor: options.ownerScopedContributor ?? null,
        ...(options.callsite !== undefined ? { callsite: options.callsite } : {}),
        ...(options.explicitReceiver !== undefined
          ? { explicitReceiver: options.explicitReceiver }
          : {}),
        ...(options.receiverMixedChain !== undefined
          ? { receiverMixedChain: options.receiverMixedChain }
          : {}),
      };
      return lookupCore(name, scope, params, ctx);
    },
  };
}
