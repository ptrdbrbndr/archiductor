# archimate-mcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/archimate-mcp` — een stateless remote HTTP/SSE MCP-server die ArchiMate-modellen leest en schrijft via 15 tools, met Supabase als storage en JWT-auth.

**Architecture:** Nieuw npm workspace-package in het archiductor-monorepo. Elke tool-aanroep is volledig stateless: fetch OEF XML uit Supabase → parse in-memory → operatie → serialize → save. Auth via JWT scoped op `model_id`, dubbel beveiligd met Supabase RLS.

**Tech Stack:** Node.js 20, TypeScript 5, `@modelcontextprotocol/sdk`, `fast-xml-parser`, `jose`, `@supabase/supabase-js`, `vitest`, `tsup`

---

## File Map

```
packages/archimate-mcp/
├── src/
│   ├── model/
│   │   ├── types.ts          # ArchiMate type definitions + ELEMENT_LAYER map
│   │   ├── model.ts          # In-memory model mutation API
│   │   └── query.ts          # Filter helpers + BFS path traversal
│   ├── parser/
│   │   ├── oef-parser.ts     # OEF XML → ArchiMateModel
│   │   ├── archimate-parser.ts # .archimate XML → ArchiMateModel
│   │   └── serializer.ts     # ArchiMateModel → OEF XML
│   ├── tools/
│   │   ├── context.ts        # AsyncLocalStorage voor auth header threading
│   │   ├── tool-handler.ts   # Gedeeld fetch-parse-execute-serialize patroon
│   │   ├── read/
│   │   │   ├── get-model-summary.ts
│   │   │   ├── list-elements.ts
│   │   │   ├── get-element.ts
│   │   │   ├── list-relations.ts
│   │   │   ├── get-relation.ts
│   │   │   ├── list-views.ts
│   │   │   ├── get-view.ts
│   │   │   └── find-path.ts
│   │   ├── write/
│   │   │   ├── add-element.ts
│   │   │   ├── update-element.ts
│   │   │   ├── remove-element.ts
│   │   │   ├── add-relation.ts
│   │   │   ├── remove-relation.ts
│   │   │   ├── add-to-view.ts
│   │   │   └── create-view.ts
│   │   └── index.ts          # Tool registry (alle 15 tools)
│   ├── storage/
│   │   └── supabase.ts       # fetchModel / saveModel
│   ├── auth/
│   │   └── middleware.ts     # verifyJwt
│   └── server.ts             # HTTP/SSE entry point
├── tests/
│   ├── model/
│   │   ├── model.test.ts
│   │   └── query.test.ts
│   ├── parser/
│   │   ├── oef-parser.test.ts
│   │   ├── archimate-parser.test.ts
│   │   └── serializer.test.ts
│   ├── auth/
│   │   └── middleware.test.ts
│   └── tools/
│       ├── read.test.ts
│       └── write.test.ts
├── fixtures/
│   ├── sample-oef.xml
│   └── sample.archimate
├── Dockerfile
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

---

## Task 1: Package scaffold

**Files:**
- Create: `packages/archimate-mcp/package.json`
- Create: `packages/archimate-mcp/tsconfig.json`
- Create: `packages/archimate-mcp/tsup.config.ts`
- Create: `packages/archimate-mcp/vitest.config.ts`

- [ ] **Stap 1: package.json aanmaken**

```json
{
  "name": "archimate-mcp",
  "version": "0.1.0",
  "description": "MCP server for ArchiMate model read/write via Claude API",
  "license": "MIT",
  "author": "Pieter de Brabander",
  "type": "module",
  "main": "./dist/server.js",
  "exports": {
    ".": "./dist/server.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.11.0",
    "@supabase/supabase-js": "^2.49.0",
    "fast-xml-parser": "^4.5.0",
    "jose": "^5.9.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Stap 2: tsconfig.json aanmaken**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Stap 3: tsup.config.ts aanmaken**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node20',
  platform: 'node',
});
```

- [ ] **Stap 4: vitest.config.ts aanmaken**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Stap 5: dependencies installeren**

```bash
npm install
```

Verwachte output: `added N packages` zonder errors.

- [ ] **Stap 6: typecheck draaien (mag nog falen — geen src/ bestanden)**

```bash
npm -w packages/archimate-mcp run typecheck
```

- [ ] **Stap 7: Commit**

```bash
git add packages/archimate-mcp/package.json packages/archimate-mcp/tsconfig.json packages/archimate-mcp/tsup.config.ts packages/archimate-mcp/vitest.config.ts
git commit -m "feat(archimate-mcp): package scaffold"
```

---

## Task 2: model/types.ts

**Files:**
- Create: `packages/archimate-mcp/src/model/types.ts`

Geen tests nodig — dit zijn pure type-definities. Typecheck is de verificatie.

- [ ] **Stap 1: types.ts aanmaken**

```typescript
export type ArchiMateLayer =
  | 'motivation'
  | 'strategy'
  | 'business'
  | 'application'
  | 'technology'
  | 'physical'
  | 'implementation_migration';

export type ArchiMateElementType =
  | 'Stakeholder' | 'Driver' | 'Assessment' | 'Goal' | 'Outcome'
  | 'Principle' | 'Requirement' | 'Constraint' | 'Meaning' | 'Value'
  | 'Resource' | 'Capability' | 'CourseOfAction' | 'ValueStream'
  | 'BusinessActor' | 'BusinessRole' | 'BusinessCollaboration'
  | 'BusinessInterface' | 'BusinessProcess' | 'BusinessFunction'
  | 'BusinessInteraction' | 'BusinessEvent' | 'BusinessService'
  | 'BusinessObject' | 'Contract' | 'Representation' | 'Product'
  | 'ApplicationComponent' | 'ApplicationCollaboration'
  | 'ApplicationInterface' | 'ApplicationFunction' | 'ApplicationInteraction'
  | 'ApplicationProcess' | 'ApplicationEvent' | 'ApplicationService' | 'DataObject'
  | 'Node' | 'Device' | 'SystemSoftware' | 'TechnologyCollaboration'
  | 'TechnologyInterface' | 'Path' | 'CommunicationNetwork'
  | 'TechnologyFunction' | 'TechnologyProcess' | 'TechnologyInteraction'
  | 'TechnologyEvent' | 'TechnologyService' | 'Artifact'
  | 'Equipment' | 'Facility' | 'DistributionNetwork' | 'Material'
  | 'WorkPackage' | 'Deliverable' | 'ImplementationEvent' | 'Plateau' | 'Gap'
  | 'Grouping' | 'Location' | 'Junction';

export type ArchiMateRelationType =
  | 'Association' | 'Specialization' | 'Realization' | 'Composition'
  | 'Aggregation' | 'Assignment' | 'Serving' | 'Access'
  | 'Influence' | 'Triggering' | 'Flow';

export const ELEMENT_LAYER: Record<string, ArchiMateLayer> = {
  Stakeholder: 'motivation', Driver: 'motivation', Assessment: 'motivation',
  Goal: 'motivation', Outcome: 'motivation', Principle: 'motivation',
  Requirement: 'motivation', Constraint: 'motivation', Meaning: 'motivation', Value: 'motivation',
  Resource: 'strategy', Capability: 'strategy', CourseOfAction: 'strategy', ValueStream: 'strategy',
  BusinessActor: 'business', BusinessRole: 'business', BusinessCollaboration: 'business',
  BusinessInterface: 'business', BusinessProcess: 'business', BusinessFunction: 'business',
  BusinessInteraction: 'business', BusinessEvent: 'business', BusinessService: 'business',
  BusinessObject: 'business', Contract: 'business', Representation: 'business', Product: 'business',
  ApplicationComponent: 'application', ApplicationCollaboration: 'application',
  ApplicationInterface: 'application', ApplicationFunction: 'application',
  ApplicationInteraction: 'application', ApplicationProcess: 'application',
  ApplicationEvent: 'application', ApplicationService: 'application', DataObject: 'application',
  Node: 'technology', Device: 'technology', SystemSoftware: 'technology',
  TechnologyCollaboration: 'technology', TechnologyInterface: 'technology',
  Path: 'technology', CommunicationNetwork: 'technology', TechnologyFunction: 'technology',
  TechnologyProcess: 'technology', TechnologyInteraction: 'technology',
  TechnologyEvent: 'technology', TechnologyService: 'technology', Artifact: 'technology',
  Equipment: 'physical', Facility: 'physical', DistributionNetwork: 'physical', Material: 'physical',
  WorkPackage: 'implementation_migration', Deliverable: 'implementation_migration',
  ImplementationEvent: 'implementation_migration', Plateau: 'implementation_migration',
  Gap: 'implementation_migration',
  Grouping: 'application', Location: 'business', Junction: 'application',
};

export interface ArchiMateProperty {
  key: string;
  value: string;
}

export interface ArchiMateElement {
  id: string;
  name: string;
  type: ArchiMateElementType;
  layer: ArchiMateLayer;
  documentation?: string;
  properties: ArchiMateProperty[];
}

export interface ArchiMateRelation {
  id: string;
  type: ArchiMateRelationType;
  sourceId: string;
  targetId: string;
  name?: string;
  documentation?: string;
  properties: ArchiMateProperty[];
}

export interface ArchiMateViewElement {
  elementId: string;
}

export interface ArchiMateView {
  id: string;
  name: string;
  viewpoint?: string;
  elements: ArchiMateViewElement[];
  relations: string[];
}

