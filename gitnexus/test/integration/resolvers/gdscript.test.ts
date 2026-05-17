/**
 * GDScript: built-in type calls (Button.new, connect, etc.)
 */
import { describe, expect, beforeAll } from 'vitest';
import path from 'path';
import {
  FIXTURES,
  runPipelineFromRepo,
  getRelationships,
  getNodesByLabel,
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