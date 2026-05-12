import { describe, it, expect } from 'vitest';
import type { ArchiMateElement, ArchiMateModel, ArchiMateRelation, ArchiMateView } from '../../src/model/types.js';
import { addElementTool } from '../../src/tools/write/add-element.js';
import { updateElementTool } from '../../src/tools/write/update-element.js';
import { removeElementTool } from '../../src/tools/write/remove-element.js';
import { addRelationTool } from '../../src/tools/write/add-relation.js';
import { removeRelationTool } from '../../src/tools/write/remove-relation.js';
import { addToViewTool } from '../../src/tools/write/add-to-view.js';
import { createViewTool } from '../../src/tools/write/create-view.js';

function makeModel(): ArchiMateModel {
  return {
    id: 'model-test',
    name: 'Test Model',
    elements: new Map(),
    relations: new Map(),
    views: new Map(),
  };
}

function seedElement(model: ArchiMateModel, id: string, type: ArchiMateElement['type'] = 'BusinessProcess'): ArchiMateModel {
  const el: ArchiMateElement = { id, name: `Element ${id}`, type, layer: 'business', properties: [] };
  const elements = new Map(model.elements);
  elements.set(id, el);
  return { ...model, elements };
}

function seedRelation(model: ArchiMateModel, id: string, sourceId: string, targetId: string): ArchiMateModel {
  const rel: ArchiMateRelation = { id, type: 'Serving', sourceId, targetId, properties: [] };
  const relations = new Map(model.relations);
  relations.set(id, rel);
  return { ...model, relations };
}

function seedView(model: ArchiMateModel, id: string): ArchiMateModel {
  const view: ArchiMateView = { id, name: `View ${id}`, elements: [], relations: [] };
  const views = new Map(model.views);
  views.set(id, view);
  return { ...model, views };
}

describe('addElementTool', () => {
  it('adds a new element to the model', () => {
    const model = makeModel();
    const { model: updated, element } = addElementTool(model, {
      type: 'BusinessProcess',
      name: 'New Process',
    });
    expect(updated.elements.size).toBe(1);
    expect(updated.elements.has(element.id)).toBe(true);
  });

  it('new element has correct type, name and inferred layer', () => {
    const model = makeModel();
    const { element } = addElementTool(model, {
      type: 'ApplicationComponent',
      name: 'My App',
    });
    expect(element.type).toBe('ApplicationComponent');
    expect(element.name).toBe('My App');
    expect(element.layer).toBe('application');
  });

  it('preserves existing elements', () => {
    const model = seedElement(makeModel(), 'existing');
    const { model: updated } = addElementTool(model, { type: 'BusinessProcess', name: 'New' });
    expect(updated.elements.size).toBe(2);
    expect(updated.elements.has('existing')).toBe(true);
  });

  it('assigns unique id to each added element', () => {
    const model = makeModel();
    const { element: el1 } = addElementTool(model, { type: 'BusinessProcess', name: 'A' });
    const { element: el2 } = addElementTool(model, { type: 'BusinessProcess', name: 'B' });
    expect(el1.id).not.toBe(el2.id);
  });
});

describe('updateElementTool', () => {
  it('updates the name of an existing element', () => {
    const model = seedElement(makeModel(), 'el-1');
    const { model: updated, updated: el } = updateElementTool(model, 'el-1', { name: 'New Name' });
    expect(updated.elements.get('el-1')!.name).toBe('New Name');
    expect(el!.name).toBe('New Name');
  });

  it('re-infers layer when type is changed', () => {
    const model = seedElement(makeModel(), 'el-1', 'BusinessProcess');
    const { model: updated } = updateElementTool(model, 'el-1', { type: 'ApplicationComponent' });
    expect(updated.elements.get('el-1')!.layer).toBe('application');
  });

  it('returns undefined for updated when elementId not found', () => {
    const model = makeModel();
    const { updated } = updateElementTool(model, 'nonexistent', { name: 'X' });
    expect(updated).toBeUndefined();
  });
});