export interface ArchiMateModel {
  id: string;
  name: string;
  documentation?: string;
  elements: Map<string, ArchiMateElement>;
  relations: Map<string, ArchiMateRelation>;
  views: Map<string, ArchiMateView>;
}
```

- [ ] **Stap 2: typecheck**

```bash
npm -w packages/archimate-mcp run typecheck
```

Verwachte output: geen errors.

- [ ] **Stap 3: commit**

```bash
git add packages/archimate-mcp/src/model/types.ts
git commit -m "feat(archimate-mcp): ArchiMate type definitions"
```

---

## Task 3: model/model.ts

**Files:**
- Create: `packages/archimate-mcp/src/model/model.ts`
- Create: `packages/archimate-mcp/tests/model/model.test.ts`

- [ ] **Stap 1: failing tests schrijven**

`packages/archimate-mcp/tests/model/model.test.ts`:

```typescript
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
```

- [ ] **Stap 2: tests draaien — moeten falen**

```bash
npm -w packages/archimate-mcp test
```

Verwachte output: FAIL — `Cannot find module '../../src/model/model.js'`

- [ ] **Stap 3: model.ts implementeren**

`packages/archimate-mcp/src/model/model.ts`:

```typescript
import type {
  ArchiMateModel,
  ArchiMateElement,
  ArchiMateRelation,
  ArchiMateView,
  ArchiMateLayer,
  ArchiMateElementType,
  ArchiMateRelationType,
  ArchiMateProperty,
} from './types.js';

export function createModel(id: string, name: string, documentation?: string): ArchiMateModel {
  return {
    id,
    name,
    documentation,
    elements: new Map(),
    relations: new Map(),
    views: new Map(),
  };
}

export function addElement(
  model: ArchiMateModel,
  layer: ArchiMateLayer,
  type: ArchiMateElementType,
  name: string,
  properties: ArchiMateProperty[] = [],
  documentation?: string,
): ArchiMateElement {
  const element: ArchiMateElement = {
    id: crypto.randomUUID(),
    name,
    type,
    layer,
    documentation,
    properties,
  };
  model.elements.set(element.id, element);
  return element;
}

export function updateElement(
  model: ArchiMateModel,
  elementId: string,
  changes: Partial<Pick<ArchiMateElement, 'name' | 'documentation' | 'properties'>>,
): ArchiMateElement {
  const element = model.elements.get(elementId);
  if (!element) throw new Error(`Element not found: ${elementId}`);
  const updated = { ...element, ...changes };
  model.elements.set(elementId, updated);
  return updated;
}

export function removeElement(
  model: ArchiMateModel,
  elementId: string,
  cascade = false,
): void {
  if (!model.elements.has(elementId)) throw new Error(`Element not found: ${elementId}`);
  model.elements.delete(elementId);
  if (cascade) {
    for (const [id, relation] of model.relations) {
      if (relation.sourceId === elementId || relation.targetId === elementId) {
        model.relations.delete(id);
      }
    }
  }
}

export function addRelation(
  model: ArchiMateModel,
  type: ArchiMateRelationType,
  sourceId: string,
  targetId: string,
  properties: ArchiMateProperty[] = [],
  name?: string,
): ArchiMateRelation {
  if (!model.elements.has(sourceId)) throw new Error(`Source element not found: ${sourceId}`);
  if (!model.elements.has(targetId)) throw new Error(`Target element not found: ${targetId}`);
  const relation: ArchiMateRelation = {
    id: crypto.randomUUID(),
    type,
    sourceId,
    targetId,
    name,
    properties,
  };
  model.relations.set(relation.id, relation);
  return relation;
}

export function removeRelation(model: ArchiMateModel, relationId: string): void {
  if (!model.relations.has(relationId)) throw new Error(`Relation not found: ${relationId}`);
  model.relations.delete(relationId);
}

export function addToView(model: ArchiMateModel, viewId: string, elementId: string): void {
  const view = model.views.get(viewId);
  if (!view) throw new Error(`View not found: ${viewId}`);
  if (!model.elements.has(elementId)) throw new Error(`Element not found: ${elementId}`);
  if (view.elements.some(e => e.elementId === elementId)) return;
  view.elements.push({ elementId });
}

export function createView(
  model: ArchiMateModel,
  name: string,
  viewpoint?: string,
): ArchiMateView {
  const view: ArchiMateView = {
    id: crypto.randomUUID(),
    name,
    viewpoint,
    elements: [],
    relations: [],
  };
  model.views.set(view.id, view);
  return view;
}
```

- [ ] **Stap 4: tests draaien — moeten slagen**

```bash
npm -w packages/archimate-mcp test
```

Verwachte output: alle tests PASS.

- [ ] **Stap 5: commit**

```bash
git add packages/archimate-mcp/src/model/model.ts packages/archimate-mcp/tests/model/model.test.ts
git commit -m "feat(archimate-mcp): in-memory model mutation API"
```

---

## Task 4: model/query.ts

**Files:**
- Create: `packages/archimate-mcp/src/model/query.ts`
- Create: `packages/archimate-mcp/tests/model/query.test.ts`

- [ ] **Stap 1: failing tests schrijven**

`packages/archimate-mcp/tests/model/query.test.ts`:

```typescript
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
```

- [ ] **Stap 2: tests draaien — moeten falen**

```bash
npm -w packages/archimate-mcp test
```

Verwachte output: FAIL — `Cannot find module '../../src/model/query.js'`

- [ ] **Stap 3: query.ts implementeren**

`packages/archimate-mcp/src/model/query.ts`:

```typescript
import type {
  ArchiMateModel,
  ArchiMateElement,
  ArchiMateRelation,
  ArchiMateLayer,
  ArchiMateElementType,
  ArchiMateRelationType,
} from './types.js';

export function getModelSummary(model: ArchiMateModel) {
  const elementsByLayer: Record<string, number> = {};
  for (const el of model.elements.values()) {
    elementsByLayer[el.layer] = (elementsByLayer[el.layer] ?? 0) + 1;
  }
  const relationsByType: Record<string, number> = {};
  for (const rel of model.relations.values()) {
    relationsByType[rel.type] = (relationsByType[rel.type] ?? 0) + 1;
  }
  return {
    name: model.name,
    totalElements: model.elements.size,
    totalRelations: model.relations.size,
    totalViews: model.views.size,
    elementsByLayer,
    relationsByType,
  };
}

