# archimate-mcp — Design Spec

**Datum:** 2026-05-12  
**Status:** Goedgekeurd, klaar voor implementatieplan  
**Package:** `packages/archimate-mcp` (nieuw in archiductor-monorepo)

---

## Context

ArchiMate-tooling zoals Revit nu MCP native bevat voor BIM. Hetzelfde patroon — een MCP-server die een model exposed — is de onderscheidende factor voor Archiductor: enterprise-architecten kunnen via natural language met hun ArchiMate-modellen praten via Claude.

`archimate-mcp` is een remote HTTP/SSE MCP-server die ArchiMate Open Exchange Format modellen leest en schrijft via een gestructureerde tool-API. Claude integreert ermee via de Claude API's `mcp_servers`-parameter.

---

## Beslissingen

| Vraag | Beslissing | Reden |
| --- | --- | --- |
| Primaire gebruiker | Ontwikkelaars die Archiductor-webapp bouwen | Developer-facing, Claude als AI-laag ín de app |
| Operaties | Volledig read + write | 15 tools: 8 read, 7 write |
| Inputformaat | OEF XML + Archi `.archimate` + CoArchi | Format-agnostisch via adapter-laag, OEF is canonieke opslag |
| Deployment | Remote HTTP/SSE server op Beelink | Hoe Claude API MCP integreert; forward-compat met Claude Desktop |
| State | Stateless per request, Supabase als source of truth | Correctheid gegarandeerd, geen stale-state bugs |
| Package-strategie | Nieuw `packages/archimate-mcp`, eigen lichte parser | archimate-js pre-alpha, geen browser-deps nodig op server |

---

## Package-structuur

```text
packages/archimate-mcp/
├── src/
│   ├── parser/
│   │   ├── oef-parser.ts        # OEF XML → ArchiMateModel
│   │   ├── archimate-parser.ts  # .archimate XML → ArchiMateModel
│   │   ├── coarchi-parser.ts    # CoArchi folder → ArchiMateModel
│   │   └── serializer.ts        # ArchiMateModel → OEF XML
│   ├── model/
│   │   ├── types.ts             # ArchiMate element/relatie/view types
│   │   ├── model.ts             # In-memory model + mutation API
│   │   └── query.ts             # Filter- en traversal-helpers
│   ├── tools/
│   │   ├── read/                # 8 read tool-handlers
│   │   ├── write/               # 7 write tool-handlers
│   │   └── index.ts             # MCP tool-registry
│   ├── storage/
│   │   └── supabase.ts          # Fetch/save model via model_id + RLS
│   ├── auth/
│   │   └── middleware.ts        # JWT validatie (jose)
│   └── server.ts                # HTTP/SSE MCP server entry
├── Dockerfile
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**Kernprincipe:** volledig stateless. Elke tool-aanroep is zelfvoorzienend: fetch → parse → operatie → serialize → save.

**CoArchi-scope MVP:** `.archimate` single-file formaat wordt volledig ondersteund. CoArchi folder-tree (meerdere XML-bestanden per model) is fase 2 — een webapp kan geen folder uploaden zonder ZIP-afhandeling.

---

## MCP Tool-surface

### Read tools (8)

| Tool | Parameters | Beschrijving |
| --- | --- | --- |
| `get_model_summary` | `model_id` | Tellingen per laag, relatie-types, views — Claude's eerste aanroep |
| `list_elements` | `model_id, layer?, type?, name?` | Filter op ArchiMate-laag, elementtype, naampatroon |
| `get_element` | `model_id, element_id` | Volledige details: id, naam, type, laag, properties, documentatie |
| `list_relations` | `model_id, source_id?, target_id?, type?` | Relaties gefilterd op source, target of type |
| `get_relation` | `model_id, relation_id` | Volledige details van één relatie |
| `list_views` | `model_id` | Alle viewpoints/diagrammen |
| `get_view` | `model_id, view_id` | Elementen + relaties binnen één view |
| `find_path` | `model_id, from_id, to_id` | Kortste pad via relatie-traversal tussen twee elementen |

### Write tools (7)

| Tool | Parameters | Beschrijving |
| --- | --- | --- |
| `add_element` | `model_id, layer, type, name, properties?` | Nieuw element aanmaken; retourneert gegenereerde id |
| `update_element` | `model_id, element_id, changes` | Partial update: naam, properties, documentatie |
| `remove_element` | `model_id, element_id, cascade?` | Element verwijderen; `cascade:true` verwijdert hangende relaties |
| `add_relation` | `model_id, type, source_id, target_id, properties?` | Relatie leggen; valideert ArchiMate-regels |
| `remove_relation` | `model_id, relation_id` | Relatie verwijderen |
| `add_to_view` | `model_id, view_id, element_id` | Element of relatie toevoegen aan viewpoint |
| `create_view` | `model_id, name, viewpoint_type?` | Nieuw leeg viewpoint aanmaken |

---

## Dataflow

```text
Gebruiker → Archiductor-webapp
  → Claude API (mcp_servers: [{ url: "https://mcp.archiductus.nl", headers: { Authorization: "Bearer <jwt>" } }])
    → MCP handshake: archimate-mcp retourneert 15 tool-definities
    → Claude roept tools aan (typisch: get_model_summary → list_elements → list_relations → schrijf-operaties)
      → auth/middleware: JWT valideren, user_id + model_id extraheren
      → storage/supabase: model ophalen via model_id (RLS op user_id)
      → parser: OEF XML → ArchiMateModel
      → model/query of model/model: lezen of muteren
      → (write) serializer: ArchiMateModel → OEF XML
      → (write) storage/supabase: opslaan, version bumpen
      → JSON response → Claude
    → Claude formuleert antwoord
  → Webapp toont antwoord + triggert re-render archimate-js canvas
