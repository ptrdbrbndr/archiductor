import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOef } from '../../src/parser/oef-parser.js';
import { serializeToOef } from '../../src/parser/serializer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, '../../fixtures/sample-oef.xml'), 'utf-8');

describe('serializeToOef', () => {
  it('produces valid XML string', () => {
    const model = parseOef('model-1', fixture);
    const xml = serializeToOef(model);
    expect(typeof xml).toBe('string');
    expect(xml).toContain('<?xml');
    expect(xml).toContain('archimate');
  });

  it('roundtrip preserves elements', () => {
    const model = parseOef('model-1', fixture);
    const xml = serializeToOef(model);
    const model2 = parseOef('model-1', xml);
    expect(model2.elements.size).toBe(model.elements.size);
    const actor = model2.elements.get('elem-1');
    expect(actor?.name).toBe('Customer');
    expect(actor?.type).toBe('BusinessActor');
  });

  it('roundtrip preserves relations', () => {
    const model = parseOef('model-1', fixture);
    const xml = serializeToOef(model);
    const model2 = parseOef('model-1', xml);
    expect(model2.relations.size).toBe(model.relations.size);
    const rel = model2.relations.get('rel-1');
    expect(rel?.type).toBe('Assignment');
    expect(rel?.sourceId).toBe('elem-1');
  });

  it('roundtrip preserves views', () => {
    const model = parseOef('model-1', fixture);
    const xml = serializeToOef(model);
    const model2 = parseOef('model-1', xml);
    expect(model2.views.size).toBe(model.views.size);
  });
});