export function filterElements(
  model: ArchiMateModel,
  filters: { layer?: ArchiMateLayer; type?: ArchiMateElementType; name?: string },
): ArchiMateElement[] {
  return [...model.elements.values()].filter(el => {
    if (filters.layer && el.layer !== filters.layer) return false;
    if (filters.type && el.type !== filters.type) return false;
    if (filters.name && !el.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
    return true;
  });
}

export function filterRelations(
  model: ArchiMateModel,
  filters: { sourceId?: string; targetId?: string; type?: ArchiMateRelationType },
): ArchiMateRelation[] {
  return [...model.relations.values()].filter(rel => {
    if (filters.sourceId && rel.sourceId !== filters.sourceId) return false;
    if (filters.targetId && rel.targetId !== filters.targetId) return false;
    if (filters.type && rel.type !== filters.type) return false;
    return true;
  });
}

export function findPath(
  model: ArchiMateModel,
  fromId: string,
  toId: string,
): { elements: ArchiMateElement[]; relations: ArchiMateRelation[] } | null {
  if (!model.elements.has(fromId) || !model.elements.has(toId)) return null;
  if (fromId === toId) {
    return { elements: [model.elements.get(fromId)!], relations: [] };
  }

  const visited = new Set<string>([fromId]);
  const queue: Array<{ id: string; path: string[]; rels: string[] }> = [
    { id: fromId, path: [fromId], rels: [] },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = [...model.relations.values()].filter(
      r => r.sourceId === current.id || r.targetId === current.id,
    );
    for (const rel of neighbors) {
      const neighborId = rel.sourceId === current.id ? rel.targetId : rel.sourceId;
      if (visited.has(neighborId)) continue;
      const newPath = [...current.path, neighborId];
      const newRels = [...current.rels, rel.id];
      if (neighborId === toId) {
        return {
          elements: newPath.map(id => model.elements.get(id)!),
          relations: newRels.map(id => model.relations.get(id)!),
        };
      }
      visited.add(neighborId);
      queue.push({ id: neighborId, path: newPath, rels: newRels });
    }
  }
  return null;
}
```

- [ ] **Stap 4: tests draaien — moeten slagen**

```bash
npm -w packages/archimate-mcp test
```

Verwachte output: alle tests PASS.

- [ ] **Stap 5: commit**

```bash
git add packages/archimate-mcp/src/model/query.ts packages/archimate-mcp/tests/model/query.test.ts
git commit -m "feat(archimate-mcp): query helpers + BFS path traversal"
```

---

## Task 5: Test fixtures

**Files:**
- Create: `packages/archimate-mcp/fixtures/sample-oef.xml`
- Create: `packages/archimate-mcp/fixtures/sample.archimate`

- [ ] **Stap 1: OEF XML fixture aanmaken**

`packages/archimate-mcp/fixtures/sample-oef.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       identifier="model-1">
  <name xml:lang="en">Test Model</name>
  <documentation xml:lang="en">A test model</documentation>
  <elements>
    <element identifier="elem-1" xsi:type="BusinessActor">
      <name xml:lang="en">Customer</name>
    </element>
    <element identifier="elem-2" xsi:type="ApplicationComponent">
      <name xml:lang="en">CRM System</name>
      <documentation xml:lang="en">Customer relationship management</documentation>
      <properties>
        <property propertyDefinitionRef="propdef-1">
          <value xml:lang="en">IT</value>
        </property>
      </properties>
    </element>
  </elements>
  <relationships>
    <relationship identifier="rel-1" xsi:type="Assignment" source="elem-1" target="elem-2">
      <name xml:lang="en">uses</name>
    </relationship>
  </relationships>
  <views>
    <diagrams>
      <view identifier="view-1" xsi:type="Diagram">
        <name xml:lang="en">Application View</name>
        <node identifier="node-1" elementRef="elem-1"/>
        <node identifier="node-2" elementRef="elem-2"/>
      </view>
    </diagrams>
  </views>
  <propertyDefinitions>
    <propertyDefinition identifier="propdef-1" type="string">
      <name xml:lang="en">owner</name>
    </propertyDefinition>
  </propertyDefinitions>
</model>
```

- [ ] **Stap 2: .archimate fixture aanmaken**

`packages/archimate-mcp/fixtures/sample.archimate`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:archimate="http://www.archimatetool.com/archimate"
                 xmlns:xmi="http://www.omg.org/XMI"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmi:version="2.0"
                 xmi:id="model-1"
                 name="Test Model">
  <archimate:elements xsi:type="archimate:BusinessActor" xmi:id="elem-1" name="Customer"/>
  <archimate:elements xsi:type="archimate:ApplicationComponent" xmi:id="elem-2"
                      name="CRM System" documentation="Customer relationship management">
    <archimate:properties key="owner" value="IT"/>
  </archimate:elements>
  <archimate:relationships xsi:type="archimate:AssignmentRelationship" xmi:id="rel-1"
                           name="uses" source="elem-1" target="elem-2"/>
  <archimate:diagrams xsi:type="archimate:ArchimateDiagramModel" xmi:id="view-1" name="Application View">
    <archimate:children xsi:type="archimate:DiagramObject" xmi:id="child-1" archimateElement="elem-1"/>
    <archimate:children xsi:type="archimate:DiagramObject" xmi:id="child-2" archimateElement="elem-2"/>
  </archimate:diagrams>
</archimate:model>
```

- [ ] **Stap 3: commit**

```bash
git add packages/archimate-mcp/fixtures/
git commit -m "test(archimate-mcp): parser test fixtures"
```

---

## Task 6: parser/oef-parser.ts

**Files:**
- Create: `packages/archimate-mcp/src/parser/oef-parser.ts`
- Create: `packages/archimate-mcp/tests/parser/oef-parser.test.ts`

- [ ] **Stap 1: failing tests schrijven**

`packages/archimate-mcp/tests/parser/oef-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOef } from '../../src/parser/oef-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, '../../fixtures/sample-oef.xml'), 'utf-8');

describe('parseOef', () => {
  it('parses model id and name', () => {
    const model = parseOef('model-1', fixture);
    expect(model.id).toBe('model-1');
    expect(model.name).toBe('Test Model');
    expect(model.documentation).toBe('A test model');
  });

  it('parses elements with correct types and layers', () => {
    const model = parseOef('model-1', fixture);
    expect(model.elements.size).toBe(2);
    const actor = model.elements.get('elem-1');
    expect(actor?.name).toBe('Customer');
    expect(actor?.type).toBe('BusinessActor');
    expect(actor?.layer).toBe('business');
    const crm = model.elements.get('elem-2');
    expect(crm?.name).toBe('CRM System');
    expect(crm?.type).toBe('ApplicationComponent');
    expect(crm?.layer).toBe('application');
    expect(crm?.documentation).toBe('Customer relationship management');
  });

  it('parses properties', () => {
    const model = parseOef('model-1', fixture);
    const crm = model.elements.get('elem-2');
    expect(crm?.properties).toHaveLength(1);
    expect(crm?.properties[0]?.key).toBe('owner');
    expect(crm?.properties[0]?.value).toBe('IT');
  });

  it('parses relations', () => {
    const model = parseOef('model-1', fixture);
    expect(model.relations.size).toBe(1);
    const rel = model.relations.get('rel-1');
    expect(rel?.type).toBe('Assignment');
    expect(rel?.sourceId).toBe('elem-1');
    expect(rel?.targetId).toBe('elem-2');
    expect(rel?.name).toBe('uses');
  });

  it('parses views', () => {
    const model = parseOef('model-1', fixture);
    expect(model.views.size).toBe(1);
    const view = model.views.get('view-1');
    expect(view?.name).toBe('Application View');
    expect(view?.elements.map(e => e.elementId)).toContain('elem-1');
    expect(view?.elements.map(e => e.elementId)).toContain('elem-2');
  });
});
```

- [ ] **Stap 2: tests draaien — moeten falen**

```bash
npm -w packages/archimate-mcp test
```

Verwachte output: FAIL — `Cannot find module '../../src/parser/oef-parser.js'`

- [ ] **Stap 3: oef-parser.ts implementeren**

`packages/archimate-mcp/src/parser/oef-parser.ts`:

```typescript
import { XMLParser } from 'fast-xml-parser';
import { createModel } from '../model/model.js';
import { ELEMENT_LAYER } from '../model/types.js';
import type { ArchiMateModel, ArchiMateElementType, ArchiMateRelationType } from '../model/types.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['element', 'relationship', 'view', 'node', 'property', 'propertyDefinition'].includes(name),
  parseAttributeValue: true,
});

function getText(node: unknown): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'object' && node !== null && '#text' in node) return String((node as Record<string, unknown>)['#text']);
  return '';
}

function getLangText(node: unknown): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return getLangText(node[0]);
  return getText(node);
}

export function parseOef(modelId: string, xml: string): ArchiMateModel {
  const raw = parser.parse(xml) as Record<string, unknown>;
  const modelNode = raw['model'] as Record<string, unknown>;

  const model = createModel(modelId, getLangText(modelNode['name']), getLangText(modelNode['documentation']) || undefined);

  // Build property definition key map: id → name
  const propDefs = new Map<string, string>();
  const propDefList = (modelNode['propertyDefinitions'] as Record<string, unknown> | undefined);
  if (propDefList) {
    const defs = (propDefList['propertyDefinition'] as unknown[]) ?? [];
    for (const def of defs) {
      const d = def as Record<string, unknown>;
      const id = String(d['@_identifier']);
      const name = getLangText(d['name']);
      propDefs.set(id, name);
    }
  }

  // Parse elements
  const elementsNode = (modelNode['elements'] as Record<string, unknown> | undefined);
  const elements = (elementsNode?.['element'] as unknown[]) ?? [];
  for (const el of elements) {
    const e = el as Record<string, unknown>;
    const id = String(e['@_identifier']);
    const typeFull = String(e['@_xsi:type']);
    const type = typeFull.replace(/^.*:/, '') as ArchiMateElementType;
    const layer = ELEMENT_LAYER[type] ?? 'application';
    const name = getLangText(e['name']);
    const documentation = getLangText(e['documentation']) || undefined;

    const properties: { key: string; value: string }[] = [];
    const propsNode = e['properties'] as Record<string, unknown> | undefined;
    if (propsNode) {
      const props = (propsNode['property'] as unknown[]) ?? [];
      for (const p of props) {
        const prop = p as Record<string, unknown>;
        const defRef = String(prop['@_propertyDefinitionRef']);
        const key = propDefs.get(defRef) ?? defRef;
        const value = getLangText(prop['value']);
        properties.push({ key, value });
      }
    }

    model.elements.set(id, { id, name, type, layer, documentation, properties });
  }

  // Parse relationships
  const relsNode = (modelNode['relationships'] as Record<string, unknown> | undefined);
  const rels = (relsNode?.['relationship'] as unknown[]) ?? [];
  for (const rel of rels) {
    const r = rel as Record<string, unknown>;
    const id = String(r['@_identifier']);
    const typeFull = String(r['@_xsi:type']);
    const type = typeFull.replace(/^.*:/, '') as ArchiMateRelationType;
    const sourceId = String(r['@_source']);
    const targetId = String(r['@_target']);
    const name = getLangText(r['name']) || undefined;

    model.relations.set(id, { id, type, sourceId, targetId, name, properties: [] });
  }

  // Parse views
  const viewsNode = (modelNode['views'] as Record<string, unknown> | undefined);
  const diagrams = (viewsNode?.['diagrams'] as Record<string, unknown> | undefined);
  const views = (diagrams?.['view'] as unknown[]) ?? [];
  for (const v of views) {
    const view = v as Record<string, unknown>;
    const id = String(view['@_identifier']);
    const name = getLangText(view['name']);
    const nodes = (view['node'] as unknown[]) ?? [];
    const viewElements = nodes
      .map(n => ({ elementId: String((n as Record<string, unknown>)['@_elementRef']) }))
      .filter(e => e.elementId !== 'undefined');

    model.views.set(id, { id, name, elements: viewElements, relations: [] });
  }

  return model;
}
```

- [ ] **Stap 4: tests draaien — moeten slagen**

```bash
npm -w packages/archimate-mcp test
```

Verwachte output: alle tests PASS.

- [ ] **Stap 5: commit**

```bash
git add packages/archimate-mcp/src/parser/oef-parser.ts packages/archimate-mcp/tests/parser/oef-parser.test.ts
git commit -m "feat(archimate-mcp): OEF XML parser"
```

---

## Task 7: parser/archimate-parser.ts

**Files:**
- Create: `packages/archimate-mcp/src/parser/archimate-parser.ts`
- Create: `packages/archimate-mcp/tests/parser/archimate-parser.test.ts`

- [ ] **Stap 1: failing tests schrijven**

`packages/archimate-mcp/tests/parser/archimate-parser.test.ts`:

```typescript
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
```

- [ ] **Stap 2: tests draaien — moeten falen**

```bash
npm -w packages/archimate-mcp test
```

- [ ] **Stap 3: archimate-parser.ts implementeren**

`packages/archimate-mcp/src/parser/archimate-parser.ts`:

```typescript
import { XMLParser } from 'fast-xml-parser';
import { createModel } from '../model/model.js';
import { ELEMENT_LAYER } from '../model/types.js';
import type { ArchiMateModel, ArchiMateElementType, ArchiMateRelationType } from '../model/types.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['archimate:elements', 'archimate:relationships', 'archimate:diagrams', 'archimate:children', 'archimate:properties'].includes(name),
});

// Strip namespace prefix and remove "Relationship" suffix from relation types
function stripType(raw: string): string {
  return raw.replace(/^.*:/, '').replace(/Relationship$/, '');
}

export function parseArchimate(modelId: string, xml: string): ArchiMateModel {
  const raw = parser.parse(xml) as Record<string, unknown>;
  const modelNode = raw['archimate:model'] as Record<string, unknown>;

  const model = createModel(modelId, String(modelNode['@_name'] ?? ''));

  // Parse elements
  const elements = (modelNode['archimate:elements'] as unknown[]) ?? [];
  for (const el of elements) {
    const e = el as Record<string, unknown>;
    const id = String(e['@_xmi:id']);
    const type = stripType(String(e['@_xsi:type'])) as ArchiMateElementType;
    const layer = ELEMENT_LAYER[type] ?? 'application';
    const name = String(e['@_name'] ?? '');
    const documentation = e['@_documentation'] ? String(e['@_documentation']) : undefined;

    const properties: { key: string; value: string }[] = [];
    const props = (e['archimate:properties'] as unknown[]) ?? [];
    for (const p of props) {
      const prop = p as Record<string, unknown>;
      properties.push({ key: String(prop['@_key']), value: String(prop['@_value']) });
    }

    model.elements.set(id, { id, name, type, layer, documentation, properties });
  }

  // Parse relationships
  const rels = (modelNode['archimate:relationships'] as unknown[]) ?? [];
  for (const rel of rels) {
    const r = rel as Record<string, unknown>;
    const id = String(r['@_xmi:id']);
    const type = stripType(String(r['@_xsi:type'])) as ArchiMateRelationType;
    const sourceId = String(r['@_source']);
    const targetId = String(r['@_target']);
    const name = r['@_name'] ? String(r['@_name']) : undefined;
    model.relations.set(id, { id, type, sourceId, targetId, name, properties: [] });
  }

  // Parse diagrams
  const diagrams = (modelNode['archimate:diagrams'] as unknown[]) ?? [];
  for (const d of diagrams) {
    const diag = d as Record<string, unknown>;
    const id = String(diag['@_xmi:id']);
    const name = String(diag['@_name'] ?? '');
    const children = (diag['archimate:children'] as unknown[]) ?? [];
    const viewElements = children
      .map(c => ({ elementId: String((c as Record<string, unknown>)['@_archimateElement']) }))
      .filter(e => e.elementId !== 'undefined');
    model.views.set(id, { id, name, elements: viewElements, relations: [] });
  }

  return model;
}
```

- [ ] **Stap 4: tests draaien — moeten slagen**

```bash
npm -w packages/archimate-mcp test
```

- [ ] **Stap 5: commit**

```bash
git add packages/archimate-mcp/src/parser/archimate-parser.ts packages/archimate-mcp/tests/parser/archimate-parser.test.ts
git commit -m "feat(archimate-mcp): .archimate XML parser"
```

---

## Task 8: parser/serializer.ts

**Files:**
- Create: `packages/archimate-mcp/src/parser/serializer.ts`
- Create: `packages/archimate-mcp/tests/parser/serializer.test.ts`

- [ ] **Stap 1: failing tests schrijven**

`packages/archimate-mcp/tests/parser/serializer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOef } from '../../src/parser/oef-parser.js';
import { serializeToOef } from '../../src/parser/serializer.js';
import { parseOef as parseOef2 } from '../../src/parser/oef-parser.js';

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
    const model2 = parseOef2('model-1', xml);
    expect(model2.elements.size).toBe(model.elements.size);
    const actor = model2.elements.get('elem-1');
    expect(actor?.name).toBe('Customer');
    expect(actor?.type).toBe('BusinessActor');
  });

  it('roundtrip preserves relations', () => {
    const model = parseOef('model-1', fixture);
    const xml = serializeToOef(model);
    const model2 = parseOef2('model-1', xml);
    expect(model2.relations.size).toBe(model.relations.size);
    const rel = model2.relations.get('rel-1');
    expect(rel?.type).toBe('Assignment');
    expect(rel?.sourceId).toBe('elem-1');
  });

  it('roundtrip preserves views', () => {
    const model = parseOef('model-1', fixture);
    const xml = serializeToOef(model);
    const model2 = parseOef2('model-1', xml);
    expect(model2.views.size).toBe(model.views.size);
  });
});
```

- [ ] **Stap 2: tests draaien — moeten falen**

```bash
npm -w packages/archimate-mcp test
```

- [ ] **Stap 3: serializer.ts implementeren**

`packages/archimate-mcp/src/parser/serializer.ts`:

```typescript
import type { ArchiMateModel } from '../model/types.js';

export function serializeToOef(model: ArchiMateModel): string {
  const propDefs = new Map<string, string>(); // key → propdef-id
  let propDefCounter = 0;

  function getPropDefId(key: string): string {
    if (!propDefs.has(key)) {
      propDefs.set(key, `propdef-${++propDefCounter}`);
    }
    return propDefs.get(key)!;
  }

  // Collect all property keys first
  for (const el of model.elements.values()) {
    for (const p of el.properties) getPropDefId(p.key);
  }

  const elements = [...model.elements.values()].map(el => {
    const props = el.properties.map(p =>
      `      <property propertyDefinitionRef="${getPropDefId(p.key)}">
        <value xml:lang="en">${escapeXml(p.value)}</value>
      </property>`
    ).join('\n');

    return `    <element identifier="${el.id}" xsi:type="${el.type}">
      <name xml:lang="en">${escapeXml(el.name)}</name>${el.documentation ? `\n      <documentation xml:lang="en">${escapeXml(el.documentation)}</documentation>` : ''}${props ? `\n      <properties>\n${props}\n      </properties>` : ''}
    </element>`;
  }).join('\n');

  const relationships = [...model.relations.values()].map(rel =>
    `    <relationship identifier="${rel.id}" xsi:type="${rel.type}" source="${rel.sourceId}" target="${rel.targetId}">${rel.name ? `\n      <name xml:lang="en">${escapeXml(rel.name)}</name>\n    ` : ''}</relationship>`
  ).join('\n');

  const views = [...model.views.values()].map(v => {
    const nodes = v.elements.map(e =>
      `        <node identifier="node-${e.elementId}" elementRef="${e.elementId}"/>`
    ).join('\n');
    return `      <view identifier="${v.id}" xsi:type="Diagram">
        <name xml:lang="en">${escapeXml(v.name)}</name>
${nodes}
      </view>`;
  }).join('\n');

  const propDefsXml = [...propDefs.entries()].map(([key, id]) =>
    `    <propertyDefinition identifier="${id}" type="string">
      <name xml:lang="en">${escapeXml(key)}</name>
    </propertyDefinition>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       identifier="${model.id}">
  <name xml:lang="en">${escapeXml(model.name)}</name>${model.documentation ? `\n  <documentation xml:lang="en">${escapeXml(model.documentation)}</documentation>` : ''}
  <elements>
${elements}
  </elements>
  <relationships>
${relationships}
  </relationships>
  <views>
    <diagrams>
${views}
    </diagrams>
  </views>${propDefsXml ? `\n  <propertyDefinitions>\n${propDefsXml}\n  </propertyDefinitions>` : ''}
</model>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

- [ ] **Stap 4: tests draaien — moeten slagen**

```bash
npm -w packages/archimate-mcp test
```

- [ ] **Stap 5: commit**

```bash
git add packages/archimate-mcp/src/parser/serializer.ts packages/archimate-mcp/tests/parser/serializer.test.ts
git commit -m "feat(archimate-mcp): OEF XML serializer (roundtrip tested)"
```

---

## Task 9: auth/middleware.ts

**Files:**
- Create: `packages/archimate-mcp/src/auth/middleware.ts`
- Create: `packages/archimate-mcp/tests/auth/middleware.test.ts`

- [ ] **Stap 1: failing tests schrijven**

`packages/archimate-mcp/tests/auth/middleware.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT } from 'jose';
import { verifyJwt } from '../../src/auth/middleware.js';

const SECRET = 'test-secret-at-least-32-chars-long!!';
process.env['MCP_JWT_SECRET'] = SECRET;

async function makeToken(payload: Record<string, unknown>, expiresIn = '1h') {
  const secret = new TextEncoder().encode(SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .sign(secret);
}

describe('verifyJwt', () => {
  it('accepts valid token with matching model_id', async () => {
    const token = await makeToken({ user_id: 'user-1', model_id: 'model-1' });
    const ctx = await verifyJwt(`Bearer ${token}`, 'model-1');
    expect(ctx.userId).toBe('user-1');
    expect(ctx.modelId).toBe('model-1');
  });

  it('rejects missing Authorization header', async () => {
    await expect(verifyJwt(undefined, 'model-1')).rejects.toThrow('Missing');
  });

  it('rejects non-Bearer header', async () => {
    await expect(verifyJwt('Basic abc', 'model-1')).rejects.toThrow('Missing');
  });

  it('rejects mismatched model_id', async () => {
    const token = await makeToken({ user_id: 'user-1', model_id: 'model-1' });
    await expect(verifyJwt(`Bearer ${token}`, 'model-2')).rejects.toThrow('model_id');
  });

  it('rejects expired token', async () => {
    const token = await makeToken({ user_id: 'user-1', model_id: 'model-1' }, '0s');
    await expect(verifyJwt(`Bearer ${token}`, 'model-1')).rejects.toThrow();
  });

  it('rejects invalid JWT payload (missing user_id)', async () => {
    const token = await makeToken({ model_id: 'model-1' });
    await expect(verifyJwt(`Bearer ${token}`, 'model-1')).rejects.toThrow('Invalid JWT payload');
  });
});
```

- [ ] **Stap 2: tests draaien — moeten falen**

```bash
npm -w packages/archimate-mcp test
```

- [ ] **Stap 3: middleware.ts implementeren**

`packages/archimate-mcp/src/auth/middleware.ts`:

```typescript
import { jwtVerify } from 'jose';

export interface AuthContext {
  userId: string;
  modelId: string;
}

function getSecret(): Uint8Array {
  const s = process.env['MCP_JWT_SECRET'];
  if (!s) throw new Error('MCP_JWT_SECRET is not set');
  return new TextEncoder().encode(s);
}

export async function verifyJwt(
  authHeader: string | undefined,
  toolModelId: string,
): Promise<AuthContext> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  const token = authHeader.slice(7);
  const { payload } = await jwtVerify(token, getSecret());

  const userId = payload['user_id'];
  const modelId = payload['model_id'];

  if (typeof userId !== 'string' || typeof modelId !== 'string') {
    throw new Error('Invalid JWT payload: missing user_id or model_id');
  }
  if (modelId !== toolModelId) {
    throw new Error(`model_id in JWT (${modelId}) does not match tool parameter (${toolModelId})`);
  }

  return { userId, modelId };
}
```

- [ ] **Stap 4: tests draaien — moeten slagen**

```bash
npm -w packages/archimate-mcp test
```

- [ ] **Stap 5: commit**

```bash
git add packages/archimate-mcp/src/auth/middleware.ts packages/archimate-mcp/tests/auth/middleware.test.ts
git commit -m "feat(archimate-mcp): JWT auth middleware"
```

---

## Task 10: storage/supabase.ts

**Files:**
- Create: `packages/archimate-mcp/src/storage/supabase.ts`

Geen directe unit-test — Supabase is externe dep. Getest via integratie in tool-tests (met vi.mock).

- [ ] **Stap 1: supabase.ts aanmaken**

`packages/archimate-mcp/src/storage/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

function getClient() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  return createClient(url, key);
}

export async function fetchModel(modelId: string, userId: string): Promise<string> {
  const { data, error } = await getClient()
    .from('archimate_models')
    .select('content')
    .eq('id', modelId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error(`Model not found or access denied: ${modelId}`);
  }
  return (data as { content: string }).content;
}

export async function saveModel(
  modelId: string,
  userId: string,
  content: string,
): Promise<void> {
  const { error } = await getClient()
    .from('archimate_models')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', modelId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to save model: ${error.message}`);
}
```

- [ ] **Stap 2: typecheck**

```bash
npm -w packages/archimate-mcp run typecheck
```

- [ ] **Stap 3: commit**

```bash
git add packages/archimate-mcp/src/storage/supabase.ts
git commit -m "feat(archimate-mcp): Supabase storage adapter"
```

---

## Task 11: tools/context.ts + tools/tool-handler.ts

**Files:**
- Create: `packages/archimate-mcp/src/tools/context.ts`
- Create: `packages/archimate-mcp/src/tools/tool-handler.ts`

- [ ] **Stap 1: context.ts aanmaken** (AsyncLocalStorage voor auth header threading)

`packages/archimate-mcp/src/tools/context.ts`:

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  authHeader: string | undefined;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
```