```

**Geen caching tussen requests.** Bewust: simpel, correctheid gegarandeerd. Heroverwegen bij >10k elementen.

---

## Storage

### Tabel: `archimate_models`

```sql
CREATE TABLE archimate_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  name        TEXT NOT NULL,
  format      TEXT NOT NULL CHECK (format IN ('oef', 'archimate', 'coarchi')),
  content     TEXT NOT NULL,  -- OEF XML (canonieke opslag)
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE archimate_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eigen modellen" ON archimate_models
  USING (user_id = auth.uid());
```

**Versioning:** elke write incrementeert `version`. Geen audit trail in MVP — rollback is fase 2.

---

## Auth

**Twee lagen, beide vereist:**

1. **JWT** — webapp genereert bij sessiestart:

   ```json
   { "user_id": "uuid", "model_id": "uuid", "exp": "now + 1h" }
   ```

   Gesigned met `MCP_JWT_SECRET`. Scoped op exact één model. TTL 1 uur.

2. **Supabase RLS** — de MCP-server injecteert `user_id` uit de JWT als Supabase-auth context. RLS blokkeert op databaseniveau, onafhankelijk van de JWT-check.

**Middleware-stappen per request:**

- `verify(token, MCP_JWT_SECRET)`
- Check `exp`
- Check `model_id` in payload == `model_id` in tool-parameter
- Inject `user_id` → Supabase RLS

---

## Deployment

### Tech stack

| Component | Keuze |
| --- | --- |
| Runtime | Node.js 20 + TypeScript |
| MCP transport | `@modelcontextprotocol/sdk` (HTTP/SSE) |
| XML parser | `fast-xml-parser` (al in archimate-js) |
| JWT | `jose` |
| Storage | `@supabase/supabase-js` (service role) |
| Build | `tsup` (ESM) |

### Infra

- **Coolify** op Beelink 1 (192.168.68.71) — nieuwe Docker-service
- **FQDN:** `mcp.archiductus.nl`
- **CF Tunnel:** `https://localhost:443` + `noTLSVerify: true`
- **GitHub deploy key** — zelfde patroon als overige Beelink-apps

### Dockerfile (in `packages/archimate-mcp/`)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build -w packages/archimate-mcp
CMD ["node", "packages/archimate-mcp/dist/server.js"]
```

### Environment variables

```text
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
MCP_JWT_SECRET=
PORT=3100
```

---

## Toekomstpad

- **Fase 2 — rollback:** audit trail via `archimate_model_versions`-tabel
- **Fase 2 — request-cache:** in-memory cache per Claude-sessie bij >10k elementen
- **Fase 2 — CoArchi folder:** ZIP-upload + extractie voor volledige CoArchi repo-structuur
- **M3 (juli 2026) — shared core:** `packages/archimate-core` extraheren zodra archimate-js API stabiel is; archimate-mcp en archimate-js worden beide consumer
- **Claude Desktop:** zero aanpassingen nodig — de remote HTTP/SSE server werkt direct als MCP-server in Claude Desktop-configuratie

---

## Wat dit niet is

- Geen vervanging voor archimate-js (die blijft de browser-renderer)
- Geen volledige Archi-compatibele tool — alleen model-manipulatie via API, geen UI
- Geen multi-tenant SaaS — één Beelink-deployment voor Archiductor
