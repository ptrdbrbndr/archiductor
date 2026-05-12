import { describe, it, expect } from 'vitest';
import type {
  ArchiMateElement,
  ArchiMateModel,
  ArchiMateRelation,
  ArchiMateView,
  ArchiMateViewElement,
} from '../../src/model/types.js';
import { getModelSummary } from '../../src/tools/read/get-model-summary.js';
import { listElements } from '../../src/tools/read/list-elements.js';
import { getElement } from '../../src/tools/read/get-element.js';
import { listRelations } from '../../src/tools/read/list-relations.js';
import { getRelation } from '../../src/tools/read/get-relation.js';
import { listViews } from '../../src/tools/read/list-views.js';
import { getView } from '../../src/tools/read/get-view.js';
import { findPathTool } from '../../src/tools/read/find-path.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeModel(): ArchiMateModel {
  return {
    id: 'model-read-test',
    name: 'Read Test Model',
    elements: new Map(),
    relations: new Map(),
    views: new Map(),
  };
}

function withElement(
  model: ArchiMateModel,
  id: string,
  type: ArchiMateElement['type'] = 'BusinessProcess',
  layer: ArchiMateElement['layer'] = 'business',
): ArchiMateModel {
  const el: ArchiMateElement = { id, name: `Element ${id}`, type, layer, properties: [] };
  const elements = new Map(model.elements);
  elements.set(id, el);
  return { ...model, elements };
}

function withRelation(
  model: ArchiMateModel,
  id: string,
  sourceId: string,
  targetId: string,
  type: ArchiMateRelation['type'] = 'Serving',
): ArchiMateModel {
  const rel: ArchiMateRelation = { id, type, sourceId, targetId, properties: [] };
  const relations = new Map(model.relations);
  relations.set(id, rel);
  return { ...model, relations };
}

function withView(
  model: ArchiMateModel,
  id: string,
  elementIds: string[] = [],
  relationIds: string[] = [],
  viewpoint?: string,
): ArchiMateModel {
  const elements: ArchiMateViewElement[] = elementIds.map((eid) => ({ elementId: eid }));
  const view: ArchiMateView = { id, name: `View ${id}`, elements, relations: relationIds, ...(viewpoint ? { viewpoint } : {}) };
  const views = new Map(model.views);
  views.set(id, view);
  return { ...model, views };
}

// ---------------------------------------------------------------------------
// get_model_summary
// ---------------------------------------------------------------------------

describe('getModelSummary', () => {
  it('returns zeros for an empty model', () => {
    const model = makeModel();
    const summary = getModelSummary(model);
    expect(summary.totalElements).toBe(0);
    expect(summary.totalRelations).toBe(0);
    expect(summary.totalViews).toBe(0);
    expect(summary.elementsByLayer).toEqual({});
    expect(summary.relationsByType).toEqual({});
  });

  it('counts elements by layer', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    model = withElement(model, 'e2', 'BusinessActor', 'business');
    model = withElement(model, 'e3', 'ApplicationComponent', 'application');
    const summary = getModelSummary(model);
    expect(summary.totalElements).toBe(3);
    expect(summary.elementsByLayer['business']).toBe(2);
    expect(summary.elementsByLayer['application']).toBe(1);
  });

  it('counts relations by type', () => {
    let model = makeModel();
    model = withElement(model, 'a', 'BusinessProcess', 'business');
    model = withElement(model, 'b', 'BusinessProcess', 'business');
    model = withElement(model, 'c', 'BusinessProcess', 'business');
    model = withRelation(model, 'r1', 'a', 'b', 'Serving');
    model = withRelation(model, 'r2', 'b', 'c', 'Serving');
    model = withRelation(model, 'r3', 'a', 'c', 'Association');
    const summary = getModelSummary(model);
    expect(summary.totalRelations).toBe(3);
    expect(summary.relationsByType['Serving']).toBe(2);
    expect(summary.relationsByType['Association']).toBe(1);
  });

  it('counts views', () => {
    let model = makeModel();
    model = withView(model, 'v1');
    model = withView(model, 'v2');
    const summary = getModelSummary(model);
    expect(summary.totalViews).toBe(2);
  });

  it('includes the model name', () => {
    const model = { ...makeModel(), name: 'Enterprise Architecture' };
    const summary = getModelSummary(model);
    expect(summary.name).toBe('Enterprise Architecture');
  });
});

// ---------------------------------------------------------------------------
// list_elements
// ---------------------------------------------------------------------------