- [ ] **Stap 2: tool-handler.ts aanmaken** (gedeeld fetch-parse-execute-save patroon)

`packages/archimate-mcp/src/tools/tool-handler.ts`:

```typescript
import { requestContext } from './context.js';
import { verifyJwt } from '../auth/middleware.js';
import { fetchModel, saveModel } from '../storage/supabase.js';
import { parseOef } from '../parser/oef-parser.js';
import { serializeToOef } from '../parser/serializer.js';
import type { ArchiMateModel } from '../model/types.js';

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function err(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export async function withReadModel(
  modelId: string,
  fn: (model: ArchiMateModel) => unknown,
): Promise<ToolResult> {
  try {
    const ctx = requestContext.getStore();
    const auth = await verifyJwt(ctx?.authHeader, modelId);
    const xml = await fetchModel(modelId, auth.userId);
    const model = parseOef(modelId, xml);
    const result = fn(model);
    return ok(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function withWriteModel(
  modelId: string,
  fn: (model: ArchiMateModel) => unknown,
): Promise<ToolResult> {
  try {
    const ctx = requestContext.getStore();
    const auth = await verifyJwt(ctx?.authHeader, modelId);
    const xml = await fetchModel(modelId, auth.userId);
    const model = parseOef(modelId, xml);
    const result = fn(model);
    const updatedXml = serializeToOef(model);
    await saveModel(modelId, auth.userId, updatedXml);
    return ok(result);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}
```

