import { describe, it, expect } from 'vitest';
import { filterElements, filterRelations, findPath, buildSummary } from '../src/model/query.js';
import type { ArchiMateElement, ArchiMateModel, ArchiMateRelation } from '../src/model/types.js';

function makeModel(): ArchiMateModel {
  return {
    id: 'model-test',
    name: 'Test Model',
    elements: new Map(),
    relations: new Map(),
    views: new Map(),
  };
}

function el(id: string, type: ArchiMateElement['type'], layer: ArchiMateElement['layer'], name = id): ArchiMateElement {
  return { id, name, type, layer, properties: [] };
}

function rel(id: string, type: ArchiMateRelation['type'], sourceId: string, targetId: string): ArchiMateRelation {
  return { id, type, sourceId, targetId, properties: [] };
}

function withElements(model: ArchiMateModel, ...els: ArchiMateElement[]): ArchiMateModel {
  const elements = new Map(model.elements);
  for (const e of els) elements.set(e.id, e);
  return { ...model, elements };
}

function withRelations(model: ArchiMateModel, ...rels: ArchiMateRelation[]): ArchiMateModel {
  const relations = new Map(model.relations);
  for (const r of rels) relations.set(r.id, r);
  return { ...model, relations };
}

describe('filterElements', () => {
  const baseModel = withElements(
    makeModel(),
    el('e1', 'BusinessProcess', 'business', 'Order Process'),
    el('e2', 'ApplicationComponent', 'application', 'Order System'),
    el('e3', 'BusinessRole', 'business', 'Customer'),
    el('e4', 'DataObject', 'application', 'Order Data'),
  );

  it('returns all elements when no filter given', () => {
    const result = filterElements(baseModel, {});
    expect(result).toHaveLength(4);
  });

  it('filters by layer', () => {
    const result = filterElements(baseModel, { layer: 'business' });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.layer === 'business')).toBe(true);
  });

  it('filters by type', () => {
    const result = filterElements(baseModel, { type: 'DataObject' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e4');
  });

  it('filters by name (case-insensitive substring)', () => {
    const result = filterElements(baseModel, { name: 'order' });
    expect(result).toHaveLength(3);
  });

  it('returns empty array when no match', () => {
    const result = filterElements(baseModel, { layer: 'strategy' });
    expect(result).toHaveLength(0);
  });
});

describe('filterRelations', () => {
  const e1 = el('e1', 'BusinessProcess', 'business');
  const e2 = el('e2', 'ApplicationComponent', 'application');
  const e3 = el('e3', 'DataObject', 'application');

  const baseModel = withRelations(
    withElements(makeModel(), e1, e2, e3),
    rel('r1', 'Serving', 'e2', 'e1'),
    rel('r2', 'Access', 'e1', 'e3'),
    rel('r3', 'Association', 'e1', 'e2'),
  );

  it('filters by type', () => {
    const result = filterRelations(baseModel, { type: 'Serving' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('filters by sourceId', () => {
    const result = filterRelations(baseModel, { sourceId: 'e1' });
    expect(result).toHaveLength(2);
  });

  it('filters by targetId', () => {
    const result = filterRelations(baseModel, { targetId: 'e1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });
});

describe('findPath', () => {
  const a = el('a', 'BusinessProcess', 'business');
  const b = el('b', 'ApplicationComponent', 'application');
  const c = el('c', 'DataObject', 'application');
  const d = el('d', 'BusinessRole', 'business');

  const model = withRelations(
    withElements(makeModel(), a, b, c, d),
    rel('r1', 'Serving', 'b', 'a'),
    rel('r2', 'Access', 'a', 'c'),
  );

  it('finds direct path between connected elements', () => {
    const result = findPath(model, 'a', 'c');
    expect(result).not.toBeNull();
    expect(result!.elements.map(e => e.id)).toEqual(['a', 'c']);
    expect(result!.relations.map(r => r.id)).toEqual(['r2']);
  });

  it('finds path through intermediate element (BFS)', () => {
    const result = findPath(model, 'b', 'c');
    expect(result).not.toBeNull();
    expect(result!.elements.map(e => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('returns null when no path exists', () => {
    const result = findPath(model, 'a', 'd');
    expect(result).toBeNull();
  });

  it('returns trivial path when fromId === toId', () => {
    const result = findPath(model, 'a', 'a');
    expect(result).not.toBeNull();
    expect(result!.elements.map(e => e.id)).toEqual(['a']);
    expect(result!.relations).toHaveLength(0);
  });
});

describe('buildSummary', () => {
  it('summarizes element counts by layer', () => {
    const model = withElements(
      makeModel(),
      el('e1', 'BusinessProcess', 'business'),
      el('e2', 'BusinessRole', 'business'),
      el('e3', 'ApplicationComponent', 'application'),
    );
    const summary = buildSummary(model);
    expect(summary.totalElements).toBe(3);
    expect(summary.elementsByLayer['business']).toBe(2);
    expect(summary.elementsByLayer['application']).toBe(1);
    expect(summary.name).toBe('Test Model');
  });

  it('summarizes relation counts by type', () => {
    const e1 = el('e1', 'BusinessProcess', 'business');
    const e2 = el('e2', 'ApplicationComponent', 'application');
    const model = withRelations(
      withElements(makeModel(), e1, e2),
      rel('r1', 'Serving', 'e2', 'e1'),
      rel('r2', 'Serving', 'e2', 'e1'),
    );
    const summary = buildSummary(model);
    expect(summary.totalRelations).toBe(2);
    expect(summary.relationsByType['Serving']).toBe(2);
  });
});
