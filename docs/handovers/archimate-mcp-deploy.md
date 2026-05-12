# Handover: archimate-mcp — tests + deployment

**Datum:** 2026-05-12  
**Doel:** Package is volledig geïmplementeerd en TypeScript-clean. Jouw taak: tests schrijven, Supabase-schema toepassen, en de server deployen op Beelink via Coolify.

---

## Wat dit is

`packages/archimate-mcp` in de `archiductor`-monorepo (`c:\Projecten\archiductor\`) is een remote HTTP/SSE MCP-server. Hij exposed 15 ArchiMate-tools aan Claude (8 read, 7 write) waarmee enterprise-architecten via natural language met hun ArchiMate-modellen kunnen werken. Claude integreert via de `mcp_servers`-parameter in de Anthropic API.

Eindbestemming: `https://mcp.archiductus.nl`, gehost op Beelink 1 (`192.168.68.71`) via Coolify + Cloudflare Tunnel.

Design-spec (lees als referentie): `docs/superpowers/specs/2026-05-12-archimate-mcp-design.md`

---

## Huidige staat

**Klaar:**
- Alle broncode aanwezig en TypeScript-clean (`tsc --noEmit` = 0 errors)
- `dist/server.js` is gebuild
- Alle 15 tools geïmplementeerd: `src/tools/read/` (8) + `src/tools/write/` (7)
- Parser, model, storage, auth, server entry — allemaal aanwezig
- Dockerfile aanwezig

**Ontbreekt — jouw werk:**
1. **Tests** — `tests/`-directory bestaat niet; vitest is geconfigureerd maar vindt niks
2. **Supabase-schema** — `archimate_models`-tabel nog niet aangemaakt in de Beelink-Supabase
3. **Coolify-app** — nog geen service aangemaakt voor archimate-mcp op Beelink
4. **CF Tunnel ingress** — `mcp.archiductus.nl` nog niet in de tunnel
5. **Env vars in Coolify** — SUPABASE_URL, SUPABASE_SERVICE_KEY, MCP_JWT_SECRET, PORT

---

## Taakvolgorde

### Stap 1 — Tests schrijven

Maak `packages/archimate-mcp/tests/` aan. Schrijf minimaal:

**Parser tests** (`tests/oef-parser.test.ts`):
- Parse geldig OEF XML → `ArchiMateModel` met correcte elementen/relaties/views
- Parse leeg model (geen elementen)
- Parse ongeldig XML → duidelijke foutmelding

**Model/query tests** (`tests/query.test.ts`):
- `listElements` met `layer`-filter
- `listElements` met `type`-filter
- `getElement` op bestaand en niet-bestaand id
- `findPath` tussen twee verbonden elementen

**Auth tests** (`tests/auth.test.ts`):
- Geldig JWT met correcte `model_id` → `ok: true`
- Verlopen JWT → `EXPIRED_TOKEN`
- JWT met verkeerde `model_id` → `MODEL_MISMATCH`
- Ontbrekende token → `MISSING_TOKEN`

**Tool unit tests** (`tests/tools/`):
- Eén test per write-tool (add-element, update-element, remove-element, add-relation, remove-relation, add-to-view, create-view)
- Gebruik fake/stub voor de storage-laag

Voer na elke batch uit: `npm test` in `packages/archimate-mcp/`. Alle tests moeten groen zijn.

### Stap 2 — Supabase-schema toepassen

Verbinding: Beelink 1 (`192.168.68.71`), container `supabase-db-j11290u98lvrdjkrf4x9nqgl`.

Pas de migratie toe via SSH + docker exec psql:

```bash
ssh ptrdbrbndr@192.168.68.71 "docker exec -i supabase-db-j11290u98lvrdjkrf4x9nqgl psql -U supabase_admin -d postgres" << 'SQL'
CREATE TABLE IF NOT EXISTS public.archimate_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  name        TEXT NOT NULL,
  format      TEXT NOT NULL CHECK (format IN ('oef', 'archimate', 'coarchi')),
  content     TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.archimate_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eigen modellen" ON public.archimate_models
  USING (user_id = auth.uid());

COMMENT ON TABLE public.archimate_models IS
  'Retentie: tot expliciete verwijdering door de eigenaar. Bevat architectuurmodellen (OEF XML). Privacy-niveau: intern.';
SQL
```

Verificeer: `SELECT COUNT(*) FROM archimate_models;` moet `0` teruggeven zonder foutmelding.

### Stap 3 — Coolify-app aanmaken

Gebruik de Coolify API op Beelink:

```bash
COOLIFY_TOKEN="3|d6bb0f5ca6736d45c1eea75d68033af2919f093863fb3c58ad3109d21d5605b0a1a31433db54bfee"
```

Maak een nieuwe Docker-gebaseerde application aan. Stel in:
- **GitHub repo:** `github.com/ptrdbrbndr/archiductor` (of Gitea-mirror indien beschikbaar)
- **Branch:** `main`
- **Build command:** `npm ci && npm run build -w packages/archimate-mcp`
- **Start command:** `node packages/archimate-mcp/dist/server.js`
- **Port:** `3100`
- **FQDN:** `https://mcp.archiductus.nl`

Stel env vars in via Coolify API of UI:

| Variabele | Waarde |
|---|---|
| `SUPABASE_URL` | `https://supabase-archiductus.cyberductus.nl` |
| `SUPABASE_SERVICE_KEY` | `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3ODQwNjk2MCwiZXhwIjo0OTM0MDgwNTYwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.AJBf3gn5dsXqwYhcqWodCMTxqWej3WIHSeWlP127I80` |
| `MCP_JWT_SECRET` | Genereer met `openssl rand -base64 32` — sla op in `credentials.md` §archiductus |
| `PORT` | `3100` |

**Belangrijk Coolify-patroon:** na aanmaken, update de `fqdn` direct in de Coolify-database EN herstart Coolify om de Traefik-labels te regenereren (anders blijft de FQDN op sslip.io):

```bash
ssh ptrdbrbndr@192.168.68.71 "docker exec -i coolify-db psql -U coolify -d coolify -c \
  \"UPDATE service_applications SET fqdn='https://mcp.archiductus.nl' WHERE name='archimate-mcp';\" && \
  docker restart coolify"
```

Zie memory `coolify_supabase_stack_creation.md` voor het volledige patroon.

### Stap 4 — CF Tunnel ingress toevoegen

De cyberductus-tunnel (`4931da40-8b72-4cc3-8f7e-6802b5e948a5`) heeft 74 bestaande ingress-regels. Je voegt er één toe voor `mcp.archiductus.nl`.

**KRITIEK:** gebruik altijd PUT met ALLE bestaande + nieuwe rules. Een gedeeltelijke PUT verwijdert bestaande routes. Zie memory `cf_tunnel_safeguards.md`.

1. Haal de huidige configuratie op via `GET /accounts/<account_id>/cfd_tunnel/4931da40.../configurations`
2. Voeg de nieuwe rule toe vóór de laatste catch-all rule:
   ```json
   {
     "hostname": "mcp.archiductus.nl",
     "service": "https://localhost:443",
     "originRequest": { "noTLSVerify": true }
   }
   ```
3. PUT de volledige updated configuratie terug
4. Maak DNS CNAME aan: `mcp` → `4931da40-8b72-4cc3-8f7e-6802b5e948a5.cfargotunnel.com` (proxied) in zone `f5117512e184e3c8e8984b85f4ca0f54`

Gebruik `CLOUDFLARE_TUNNEL_EDIT_TOKEN` (`<zie_credentials.md>`) voor de tunnel-PUT.
Gebruik `CLOUDFLARE_API_TOKEN` (uit `c:\Projecten\.env`) voor de DNS-CNAME.

### Stap 5 — Smoke-test

```bash
# Health check
curl https://mcp.archiductus.nl/health

# Verwacht: {"status":"ok","service":"archimate-mcp","version":"0.1.0"}
```

Als de health-check slaagt is de server live.

---

## Architectuur in het kort

```
Gebruiker in Archiductor-webapp
  → Claude API (mcp_servers: [{ url: "https://mcp.archiductus.nl" }])
    → archimate-mcp: JWT valideren (jose)
    → Supabase (service role): model ophalen via model_id
    → Parser: OEF XML → ArchiMateModel
    → Tool-handler: lezen of muteren
    → (write) Serializer: ArchiMateModel → OEF XML + opslaan
    → JSON response → Claude
```

**Stateless per request.** Geen caching, geen sessie-state. `archimate_models.version` incrementeert bij elke write.

**Auth:** twee lagen:
1. JWT (`user_id` + `model_id` + `exp`), gesigned met `MCP_JWT_SECRET`, gegenereerd door de webapp
2. Supabase RLS: `user_id = auth.uid()` — service-role bypast dit, maar de JWT-check garandeert dat de server alleen handelt namens de geverifieerde user

---

## Technische constraints

- **Geen magic link** — niet van toepassing hier (MCP-server heeft geen auth-UI)
- **Nooit secrets in code** — alle env-vars via Coolify, nooit committen
- **noTLSVerify: true** in CF Tunnel — altijd bij Coolify-apps op Beelink (geen geldig cert op localhost)
- **Beelink 1 = 192.168.68.71** (niet .69 of .10 — die zijn achterhaald)
- **Coolify auto-deploy is flaky** — na push: check image-tag binnen 30s, force-redeploy via API als nodig

---

## Na afronding

1. Commit de tests: `git add packages/archimate-mcp/tests/ && git commit -m "test(archimate-mcp): parser + query + auth + tool unit tests"`
2. Update `credentials.md` §archiductus met de nieuwe `MCP_JWT_SECRET` en Coolify app-UUID
3. Update `c:\Projecten\archiductus.nl\docs\archiductor\SESSION-HANDOVER.md` met status archimate-mcp (live op `mcp.archiductus.nl`)
4. Push naar GitHub: `git push origin main`

---

## Referenties

- Design spec: `docs/superpowers/specs/2026-05-12-archimate-mcp-design.md`
- Beelink deploy-patronen: memory `beelink_deploy_patterns.md`
- Coolify FQDN-cache: memory `feedback_coolify_fqdn_cache.md`
- CF Tunnel safeguards: memory `cf_tunnel_safeguards.md`
- CF Tunnel localhost-port trap: memory `feedback_cf_tunnel_localhost_port_trap.md`
- Beelink 2 deploy-patroon (GitHub deploy key): memory `beelink2_app_deploy_pattern.md` — relevant als je Gitea niet kunt bereiken