- [ ] **Stap 3: typecheck**

```bash
npm -w packages/archimate-mcp run typecheck
```

- [ ] **Stap 4: commit**

```bash
git add packages/archimate-mcp/src/tools/context.ts packages/archimate-mcp/src/tools/tool-handler.ts
git commit -m "feat(archimate-mcp): request context + tool handler helpers"
```

---

## Task 12: Read tools

**Files:**
- Create: `packages/archimate-mcp/src/tools/read/get-model-summary.ts`
- Create: `packages/archimate-mcp/src/tools/read/list-elements.ts`
- Create: `packages/archimate-mcp/src/tools/read/get-element.ts`
- Create: `packages/archimate-mcp/src/tools/read/list-relations.ts`
- Create: `packages/archimate-mcp/src/tools/read/get-relation.ts`
- Create: `packages/archimate-mcp/src/tools/read/list-views.ts`
- Create: `packages/archimate-mcp/src/tools/read/get-view.ts`
- Create: `packages/archimate-mcp/src/tools/read/find-path.ts`
- Create: `packages/archimate-mcp/tests/tools/read.test.ts`

- [ ] **Stap 1: failing tests schrijven**

`packages/archimate-mcp/tests/tools/read.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestContext } from '../../src/tools/context.js';
import { SignJWT } from 'jose';

const SECRET = 'test-secret-at-least-32-chars-long!!';
process.env['MCP_JWT_SECRET'] = SECRET;

// Minimal OEF XML for testing
const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       identifier="model-1">
  <name xml:lang="en">Test Model</name>
  <elements>
    <element identifier="elem-1" xsi:type="BusinessActor">
      <name xml:lang="en">Customer</name>
    </element>
    <element identifier="elem-2" xsi:type="ApplicationComponent">
      <name xml:lang="en">CRM System</name>
    </element>
  </elements>
  <relationships>
    <relationship identifier="rel-1" xsi:type="Assignment" source="elem-1" target="elem-2">
      <name xml:lang="en">uses</name>
    </relationship>
  </relationships>
  <views>
    <diagrams>
      <view identifier="view-1" xsi:type="Diagram">
        <name xml:lang="en">App View</name>
        <node identifier="node-1" elementRef="elem-1"/>
      </view>
    </diagrams>
  </views>
</model>`;

vi.mock('../../src/storage/supabase.js', () => ({
  fetchModel: vi.fn().mockResolvedValue(testXml),
  saveModel: vi.fn().mockResolvedValue(undefined),
}));