describe('listElements', () => {
  it('returns all elements when no filters applied', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    model = withElement(model, 'e2', 'ApplicationComponent', 'application');
    const elements = listElements(model, {});
    expect(elements).toHaveLength(2);
  });

  it('returns empty array for an empty model', () => {
    const elements = listElements(makeModel(), {});
    expect(elements).toHaveLength(0);
  });

  it('filters by layer', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    model = withElement(model, 'e2', 'ApplicationComponent', 'application');
    model = withElement(model, 'e3', 'BusinessActor', 'business');
    const elements = listElements(model, { layer: 'business' });
    expect(elements).toHaveLength(2);
    expect(elements.every((e) => e.layer === 'business')).toBe(true);
  });

  it('filters by type', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    model = withElement(model, 'e2', 'ApplicationComponent', 'application');
    const elements = listElements(model, { type: 'BusinessProcess' });
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe('BusinessProcess');
  });

  it('filters by name substring (case-insensitive)', () => {
    let model = makeModel();
    // Override name to something findable
    const elements = new Map(model.elements);
    elements.set('e1', { id: 'e1', name: 'Order Processing', type: 'BusinessProcess', layer: 'business', properties: [] });
    elements.set('e2', { id: 'e2', name: 'Customer Service', type: 'BusinessService', layer: 'business', properties: [] });
    model = { ...model, elements };
    const result = listElements(model, { name: 'order' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('filters by layer and type simultaneously', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    model = withElement(model, 'e2', 'BusinessActor', 'business');
    model = withElement(model, 'e3', 'ApplicationComponent', 'application');
    const elements = listElements(model, { layer: 'business', type: 'BusinessProcess' });
    expect(elements).toHaveLength(1);
    expect(elements[0].id).toBe('e1');
  });
});

// ---------------------------------------------------------------------------
// get_element
// ---------------------------------------------------------------------------

describe('getElement', () => {
  it('returns element by id', () => {
    let model = makeModel();
    model = withElement(model, 'el-1', 'BusinessActor', 'business');
    const element = getElement(model, 'el-1');
    expect(element).not.toBeNull();
    expect(element!.id).toBe('el-1');
    expect(element!.type).toBe('BusinessActor');
  });

  it('returns null for unknown element id', () => {
    const model = makeModel();
    const element = getElement(model, 'nonexistent');
    expect(element).toBeNull();
  });

  it('returns null on empty model', () => {
    expect(getElement(makeModel(), 'any-id')).toBeNull();
  });

  it('returns the correct element from many elements', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    model = withElement(model, 'e2', 'ApplicationComponent', 'application');
    model = withElement(model, 'e3', 'Node', 'technology');
    const result = getElement(model, 'e2');
    expect(result!.layer).toBe('application');
    expect(result!.type).toBe('ApplicationComponent');
  });
});

// ---------------------------------------------------------------------------
// list_relations
// ---------------------------------------------------------------------------

describe('listRelations', () => {
  it('returns all relations when no filters', () => {
    let model = makeModel();
    model = withElement(model, 'a', 'BusinessProcess', 'business');
    model = withElement(model, 'b', 'BusinessProcess', 'business');
    model = withElement(model, 'c', 'BusinessProcess', 'business');
    model = withRelation(model, 'r1', 'a', 'b', 'Serving');
    model = withRelation(model, 'r2', 'b', 'c', 'Association');
    const relations = listRelations(model, {});
    expect(relations).toHaveLength(2);
  });

  it('returns empty array when no relations', () => {
    expect(listRelations(makeModel(), {})).toHaveLength(0);
  });

  it('filters by source_id', () => {
    let model = makeModel();
    model = withElement(model, 'a', 'BusinessProcess', 'business');
    model = withElement(model, 'b', 'BusinessProcess', 'business');
    model = withElement(model, 'c', 'BusinessProcess', 'business');
    model = withRelation(model, 'r1', 'a', 'b', 'Serving');
    model = withRelation(model, 'r2', 'b', 'c', 'Serving');
    const relations = listRelations(model, { source_id: 'a' });
    expect(relations).toHaveLength(1);
    expect(relations[0].id).toBe('r1');
  });

  it('filters by target_id', () => {
    let model = makeModel();
    model = withElement(model, 'a', 'BusinessProcess', 'business');
    model = withElement(model, 'b', 'BusinessProcess', 'business');
    model = withElement(model, 'c', 'BusinessProcess', 'business');
    model = withRelation(model, 'r1', 'a', 'b', 'Serving');
    model = withRelation(model, 'r2', 'a', 'c', 'Association');
    const relations = listRelations(model, { target_id: 'b' });
    expect(relations).toHaveLength(1);
    expect(relations[0].id).toBe('r1');
  });

  it('filters by type', () => {
    let model = makeModel();
    model = withElement(model, 'a', 'BusinessProcess', 'business');
    model = withElement(model, 'b', 'BusinessProcess', 'business');
    model = withElement(model, 'c', 'BusinessProcess', 'business');
    model = withRelation(model, 'r1', 'a', 'b', 'Serving');
    model = withRelation(model, 'r2', 'b', 'c', 'Association');
    const relations = listRelations(model, { type: 'Serving' });
    expect(relations).toHaveLength(1);
    expect(relations[0].type).toBe('Serving');
  });

  it('filters by source_id and type simultaneously', () => {
    let model = makeModel();
    model = withElement(model, 'a', 'BusinessProcess', 'business');
    model = withElement(model, 'b', 'BusinessProcess', 'business');
    model = withElement(model, 'c', 'BusinessProcess', 'business');
    model = withRelation(model, 'r1', 'a', 'b', 'Serving');
    model = withRelation(model, 'r2', 'a', 'c', 'Association');
    const relations = listRelations(model, { source_id: 'a', type: 'Serving' });
    expect(relations).toHaveLength(1);
    expect(relations[0].id).toBe('r1');
  });
});

