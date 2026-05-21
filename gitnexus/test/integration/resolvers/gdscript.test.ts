/**
 * GDScript: built-in type calls (Button.new, connect, etc.)
 */
import { describe, expect, beforeAll, it } from 'vitest';
import path from 'path';
import {
  FIXTURES,
  runPipelineFromRepo,
  getRelationships,
  getNodesByLabel,
  getNodesByType,
} from './helpers.js';

describe('GDScript built-in type call resolution', () => {
  let result: Awaited<ReturnType<typeof runPipelineFromRepo>>;

  beforeAll(async () => {
    result = await runPipelineFromRepo(
      path.join(FIXTURES, 'gdscript-class-calls'),
      () => {},
      { skipGraphPhases: true },
    );
  }, 60000);

  it('indexes the Game class', () => {
    expect(getNodesByLabel(result, 'Class')).toEqual(expect.arrayContaining(['Game']));
  });

  it('emits CALLS edges for method calls on built-in types', () => {
    const calls = getRelationships(result, 'CALLS');
    
    // At minimum we should have a call to connect
    const connectCalls = calls.filter((c) => c.target === 'connect');
    expect(connectCalls.length).toBeGreaterThan(0);
  });
});

describe('GDScript autoload resolution', () => {
  let result: Awaited<ReturnType<typeof runPipelineFromRepo>>;

  beforeAll(async () => {
    result = await runPipelineFromRepo(
      path.join(FIXTURES, 'gdscript-autoload'),
      () => {},
      { skipGraphPhases: true },
    );
  }, 60000);

  it('indexes autoload entries from project.godot', () => {
    // Autoloads are indexed as symbol exports
    const symbols = getNodesByLabel(result, 'Symbol');
    expect(symbols).toEqual(expect.arrayContaining(['PlayerData', 'GameState']));
  });

  it('indexes the PlayerData class', () => {
    expect(getNodesByLabel(result, 'Class')).toEqual(expect.arrayContaining(['PlayerData']));
  });
});