async function makeToken(modelId: string) {
  const secret = new TextEncoder().encode(SECRET);
  return new SignJWT({ user_id: 'user-1', model_id: modelId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);
}

async function runWithAuth<T>(modelId: string, fn: () => Promise<T>): Promise<T> {
  const token = await makeToken(modelId);
  return requestContext.run({ authHeader: `Bearer ${token}` }, fn);
}

describe('getModelSummaryTool', () => {
  it('returns summary', async () => {
    const { getModelSummaryTool } = await import('../../src/tools/read/get-model-summary.js');
    const result = await runWithAuth('model-1', () => getModelSummaryTool({ model_id: 'model-1' }));
    const data = JSON.parse(result.content[0]!.text);
    expect(data.totalElements).toBe(2);
    expect(data.totalRelations).toBe(1);
    expect(data.elementsByLayer.business).toBe(1);
    expect(data.elementsByLayer.application).toBe(1);
  });
});

describe('listElementsTool', () => {
  it('returns all elements without filter', async () => {
    const { listElementsTool } = await import('../../src/tools/read/list-elements.js');
    const result = await runWithAuth('model-1', () => listElementsTool({ model_id: 'model-1' }));
    const data = JSON.parse(result.content[0]!.text);
    expect(data).toHaveLength(2);
  });

  it('filters by layer', async () => {
    const { listElementsTool } = await import('../../src/tools/read/list-elements.js');
    const result = await runWithAuth('model-1', () => listElementsTool({ model_id: 'model-1', layer: 'application' }));
    const data = JSON.parse(result.content[0]!.text);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('CRM System');
  });
});

describe('getElementTool', () => {
  it('returns element by id', async () => {
    const { getElementTool } = await import('../../src/tools/read/get-element.js');
    const result = await runWithAuth('model-1', () => getElementTool({ model_id: 'model-1', element_id: 'elem-1' }));
    const data = JSON.parse(result.content[0]!.text);
    expect(data.name).toBe('Customer');
    expect(data.type).toBe('BusinessActor');
  });

  it('returns error for unknown element', async () => {
    const { getElementTool } = await import('../../src/tools/read/get-element.js');
    const result = await runWithAuth('model-1', () => getElementTool({ model_id: 'model-1', element_id: 'bad-id' }));
    expect(result.isError).toBe(true);
  });
});

describe('listRelationsTool', () => {
  it('returns all relations', async () => {
    const { listRelationsTool } = await import('../../src/tools/read/list-relations.js');
    const result = await runWithAuth('model-1', () => listRelationsTool({ model_id: 'model-1' }));
    const data = JSON.parse(result.content[0]!.text);
    expect(data).toHaveLength(1);
  });

  it('filters by source_id', async () => {
    const { listRelationsTool } = await import('../../src/tools/read/list-relations.js');
    const result = await runWithAuth('model-1', () => listRelationsTool({ model_id: 'model-1', source_id: 'elem-1' }));
    const data = JSON.parse(result.content[0]!.text);
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe('Assignment');
  });
});

describe('getRelationTool', () => {
  it('returns relation by id', async () => {
    const { getRelationTool } = await import('../../src/tools/read/get-relation.js');
    const result = await runWithAuth('model-1', () => getRelationTool({ model_id: 'model-1', relation_id: 'rel-1' }));
    const data = JSON.parse(result.content[0]!.text);
    expect(data.type).toBe('Assignment');
    expect(data.sourceId).toBe('elem-1');
    expect(data.targetId).toBe('elem-2');
  });

  it('returns error for unknown relation', async () => {
    const { getRelationTool } = await import('../../src/tools/read/get-relation.js');
    const result = await runWithAuth('model-1', () => getRelationTool({ model_id: 'model-1', relation_id: 'bad-id' }));
    expect(result.isError).toBe(true);
  });
});

describe('listViewsTool', () => {
  it('returns all views with counts', async () => {
    const { listViewsTool } = await import('../../src/tools/read/list-views.js');
    const result = await runWithAuth('model-1', () => listViewsTool({ model_id: 'model-1' }));
    const data = JSON.parse(result.content[0]!.text);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('App View');
    expect(typeof data[0].elementCount).toBe('number');
  });
});

describe('getViewTool', () => {
  it('returns view contents with resolved elements', async () => {
    const { getViewTool } = await import('../../src/tools/read/get-view.js');
    const result = await runWithAuth('model-1', () => getViewTool({ model_id: 'model-1', view_id: 'view-1' }));
    const data = JSON.parse(result.content[0]!.text);
    expect(data.name).toBe('App View');
    expect(data.elements).toHaveLength(1);
    expect(data.elements[0].name).toBe('Customer');
  });

  it('returns error for unknown view', async () => {
    const { getViewTool } = await import('../../src/tools/read/get-view.js');
    const result = await runWithAuth('model-1', () => getViewTool({ model_id: 'model-1', view_id: 'bad-view' }));
    expect(result.isError).toBe(true);
  });
});

describe('findPathTool', () => {
  it('finds path between two connected elements', async () => {
    const { findPathTool } = await import('../../src/tools/read/find-path.js');
    const result = await runWithAuth('model-1', () => findPathTool({ model_id: 'model-1', from_id: 'elem-1', to_id: 'elem-2' }));
    const data = JSON.parse(result.content[0]!.text);
    expect(data.elements).toHaveLength(2);
    expect(data.relations).toHaveLength(1);
  });

  it('returns error when no path', async () => {
    const { findPathTool } = await import('../../src/tools/read/find-path.js');
    const result = await runWithAuth('model-1', () => findPathTool({ model_id: 'model-1', from_id: 'elem-1', to_id: 'elem-nonexistent' }));
    expect(result.isError).toBe(true);
  });
});
```

- [ ] **Stap 2: tests draaien — moeten falen**

```bash
npm -w packages/archimate-mcp test
```

- [ ] **Stap 3: alle 8 read tools implementeren**

`packages/archimate-mcp/src/tools/read/get-model-summary.ts`:

```typescript
import { withReadModel } from '../tool-handler.js';
import { getModelSummary } from '../../model/query.js';

export async function getModelSummaryTool(args: { model_id: string }) {
  return withReadModel(args.model_id, model => getModelSummary(model));
}
```

`packages/archimate-mcp/src/tools/read/list-elements.ts`:

```typescript
import { withReadModel } from '../tool-handler.js';
import { filterElements } from '../../model/query.js';
import type { ArchiMateLayer, ArchiMateElementType } from '../../model/types.js';

export async function listElementsTool(args: {
  model_id: string;
  layer?: ArchiMateLayer;
  type?: ArchiMateElementType;
  name?: string;
}) {
  return withReadModel(args.model_id, model =>
    filterElements(model, { layer: args.layer, type: args.type, name: args.name })
  );
}
```

`packages/archimate-mcp/src/tools/read/get-element.ts`:

```typescript
import { withReadModel } from '../tool-handler.js';

export async function getElementTool(args: { model_id: string; element_id: string }) {
  return withReadModel(args.model_id, model => {
    const element = model.elements.get(args.element_id);
    if (!element) throw new Error(`Element not found: ${args.element_id}`);
    return element;
  });
}
```

`packages/archimate-mcp/src/tools/read/list-relations.ts`:

```typescript
import { withReadModel } from '../tool-handler.js';
import { filterRelations } from '../../model/query.js';
import type { ArchiMateRelationType } from '../../model/types.js';

export async function listRelationsTool(args: {
  model_id: string;
  source_id?: string;
  target_id?: string;
  type?: ArchiMateRelationType;
}) {
  return withReadModel(args.model_id, model =>
    filterRelations(model, { sourceId: args.source_id, targetId: args.target_id, type: args.type })
  );
}
```

`packages/archimate-mcp/src/tools/read/get-relation.ts`:

```typescript
import { withReadModel } from '../tool-handler.js';

export async function getRelationTool(args: { model_id: string; relation_id: string }) {
  return withReadModel(args.model_id, model => {
    const relation = model.relations.get(args.relation_id);
    if (!relation) throw new Error(`Relation not found: ${args.relation_id}`);
    return relation;
  });
}
```

`packages/archimate-mcp/src/tools/read/list-views.ts`:

```typescript
import { withReadModel } from '../tool-handler.js';

export async function listViewsTool(args: { model_id: string }) {
  return withReadModel(args.model_id, model =>
    [...model.views.values()].map(v => ({ id: v.id, name: v.name, viewpoint: v.viewpoint, elementCount: v.elements.length }))
  );
}
```

`packages/archimate-mcp/src/tools/read/get-view.ts`:

```typescript
import { withReadModel } from '../tool-handler.js';

export async function getViewTool(args: { model_id: string; view_id: string }) {
  return withReadModel(args.model_id, model => {
    const view = model.views.get(args.view_id);
    if (!view) throw new Error(`View not found: ${args.view_id}`);
    const elements = view.elements.map(e => model.elements.get(e.elementId)).filter(Boolean);
    const relations = view.relations.map(id => model.relations.get(id)).filter(Boolean);
    return { ...view, elements, relations };
  });
}
```

`packages/archimate-mcp/src/tools/read/find-path.ts`:

```typescript
import { withReadModel } from '../tool-handler.js';
import { findPath } from '../../model/query.js';

export async function findPathTool(args: { model_id: string; from_id: string; to_id: string }) {
  return withReadModel(args.model_id, model => {
    const path = findPath(model, args.from_id, args.to_id);
    if (!path) throw new Error(`No path found between ${args.from_id} and ${args.to_id}`);
    return path;
  });
}
```

- [ ] **Stap 4: tests draaien — moeten slagen**

```bash
npm -w packages/archimate-mcp test
```

Verwachte output: alle tests PASS.

- [ ] **Stap 5: commit**

```bash
git add packages/archimate-mcp/src/tools/read/ packages/archimate-mcp/tests/tools/read.test.ts
git commit -m "feat(archimate-mcp): 8 read tools"
```

---

## Task 13: Write tools

**Files:**
- Create: `packages/archimate-mcp/src/tools/write/add-element.ts`
- Create: `packages/archimate-mcp/src/tools/write/update-element.ts`
- Create: `packages/archimate-mcp/src/tools/write/remove-element.ts`
- Create: `packages/archimate-mcp/src/tools/write/add-relation.ts`
- Create: `packages/archimate-mcp/src/tools/write/remove-relation.ts`
- Create: `packages/archimate-mcp/src/tools/write/add-to-view.ts`
- Create: `packages/archimate-mcp/src/tools/write/create-view.ts`
- Create: `packages/archimate-mcp/tests/tools/write.test.ts`

- [ ] **Stap 1: failing tests schrijven**

`packages/archimate-mcp/tests/tools/write.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestContext } from '../../src/tools/context.js';
import { SignJWT } from 'jose';

const SECRET = 'test-secret-at-least-32-chars-long!!';
process.env['MCP_JWT_SECRET'] = SECRET;

const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       identifier="model-1">
  <name xml:lang="en">Test Model</name>
  <elements>
    <element identifier="elem-1" xsi:type="BusinessActor">
      <name xml:lang="en">Customer</name>
    </element>
    <element identifier="elem-2" xsi:type="ApplicationComponent">
      <name xml:lang="en">CRM System</name>
    </element>
  </elements>
  <relationships>
    <relationship identifier="rel-1" xsi:type="Assignment" source="elem-1" target="elem-2"/>
  </relationships>
  <views>
    <diagrams>
      <view identifier="view-1" xsi:type="Diagram">
        <name xml:lang="en">App View</name>
        <node identifier="node-1" elementRef="elem-1"/>
      </view>
    </diagrams>
  </views>
