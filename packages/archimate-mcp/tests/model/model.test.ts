import { describe, it, expect } from 'vitest';
import {
  createModel,
  addElement,
  updateElement,
  removeElement,
  addRelation,
  removeRelation,
  addToView,
  createView,
} from '../../src/model/model.js';

describe('createModel', () => {
  it('creates an empty model', () => {
    const m = createModel('m-1', 'Test');
    expect(m.id).toBe('m-1');
    expect(m.name).toBe('Test');
    expect(m.elements.size).toBe(0);
    expect(m.relations.size).toBe(0);
    expect(m.views.size).toBe(0);
  });
});

describe('addElement', () => {
  it('adds element and returns it with generated id', () => {
    const m = createModel('m-1', 'Test');
    const el = addElement(m, 'application', 'ApplicationComponent', 'CRM');
    expect(el.name).toBe('CRM');
    expect(el.layer).toBe('application');
    expect(el.type).toBe('ApplicationComponent');
    expect(typeof el.id).toBe('string');
    expect(m.elements.has(el.id)).toBe(true);
  });

  it('stores properties and documentation', () => {
    const m = createModel('m-1', 'Test');
    const el = addElement(m, 'business', 'BusinessActor', 'User',
      [{ key: 'owner', value: 'IT' }], 'The main user');
    expect(el.properties).toEqual([{ key: 'owner', value: 'IT' }]);
    expect(el.documentation).toBe('The main user');
  });
});

describe('updateElement', () => {
  it('updates name and properties', () => {
    const m = createModel('m-1', 'Test');
    const el = addElement(m, 'application', 'ApplicationComponent', 'Old');
    const updated = updateElement(m, el.id, { name: 'New', properties: [{ key: 'x', value: 'y' }] });
    expect(updated.name).toBe('New');
    expect(updated.properties).toEqual([{ key: 'x', value: 'y' }]);
    expect(m.elements.get(el.id)?.name).toBe('New');
  });

  it('throws if element not found', () => {
    const m = createModel('m-1', 'Test');
    expect(() => updateElement(m, 'nonexistent', { name: 'X' })).toThrow('Element not found');
  });
});

describe('removeElement', () => {
  it('removes element', () => {
    const m = createModel('m-1', 'Test');
    const el = addElement(m, 'application', 'ApplicationComponent', 'CRM');
    removeElement(m, el.id);
    expect(m.elements.has(el.id)).toBe(false);
  });

  it('with cascade removes dangling relations', () => {
    const m = createModel('m-1', 'Test');
    const a = addElement(m, 'application', 'ApplicationComponent', 'A');
    const b = addElement(m, 'application', 'ApplicationComponent', 'B');
    const rel = addRelation(m, 'Association', a.id, b.id);
    removeElement(m, a.id, true);
    expect(m.relations.has(rel.id)).toBe(false);
  });

  it('without cascade keeps relations (dangling)', () => {
    const m = createModel('m-1', 'Test');
    const a = addElement(m, 'application', 'ApplicationComponent', 'A');
    const b = addElement(m, 'application', 'ApplicationComponent', 'B');
    const rel = addRelation(m, 'Association', a.id, b.id);
    removeElement(m, a.id, false);
    expect(m.relations.has(rel.id)).toBe(true);
  });

  it('throws if element not found', () => {
    const m = createModel('m-1', 'Test');
    expect(() => removeElement(m, 'nonexistent')).toThrow('Element not found');
  });
});

describe('addRelation', () => {
  it('adds relation between two elements', () => {
    const m = createModel('m-1', 'Test');
    const a = addElement(m, 'application', 'ApplicationComponent', 'A');
    const b = addElement(m, 'application', 'ApplicationComponent', 'B');
    const rel = addRelation(m, 'Association', a.id, b.id);
    expect(rel.type).toBe('Association');
    expect(rel.sourceId).toBe(a.id);
    expect(rel.targetId).toBe(b.id);
    expect(m.relations.has(rel.id)).toBe(true);
  });

  it('throws if source does not exist', () => {
    const m = createModel('m-1', 'Test');
    const b = addElement(m, 'application', 'ApplicationComponent', 'B');
    expect(() => addRelation(m, 'Association', 'bad-source', b.id)).toThrow('Source element not found');
  });

  it('throws if target does not exist', () => {
    const m = createModel('m-1', 'Test');
    const a = addElement(m, 'application', 'ApplicationComponent', 'A');
    expect(() => addRelation(m, 'Association', a.id, 'bad-target')).toThrow('Target element not found');
  });
});

describe('removeRelation', () => {
  it('removes relation', () => {
    const m = createModel('m-1', 'Test');
    const a = addElement(m, 'application', 'ApplicationComponent', 'A');
    const b = addElement(m, 'application', 'ApplicationComponent', 'B');
    const rel = addRelation(m, 'Association', a.id, b.id);
    removeRelation(m, rel.id);
    expect(m.relations.has(rel.id)).toBe(false);
  });

  it('throws if relation not found', () => {
    const m = createModel('m-1', 'Test');
    expect(() => removeRelation(m, 'nonexistent')).toThrow('Relation not found');
  });
});

describe('createView + addToView', () => {
  it('creates empty view', () => {
    const m = createModel('m-1', 'Test');
    const v = createView(m, 'App View', 'Application');
    expect(v.name).toBe('App View');
    expect(v.viewpoint).toBe('Application');
    expect(v.elements).toHaveLength(0);
    expect(m.views.has(v.id)).toBe(true);
  });

  it('adds element to view', () => {
    const m = createModel('m-1', 'Test');
    const v = createView(m, 'App View');
    const el = addElement(m, 'application', 'ApplicationComponent', 'CRM');
    addToView(m, v.id, el.id);
    expect(v.elements).toHaveLength(1);
    expect(v.elements[0]?.elementId).toBe(el.id);
  });

  it('does not duplicate element in view', () => {
    const m = createModel('m-1', 'Test');
    const v = createView(m, 'App View');
    const el = addElement(m, 'application', 'ApplicationComponent', 'CRM');
    addToView(m, v.id, el.id);
    addToView(m, v.id, el.id);
    expect(v.elements).toHaveLength(1);
  });

  it('throws if view not found', () => {
    const m = createModel('m-1', 'Test');
    const el = addElement(m, 'application', 'ApplicationComponent', 'CRM');
    expect(() => addToView(m, 'bad-view', el.id)).toThrow('View not found');
  });
});
