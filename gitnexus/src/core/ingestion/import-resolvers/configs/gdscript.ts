/**
 * GDScript import resolution config.
 * Handles res:// URI scheme for preload() and load() calls.
 */

import { SupportedLanguages } from 'gitnexus-shared';
import type { ImportResolutionConfig } from '../types.js';
import { gdscriptResResolver } from '../gdscript.js';

export const gdscriptImportConfig: ImportResolutionConfig = {
  language: SupportedLanguages.GDScript,
  strategies: [gdscriptResResolver],
};