</model>`;

vi.mock('../../src/storage/supabase.js', () => ({
  fetchModel: vi.fn().mockResolvedValue(testXml),
  saveModel: vi.fn().mockResolvedValue(undefined),
}));

async function makeToken(modelId: string) {
  const secret = new TextEncoder().encode(SECRET);
  return new SignJWT({ user_id: 'user-1', model_id: modelId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);
}

async function runWithAuth<T>(modelId: string, fn: () => Promise<T>): Promise<T> {
  const token = await makeToken(modelId);
  return requestContext.run({ authHeader: `Bearer ${token}` }, fn);
}

describe('addElementTool', () => {
  it('returns new element with id', async () => {
    const { addElementTool } = await import('../../src/tools/write/add-element.js');
    const result = await runWithAuth('model-1', () =>
      addElementTool({ model_id: 'model-1', layer: 'application', type: 'ApplicationComponent', name: 'API Gateway' })
    );
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0]!.text);
    expect(data.name).toBe('API Gateway');
    expect(typeof data.id).toBe('string');
  });
});

describe('updateElementTool', () => {
  it('updates element name', async () => {
    const { updateElementTool } = await import('../../src/tools/write/update-element.js');
    const result = await runWithAuth('model-1', () =>
      updateElementTool({ model_id: 'model-1', element_id: 'elem-1', changes: { name: 'Updated Customer' } })
    );
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0]!.text);
    expect(data.name).toBe('Updated Customer');
  });

  it('returns error for unknown element', async () => {
    const { updateElementTool } = await import('../../src/tools/write/update-element.js');
    const result = await runWithAuth('model-1', () =>
      updateElementTool({ model_id: 'model-1', element_id: 'bad-id', changes: { name: 'X' } })
    );
    expect(result.isError).toBe(true);
  });
});

describe('removeElementTool', () => {
  it('removes element (cascade false)', async () => {
    const { removeElementTool } = await import('../../src/tools/write/remove-element.js');
    const result = await runWithAuth('model-1', () =>
      removeElementTool({ model_id: 'model-1', element_id: 'elem-1' })
    );
    expect(result.isError).toBeUndefined();
  });
});

describe('addRelationTool', () => {
  it('adds relation between existing elements', async () => {
    const { addRelationTool } = await import('../../src/tools/write/add-relation.js');
    const result = await runWithAuth('model-1', () =>
      addRelationTool({ model_id: 'model-1', type: 'Serving', source_id: 'elem-2', target_id: 'elem-1' })
    );
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0]!.text);
    expect(data.type).toBe('Serving');
  });

  it('returns error for unknown source', async () => {
    const { addRelationTool } = await import('../../src/tools/write/add-relation.js');
    const result = await runWithAuth('model-1', () =>
      addRelationTool({ model_id: 'model-1', type: 'Association', source_id: 'bad', target_id: 'elem-1' })
    );
    expect(result.isError).toBe(true);
  });
});

describe('removeRelationTool', () => {
  it('removes existing relation', async () => {
    const { removeRelationTool } = await import('../../src/tools/write/remove-relation.js');
    const result = await runWithAuth('model-1', () =>
      removeRelationTool({ model_id: 'model-1', relation_id: 'rel-1' })
    );
    expect(result.isError).toBeUndefined();
  });
});

describe('addToViewTool', () => {
  it('adds element to view', async () => {
    const { addToViewTool } = await import('../../src/tools/write/add-to-view.js');
    const result = await runWithAuth('model-1', () =>
      addToViewTool({ model_id: 'model-1', view_id: 'view-1', element_id: 'elem-2' })
    );
    expect(result.isError).toBeUndefined();
  });
});

describe('createViewTool', () => {
  it('creates new view', async () => {
    const { createViewTool } = await import('../../src/tools/write/create-view.js');
    const result = await runWithAuth('model-1', () =>
      createViewTool({ model_id: 'model-1', name: 'New View', viewpoint_type: 'Application' })
    );
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0]!.text);
    expect(data.name).toBe('New View');
    expect(typeof data.id).toBe('string');
  });
});
```

- [ ] **Stap 2: tests draaien — moeten falen**

```bash
npm -w packages/archimate-mcp test
```

- [ ] **Stap 3: alle 7 write tools implementeren**

`packages/archimate-mcp/src/tools/write/add-element.ts`:

```typescript
import { withWriteModel } from '../tool-handler.js';
import { addElement } from '../../model/model.js';
import type { ArchiMateLayer, ArchiMateElementType, ArchiMateProperty } from '../../model/types.js';

export async function addElementTool(args: {
  model_id: string;
  layer: ArchiMateLayer;
  type: ArchiMateElementType;
  name: string;
  properties?: ArchiMateProperty[];
  documentation?: string;
}) {
  return withWriteModel(args.model_id, model =>
    addElement(model, args.layer, args.type, args.name, args.properties ?? [], args.documentation)
  );
}
```

`packages/archimate-mcp/src/tools/write/update-element.ts`:

```typescript
import { withWriteModel } from '../tool-handler.js';
import { updateElement } from '../../model/model.js';
import type { ArchiMateProperty } from '../../model/types.js';

export async function updateElementTool(args: {
  model_id: string;
  element_id: string;
  changes: { name?: string; documentation?: string; properties?: ArchiMateProperty[] };
}) {
  return withWriteModel(args.model_id, model =>
    updateElement(model, args.element_id, args.changes)
  );
}
```

`packages/archimate-mcp/src/tools/write/remove-element.ts`:

```typescript
import { withWriteModel } from '../tool-handler.js';
import { removeElement } from '../../model/model.js';

export async function removeElementTool(args: {
  model_id: string;
  element_id: string;
  cascade?: boolean;
}) {
  return withWriteModel(args.model_id, model => {
    removeElement(model, args.element_id, args.cascade ?? false);
    return { removed: args.element_id };
  });
}
```

`packages/archimate-mcp/src/tools/write/add-relation.ts`:

```typescript
import { withWriteModel } from '../tool-handler.js';
import { addRelation } from '../../model/model.js';
import type { ArchiMateRelationType, ArchiMateProperty } from '../../model/types.js';

export async function addRelationTool(args: {
  model_id: string;
  type: ArchiMateRelationType;
  source_id: string;
  target_id: string;
  properties?: ArchiMateProperty[];
  name?: string;
}) {
  return withWriteModel(args.model_id, model =>
    addRelation(model, args.type, args.source_id, args.target_id, args.properties ?? [], args.name)
  );
}
```

`packages/archimate-mcp/src/tools/write/remove-relation.ts`:

```typescript
import { withWriteModel } from '../tool-handler.js';
import { removeRelation } from '../../model/model.js';

export async function removeRelationTool(args: { model_id: string; relation_id: string }) {
  return withWriteModel(args.model_id, model => {
    removeRelation(model, args.relation_id);
    return { removed: args.relation_id };
  });
}
```

`packages/archimate-mcp/src/tools/write/add-to-view.ts`:

```typescript
import { withWriteModel } from '../tool-handler.js';
import { addToView } from '../../model/model.js';

export async function addToViewTool(args: {
  model_id: string;
  view_id: string;
  element_id: string;
}) {
  return withWriteModel(args.model_id, model => {
    addToView(model, args.view_id, args.element_id);
    return { added: args.element_id, to_view: args.view_id };
  });
}
```

`packages/archimate-mcp/src/tools/write/create-view.ts`:

```typescript
import { withWriteModel } from '../tool-handler.js';
import { createView } from '../../model/model.js';

export async function createViewTool(args: {
  model_id: string;
  name: string;
  viewpoint_type?: string;
}) {
  return withWriteModel(args.model_id, model =>
    createView(model, args.name, args.viewpoint_type)
  );
}
```

- [ ] **Stap 4: tests draaien — moeten slagen**

```bash
npm -w packages/archimate-mcp test
```

Verwachte output: alle tests PASS.

- [ ] **Stap 5: commit**

```bash
git add packages/archimate-mcp/src/tools/write/ packages/archimate-mcp/tests/tools/write.test.ts
git commit -m "feat(archimate-mcp): 7 write tools"
```

---

## Task 14: tools/index.ts — Tool registry

**Files:**
- Create: `packages/archimate-mcp/src/tools/index.ts`

- [ ] **Stap 1: tool registry aanmaken**

`packages/archimate-mcp/src/tools/index.ts`:

```typescript
import { getModelSummaryTool } from './read/get-model-summary.js';
import { listElementsTool } from './read/list-elements.js';
import { getElementTool } from './read/get-element.js';
import { listRelationsTool } from './read/list-relations.js';
import { getRelationTool } from './read/get-relation.js';
import { listViewsTool } from './read/list-views.js';
import { getViewTool } from './read/get-view.js';
import { findPathTool } from './read/find-path.js';
import { addElementTool } from './write/add-element.js';
import { updateElementTool } from './write/update-element.js';
import { removeElementTool } from './write/remove-element.js';
import { addRelationTool } from './write/add-relation.js';
import { removeRelationTool } from './write/remove-relation.js';
import { addToViewTool } from './write/add-to-view.js';
import { createViewTool } from './write/create-view.js';

export const TOOLS = [
  {
    name: 'get_model_summary',
    description: 'Get a high-level overview of the ArchiMate model: element counts per layer, relation types, and view count. Call this first.',
    inputSchema: {
      type: 'object' as const,
      properties: { model_id: { type: 'string', description: 'The model UUID' } },
      required: ['model_id'],
    },
    handler: getModelSummaryTool,
  },
  {
    name: 'list_elements',
    description: 'List elements in the model, optionally filtered by layer, type, or name pattern (case-insensitive substring).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model_id: { type: 'string' },
        layer: { type: 'string', enum: ['motivation', 'strategy', 'business', 'application', 'technology', 'physical', 'implementation_migration'] },
        type: { type: 'string' },
        name: { type: 'string', description: 'Case-insensitive substring match on element name' },
      },
      required: ['model_id'],
    },
    handler: listElementsTool,
  },
  {
    name: 'get_element',
    description: 'Get full details of a single element by ID: name, type, layer, properties, documentation.',
    inputSchema: {
      type: 'object' as const,
      properties: { model_id: { type: 'string' }, element_id: { type: 'string' } },
      required: ['model_id', 'element_id'],
    },
    handler: getElementTool,
  },
  {
    name: 'list_relations',
    description: 'List relations, optionally filtered by source element, target element, or relation type.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model_id: { type: 'string' },
        source_id: { type: 'string' },
        target_id: { type: 'string' },
        type: { type: 'string' },
      },
      required: ['model_id'],
    },
    handler: listRelationsTool,
  },
  {
    name: 'get_relation',
    description: 'Get full details of a single relation by ID.',
    inputSchema: {
      type: 'object' as const,
      properties: { model_id: { type: 'string' }, relation_id: { type: 'string' } },
      required: ['model_id', 'relation_id'],
    },
    handler: getRelationTool,
  },
  {
    name: 'list_views',
    description: 'List all viewpoints/diagrams in the model with their element counts.',
    inputSchema: {
      type: 'object' as const,
      properties: { model_id: { type: 'string' } },
      required: ['model_id'],
    },
    handler: listViewsTool,
  },
  {
    name: 'get_view',
    description: 'Get full contents of a view: all elements and relations shown in this viewpoint.',
    inputSchema: {
      type: 'object' as const,
      properties: { model_id: { type: 'string' }, view_id: { type: 'string' } },
      required: ['model_id', 'view_id'],
    },
    handler: getViewTool,
  },
  {
    name: 'find_path',
    description: 'Find the shortest path between two elements via relation traversal. Useful for impact analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model_id: { type: 'string' },
        from_id: { type: 'string', description: 'Source element ID' },
        to_id: { type: 'string', description: 'Target element ID' },
      },
      required: ['model_id', 'from_id', 'to_id'],
    },
    handler: findPathTool,
  },
  {
    name: 'add_element',
    description: 'Add a new element to the model. Returns the created element including its generated ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model_id: { type: 'string' },
        layer: { type: 'string', enum: ['motivation', 'strategy', 'business', 'application', 'technology', 'physical', 'implementation_migration'] },
        type: { type: 'string', description: 'ArchiMate element type, e.g. ApplicationComponent, BusinessActor' },
        name: { type: 'string' },
        documentation: { type: 'string' },
        properties: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } },
      },
      required: ['model_id', 'layer', 'type', 'name'],
    },
    handler: addElementTool,
  },
  {
    name: 'update_element',
    description: 'Update an existing element. Partial update: only the provided fields are changed.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model_id: { type: 'string' },
        element_id: { type: 'string' },
        changes: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            documentation: { type: 'string' },
            properties: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } },
          },
        },
      },
      required: ['model_id', 'element_id', 'changes'],
    },
    handler: updateElementTool,
  },
  {
    name: 'remove_element',
    description: 'Remove an element from the model. Set cascade=true to also remove all relations connected to it.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model_id: { type: 'string' },
        element_id: { type: 'string' },
        cascade: { type: 'boolean', description: 'If true, also removes connected relations' },
      },
      required: ['model_id', 'element_id'],
    },
    handler: removeElementTool,
  },
  {
    name: 'add_relation',
    description: 'Add a relation between two existing elements. Common types: Association, Assignment, Serving, Realization, Composition, Aggregation, Triggering, Flow.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model_id: { type: 'string' },
        type: { type: 'string', enum: ['Association', 'Specialization', 'Realization', 'Composition', 'Aggregation', 'Assignment', 'Serving', 'Access', 'Influence', 'Triggering', 'Flow'] },
        source_id: { type: 'string' },
        target_id: { type: 'string' },
        name: { type: 'string' },
        properties: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } },
      },
      required: ['model_id', 'type', 'source_id', 'target_id'],
    },
    handler: addRelationTool,
  },
  {
    name: 'remove_relation',
    description: 'Remove a relation from the model by its ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model_id: { type: 'string' },
        relation_id: { type: 'string' },
      },
      required: ['model_id', 'relation_id'],
    },
    handler: removeRelationTool,
  },
  {
    name: 'add_to_view',
    description: 'Add an existing element to a viewpoint diagram.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model_id: { type: 'string' },
        view_id: { type: 'string' },
        element_id: { type: 'string' },
      },
      required: ['model_id', 'view_id', 'element_id'],
    },
    handler: addToViewTool,
  },
  {
    name: 'create_view',
    description: 'Create a new empty viewpoint diagram in the model.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model_id: { type: 'string' },
        name: { type: 'string' },
        viewpoint_type: { type: 'string', description: 'Optional ArchiMate viewpoint type, e.g. Application, Business' },
      },
      required: ['model_id', 'name'],
    },
    handler: createViewTool,
  },
] as const;
```

- [ ] **Stap 2: typecheck**

```bash
npm -w packages/archimate-mcp run typecheck
```

- [ ] **Stap 3: commit**

```bash
git add packages/archimate-mcp/src/tools/index.ts
git commit -m "feat(archimate-mcp): MCP tool registry (15 tools)"
```

---

## Task 15: server.ts — HTTP/SSE MCP server

**Files:**
- Create: `packages/archimate-mcp/src/server.ts`

- [ ] **Stap 1: server.ts aanmaken**

`packages/archimate-mcp/src/server.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from 'node:http';
import { requestContext } from './tools/context.js';
import { TOOLS } from './tools/index.js';

const server = new Server(
  { name: 'archimate-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
  const tool = TOOLS.find(t => t.name === request.params.name);
  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tool.handler as (args: any) => Promise<unknown>)(request.params.arguments ?? {});
});

const port = parseInt(process.env['PORT'] ?? '3100', 10);
const httpServer = createServer();

httpServer.on('request', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  await requestContext.run({ authHeader }, async () => {
    await server.connect(transport);
    await transport.handleRequest(req, res, await readBody(req));
  });
});

function readBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += String(chunk)));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : undefined);
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', reject);
  });
}

httpServer.listen(port, () => {
  console.log(`archimate-mcp listening on port ${port}`);
});
```

- [ ] **Stap 2: build draaien**

```bash
npm -w packages/archimate-mcp run build
```

Verwachte output: `dist/server.js` aangemaakt zonder errors.

- [ ] **Stap 3: smoke-test lokaal** (optioneel, vereist env vars)

```bash
SUPABASE_URL=http://localhost:54321 SUPABASE_SERVICE_KEY=test MCP_JWT_SECRET=test-secret-at-least-32-chars PORT=3100 node packages/archimate-mcp/dist/server.js
```

Verwachte output: `archimate-mcp listening on port 3100`

- [ ] **Stap 4: commit**

```bash
git add packages/archimate-mcp/src/server.ts
git commit -m "feat(archimate-mcp): HTTP/SSE MCP server entry"
```

---

## Task 16: Dockerfile + deployment

**Files:**
- Create: `packages/archimate-mcp/Dockerfile`
- Create: `packages/archimate-mcp/.gitignore`

- [ ] **Stap 1: Dockerfile aanmaken**

`packages/archimate-mcp/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/archimate-mcp/package.json ./packages/archimate-mcp/
COPY tsconfig.base.json ./
RUN npm ci
COPY packages/archimate-mcp/ ./packages/archimate-mcp/
RUN npm run build -w packages/archimate-mcp

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/archimate-mcp/dist ./dist
EXPOSE 3100
CMD ["node", "dist/server.js"]
```

- [ ] **Stap 2: .gitignore aanmaken**

`packages/archimate-mcp/.gitignore`:

```
dist/
```

- [ ] **Stap 3: Coolify service aanmaken op Beelink 1**

Via Coolify UI (https://coolify.cyberductus.nl):

1. New Resource → Docker → Dockerfile
2. Repository: `github.com/ptrdbrbndr/archiductor`
3. Branch: `main`
4. Dockerfile path: `packages/archimate-mcp/Dockerfile`
5. Port: `3100`
6. Domain: `mcp.archiductus.nl`
7. Environment variables instellen:
   - `SUPABASE_URL` → URL van archiductus Supabase stack
   - `SUPABASE_SERVICE_KEY` → service role key uit credentials.md
   - `MCP_JWT_SECRET` → nieuw random secret (32+ chars), ook opslaan in credentials.md
   - `PORT` → `3100`

- [ ] **Stap 4: CF Tunnel hostname toevoegen**

```bash
node c:/Projecten/.claude/cf-tunnel-add-hostname.mjs \
  --hostname mcp.archiductus.nl \
  --service https://localhost:443 \
  --noTLSVerify
```

- [ ] **Stap 5: Supabase tabel aanmaken**

Via Supabase SQL Editor van de archiductus stack:

```sql
CREATE TABLE archimate_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  name        TEXT NOT NULL,
  format      TEXT NOT NULL CHECK (format IN ('oef', 'archimate', 'coarchi')),
  content     TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE archimate_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eigen modellen" ON archimate_models
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Stap 6: smoke-test productie**

```bash
curl -s https://mcp.archiductus.nl/health || curl -s -X POST https://mcp.archiductus.nl \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Verwachte output: JSON met 15 tool-definities.

- [ ] **Stap 7: final commit**

```bash
git add packages/archimate-mcp/Dockerfile packages/archimate-mcp/.gitignore
git commit -m "feat(archimate-mcp): Dockerfile + deployment config"
```

---

## Checklist na afronding

- [ ] Alle tests groen: `npm -w packages/archimate-mcp test`
- [ ] Typecheck schoon: `npm -w packages/archimate-mcp run typecheck`
- [ ] Build slaagt: `npm -w packages/archimate-mcp run build`
- [ ] `MCP_JWT_SECRET` opgeslagen in `credentials.md`
- [ ] CF Tunnel verifiëren: `mcp.archiductus.nl` bereikbaar
- [ ] tools/list endpoint retourneert 15 tools
- [ ] `.superpowers/` in root `.gitignore` (visuele brainstorm-bestanden)