// ---------------------------------------------------------------------------
// get_relation
// ---------------------------------------------------------------------------

describe('getRelation', () => {
  it('returns relation by id', () => {
    let model = makeModel();
    model = withElement(model, 'a', 'BusinessProcess', 'business');
    model = withElement(model, 'b', 'BusinessProcess', 'business');
    model = withRelation(model, 'r1', 'a', 'b', 'Serving');
    const relation = getRelation(model, 'r1');
    expect(relation).not.toBeNull();
    expect(relation!.id).toBe('r1');
    expect(relation!.type).toBe('Serving');
    expect(relation!.sourceId).toBe('a');
    expect(relation!.targetId).toBe('b');
  });

  it('returns null for unknown relation id', () => {
    const model = makeModel();
    expect(getRelation(model, 'nonexistent')).toBeNull();
  });

  it('returns null on empty model', () => {
    expect(getRelation(makeModel(), 'r-any')).toBeNull();
  });

  it('returns the correct relation among multiple', () => {
    let model = makeModel();
    model = withElement(model, 'a', 'BusinessProcess', 'business');
    model = withElement(model, 'b', 'BusinessProcess', 'business');
    model = withElement(model, 'c', 'BusinessProcess', 'business');
    model = withRelation(model, 'r1', 'a', 'b', 'Serving');
    model = withRelation(model, 'r2', 'b', 'c', 'Association');
    const relation = getRelation(model, 'r2');
    expect(relation!.type).toBe('Association');
    expect(relation!.sourceId).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// list_views
// ---------------------------------------------------------------------------

describe('listViews', () => {
  it('returns empty array for model with no views', () => {
    expect(listViews(makeModel())).toHaveLength(0);
  });

  it('returns all views', () => {
    let model = makeModel();
    model = withView(model, 'v1');
    model = withView(model, 'v2');
    const views = listViews(model);
    expect(views).toHaveLength(2);
  });

  it('each view has id and name', () => {
    let model = makeModel();
    model = withView(model, 'v1');
    const views = listViews(model);
    expect(views[0].id).toBe('v1');
    expect(views[0].name).toBe('View v1');
  });

  it('includes viewpoint when set', () => {
    let model = makeModel();
    model = withView(model, 'v1', [], [], 'Application Cooperation');
    const views = listViews(model);
    expect(views[0].viewpoint).toBe('Application Cooperation');
  });

  it('omits viewpoint when not set', () => {
    let model = makeModel();
    model = withView(model, 'v1');
    const views = listViews(model);
    expect('viewpoint' in views[0]).toBe(false);
  });

  it('includes element and relation lists', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    model = withView(model, 'v1', ['e1'], ['r1']);
    const views = listViews(model);
    expect(views[0].elements).toHaveLength(1);
    expect(views[0].elements[0].elementId).toBe('e1');
    expect(views[0].relations).toContain('r1');
  });
});

// ---------------------------------------------------------------------------
// get_view
// ---------------------------------------------------------------------------

describe('getView', () => {
  it('returns null for unknown view id', () => {
    expect(getView(makeModel(), 'nonexistent')).toBeNull();
  });

  it('returns view with resolved elements and relations', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    model = withElement(model, 'e2', 'BusinessActor', 'business');
    model = withRelation(model, 'r1', 'e1', 'e2', 'Serving');
    model = withView(model, 'v1', ['e1', 'e2'], ['r1']);
    const result = getView(model, 'v1');
    expect(result).not.toBeNull();
    expect(result!.elements).toHaveLength(2);
    expect(result!.relations).toHaveLength(1);
    expect(result!.relations[0].id).toBe('r1');
  });

  it('resolves only elements referenced in the view', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    model = withElement(model, 'e2', 'BusinessActor', 'business');
    // Only e1 is in the view
    model = withView(model, 'v1', ['e1'], []);
    const result = getView(model, 'v1');
    expect(result!.elements).toHaveLength(1);
    expect(result!.elements[0].id).toBe('e1');
  });

  it('returns view metadata in the result', () => {
    let model = makeModel();
    model = withView(model, 'v1');
    const result = getView(model, 'v1');
    expect(result!.view.id).toBe('v1');
    expect(result!.view.name).toBe('View v1');
  });

  it('returns empty elements and relations for an empty view', () => {
    let model = makeModel();
    model = withView(model, 'v1', [], []);
    const result = getView(model, 'v1');
    expect(result!.elements).toHaveLength(0);
    expect(result!.relations).toHaveLength(0);
  });

  it('skips dangling element references', () => {
    let model = makeModel();
    // view references e1 but e1 does not exist in model
    model = withView(model, 'v1', ['e1'], []);
    const result = getView(model, 'v1');
    expect(result!.elements).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// find_path
// ---------------------------------------------------------------------------

describe('findPathTool', () => {
  it('finds direct path between connected elements', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    model = withElement(model, 'e2', 'BusinessActor', 'business');
    model = withRelation(model, 'r1', 'e1', 'e2', 'Serving');
    const result = findPathTool(model, 'e1', 'e2');
    expect(result.found).toBe(true);
    expect(result.hopCount).toBe(1);
    expect(result.elements.map((e) => e.id)).toContain('e1');
    expect(result.elements.map((e) => e.id)).toContain('e2');
    expect(result.relations.map((r) => r.id)).toContain('r1');
  });

  it('finds multi-hop path', () => {
    let model = makeModel();
    model = withElement(model, 'a', 'BusinessProcess', 'business');
    model = withElement(model, 'b', 'BusinessProcess', 'business');
    model = withElement(model, 'c', 'BusinessProcess', 'business');
    model = withRelation(model, 'r1', 'a', 'b', 'Serving');
    model = withRelation(model, 'r2', 'b', 'c', 'Serving');
    const result = findPathTool(model, 'a', 'c');
    expect(result.found).toBe(true);
    expect(result.hopCount).toBe(2);
  });

  it('returns found=false when no path exists', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    model = withElement(model, 'e2', 'BusinessActor', 'business');
    // No relations between e1 and e2
    const result = findPathTool(model, 'e1', 'e2');
    expect(result.found).toBe(false);
    expect(result.hopCount).toBe(-1);
    expect(result.elements).toHaveLength(0);
    expect(result.relations).toHaveLength(0);
  });

  it('returns found=false when from_id does not exist', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    const result = findPathTool(model, 'nonexistent', 'e1');
    expect(result.found).toBe(false);
    expect(result.hopCount).toBe(-1);
  });

  it('returns trivial path when from_id equals to_id', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    const result = findPathTool(model, 'e1', 'e1');
    expect(result.found).toBe(true);
    expect(result.hopCount).toBe(0);
    expect(result.elements).toHaveLength(1);
    expect(result.relations).toHaveLength(0);
  });

  it('includes fromId and toId in result', () => {
    let model = makeModel();
    model = withElement(model, 'e1', 'BusinessProcess', 'business');
    model = withElement(model, 'e2', 'BusinessActor', 'business');
    const result = findPathTool(model, 'e1', 'e2');
    expect(result.fromId).toBe('e1');
    expect(result.toId).toBe('e2');
  });

  it('traverses relations in reverse direction (undirected BFS)', () => {
    let model = makeModel();
    model = withElement(model, 'a', 'BusinessProcess', 'business');
    model = withElement(model, 'b', 'BusinessProcess', 'business');
    // Relation goes from b to a (target→source), path query goes a→b
    model = withRelation(model, 'r1', 'b', 'a', 'Serving');
    const result = findPathTool(model, 'a', 'b');
    expect(result.found).toBe(true);
    expect(result.hopCount).toBe(1);
  });
});