describe('removeElementTool', () => {
  it('removes element from model', () => {
    const model = seedElement(makeModel(), 'el-1');
    const updated = removeElementTool(model, 'el-1');
    expect(updated.elements.has('el-1')).toBe(false);
    expect(updated.elements.size).toBe(0);
  });

  it('cascade=true removes connected relations', () => {
    let model = seedElement(makeModel(), 'el-1');
    model = seedElement(model, 'el-2');
    model = seedRelation(model, 'r1', 'el-1', 'el-2');
    const updated = removeElementTool(model, 'el-1', true);
    expect(updated.relations.has('r1')).toBe(false);
  });

  it('cascade=false keeps connected relations', () => {
    let model = seedElement(makeModel(), 'el-1');
    model = seedElement(model, 'el-2');
    model = seedRelation(model, 'r1', 'el-1', 'el-2');
    const updated = removeElementTool(model, 'el-1', false);
    expect(updated.relations.has('r1')).toBe(true);
  });

  it('removes element from view element lists', () => {
    let model = seedElement(makeModel(), 'el-1');
    model = seedView(model, 'v1');
    model = addToViewTool(model, 'v1', 'el-1');
    const updated = removeElementTool(model, 'el-1', false);
    expect(updated.views.get('v1')!.elements).toHaveLength(0);
  });
});

describe('addRelationTool', () => {
  it('adds a relation between two elements', () => {
    let model = seedElement(makeModel(), 'el-1');
    model = seedElement(model, 'el-2');
    const { model: updated, relation } = addRelationTool(model, {
      type: 'Serving',
      source_id: 'el-1',
      target_id: 'el-2',
    });
    expect(updated.relations.size).toBe(1);
    expect(updated.relations.has(relation.id)).toBe(true);
    expect(relation.sourceId).toBe('el-1');
    expect(relation.targetId).toBe('el-2');
    expect(relation.type).toBe('Serving');
  });

  it('preserves existing relations', () => {
    let model = seedElement(makeModel(), 'a');
    model = seedElement(model, 'b');
    model = seedRelation(model, 'r-existing', 'a', 'b');
    const { model: updated } = addRelationTool(model, { type: 'Access', source_id: 'a', target_id: 'b' });
    expect(updated.relations.size).toBe(2);
  });
});

describe('removeRelationTool', () => {
  it('removes a relation by id', () => {
    let model = seedElement(makeModel(), 'a');
    model = seedElement(model, 'b');
    model = seedRelation(model, 'r1', 'a', 'b');
    const updated = removeRelationTool(model, 'r1');
    expect(updated.relations.has('r1')).toBe(false);
  });

  it('removes relation id from view relation lists', () => {
    let model = seedElement(makeModel(), 'a');
    model = seedElement(model, 'b');
    model = seedRelation(model, 'r1', 'a', 'b');
    model = seedView(model, 'v1');
    const views = new Map(model.views);
    const view = views.get('v1')!;
    views.set('v1', { ...view, relations: ['r1'] });
    model = { ...model, views };
    const updated = removeRelationTool(model, 'r1');
    expect(updated.views.get('v1')!.relations).toHaveLength(0);
  });
});

describe('addToViewTool', () => {
  it('adds an element to a view', () => {
    let model = seedElement(makeModel(), 'el-1');
    model = seedView(model, 'v1');
    const updated = addToViewTool(model, 'v1', 'el-1');
    expect(updated.views.get('v1')!.elements).toHaveLength(1);
    expect(updated.views.get('v1')!.elements[0].elementId).toBe('el-1');
  });

  it('does not duplicate elements in a view', () => {
    let model = seedElement(makeModel(), 'el-1');
    model = seedView(model, 'v1');
    const step1 = addToViewTool(model, 'v1', 'el-1');
    const step2 = addToViewTool(step1, 'v1', 'el-1');
    expect(step2.views.get('v1')!.elements).toHaveLength(1);
  });

  it('returns model unchanged if viewId does not exist', () => {
    const model = seedElement(makeModel(), 'el-1');
    const updated = addToViewTool(model, 'nonexistent-view', 'el-1');
    expect(updated.views.size).toBe(0);
  });
});

describe('createViewTool', () => {
  it('creates a new view with given name', () => {
    const model = makeModel();
    const { model: updated, view } = createViewTool(model, 'Architecture Overview');
    expect(updated.views.size).toBe(1);
    expect(view.name).toBe('Architecture Overview');
    expect(view.elements).toHaveLength(0);
    expect(view.relations).toHaveLength(0);
  });

  it('sets viewpoint when provided', () => {
    const model = makeModel();
    const { view } = createViewTool(model, 'App View', 'Application Cooperation');
    expect(view.viewpoint).toBe('Application Cooperation');
  });

  it('assigns unique id to each view', () => {
    const model = makeModel();
    const { view: v1 } = createViewTool(model, 'View 1');
    const { view: v2 } = createViewTool(model, 'View 2');
    expect(v1.id).not.toBe(v2.id);
  });
});
