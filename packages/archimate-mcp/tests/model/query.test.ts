import { describe, it, expect } from 'vitest';
import { createModel, addElement, addRelation } from '../../src/model/model.js';
import { getModelSummary, filterElements, filterRelations, findPath } from '../../src/model/query.js';

function buildTestModel() {
  const m = createModel('m-1', 'Test Model');
  const actor = addElement(m, 'business', 'BusinessActor', 'Customer');
  const crm = addElement(m, 'application', 'ApplicationComponent', 'CRM');
  const db = addElement(m, 'technology', 'Node', 'Database');
  const rel1 = addRelation(m, 'Assignment', actor.id, crm.id);
  const rel2 = addRelation(m, 'Serving', crm.id, db.id);
  return { m, actor, crm, db, rel1, rel2 };
}

describe('getModelSummary', () => {
  it('returns counts per layer and relation type', () => {
    const { m } = buildTestModel();
    const summary = getModelSummary(m);
    expect(summary.totalElements).toBe(3);
    expect(summary.totalRelations).toBe(2);
    expect(summary.totalViews).toBe(0);
    expect(summary.elementsByLayer['business']).toBe(1);
    expect(summary.elementsByLayer['application']).toBe(1);
    expect(summary.elementsByLayer['technology']).toBe(1);
    expect(summary.relationsByType['Assignment']).toBe(1);
    expect(summary.relationsByType['Serving']).toBe(1);
  });
});

describe('filterElements', () => {
  it('filters by layer', () => {
    const { m } = buildTestModel();
    const result = filterElements(m, { layer: 'application' });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('CRM');
  });

  it('filters by type', () => {
    const { m } = buildTestModel();
    const result = filterElements(m, { type: 'BusinessActor' });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Customer');
  });

  it('filters by name pattern (case-insensitive substring)', () => {
    const { m } = buildTestModel();
    const result = filterElements(m, { name: 'cust' });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Customer');
  });

  it('returns all when no filters', () => {
    const { m } = buildTestModel();
    expect(filterElements(m, {})).toHaveLength(3);
  });
});

describe('filterRelations', () => {
  it('filters by sourceId', () => {
    const { m, actor } = buildTestModel();
    const result = filterRelations(m, { sourceId: actor.id });
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('Assignment');
  });

  it('filters by targetId', () => {
    const { m, db } = buildTestModel();
    const result = filterRelations(m, { targetId: db.id });
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('Serving');
  });

  it('filters by type', () => {
    const { m } = buildTestModel();
    const result = filterRelations(m, { type: 'Serving' });
    expect(result).toHaveLength(1);
  });
});

describe('findPath', () => {
  it('finds direct path', () => {
    const { m, actor, crm } = buildTestModel();
    const path = findPath(m, actor.id, crm.id);
    expect(path).not.toBeNull();
    expect(path!.elements.map(e => e.name)).toEqual(['Customer', 'CRM']);
    expect(path!.relations).toHaveLength(1);
  });

  it('finds indirect path', () => {
    const { m, actor, db } = buildTestModel();
    const path = findPath(m, actor.id, db.id);
    expect(path).not.toBeNull();
    expect(path!.elements).toHaveLength(3);
  });

  it('returns null when no path exists', () => {
    const { m } = buildTestModel();
    const isolated = addElement(m, 'motivation', 'Goal', 'Isolated Goal');
    expect(findPath(m, m.elements.keys().next().value!, isolated.id)).toBeNull();
  });

  it('returns single element for same id', () => {
    const { m, actor } = buildTestModel();
    const path = findPath(m, actor.id, actor.id);
    expect(path!.elements).toHaveLength(1);
    expect(path!.relations).toHaveLength(0);
  });
});
