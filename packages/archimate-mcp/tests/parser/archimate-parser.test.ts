import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArchimate } from '../../src/parser/archimate-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, '../../fixtures/sample.archimate'), 'utf-8');

describe('parseArchimate', () => {
  it('parses model id and name', () => {
    const model = parseArchimate('model-1', fixture);
    expect(model.id).toBe('model-1');
    expect(model.name).toBe('Test Model');
  });

  it('parses elements with correct types and layers', () => {
    const model = parseArchimate('model-1', fixture);
    expect(model.elements.size).toBe(2);
    const actor = model.elements.get('elem-1');
    expect(actor?.name).toBe('Customer');
    expect(actor?.type).toBe('BusinessActor');
    expect(actor?.layer).toBe('business');
    const crm = model.elements.get('elem-2');
    expect(crm?.name).toBe('CRM System');
    expect(crm?.documentation).toBe('Customer relationship management');
  });

  it('parses properties', () => {
    const model = parseArchimate('model-1', fixture);
    const crm = model.elements.get('elem-2');
    expect(crm?.properties[0]?.key).toBe('owner');
    expect(crm?.properties[0]?.value).toBe('IT');
  });

  it('parses relations', () => {
    const model = parseArchimate('model-1', fixture);
    const rel = model.relations.get('rel-1');
    expect(rel?.type).toBe('Assignment');
    expect(rel?.sourceId).toBe('elem-1');
    expect(rel?.targetId).toBe('elem-2');
  });

  it('parses views', () => {
    const model = parseArchimate('model-1', fixture);
    const view = model.views.get('view-1');
    expect(view?.name).toBe('Application View');
    expect(view?.elements).toHaveLength(2);
  });
});
