![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

# PlanningOS — UK Planning Permission Agent

Built for the **UK AI Agent Hackathon EP5 × Conduct**.

UK householder planning applications routinely take **8–16 weeks** and cost applicants **£1,500–£6,000** in consultant fees, mostly spent manually cross-referencing policy, heritage, flood, highways, and neighbour-amenity rules that already exist in public datasets. PlanningOS runs five specialist AI agents in parallel over **real UK government data** and returns an explainable, evidence-linked recommendation in seconds — with a human always kept in the loop.

## What's real here (no fabricated data)

| Data | Source | Notes |
|---|---|---|
| Postcode → coordinates, council, ward | [postcodes.io](https://postcodes.io) | Free, open (MIT), ONS/OS data, no API key |
| Conservation areas, listed buildings, flood risk zones, green belt, Article 4 directions, scheduled monuments, SSSIs | [planning.data.gov.uk](https://www.planning.data.gov.uk) | UK government's open Planning Data Platform, 100+ datasets, no API key |
| 3D site map, real building footprints | [MapLibre GL JS](https://maplibre.org) + [OpenFreeMap](https://openfreemap.org) | Open vector tiles, no API key |
| Project-specific facts (height, volume, extension type) from text/drawings | Any OpenAI-compatible LLM (optional) | See [LLM configuration](#llm-configuration) — falls back to a transparent keyword heuristic if unset |

Only the *neighbour-amenity impact* and *highways proximity* signals remain user-estimated, because no free UK dataset covers them at this granularity — this is called out explicitly in the UI rather than silently guessed.

## Sponsor tracks addressed

- **Conduct AI** — the whole product: take a slow, document-heavy enterprise/public-sector process (UK planning triage) and compress weeks of manual cross-referencing into seconds, while keeping a human decision-maker in control. See the "weeks → minutes" panel on the review page.
- **Based AI** — a permission-aware memory layer (`src/lib/permissions/`) that enforces access **deterministically at the retrieval layer** (no LLM call on the read path), classifies sensitive fields **at write time** (optionally using an LLM), governs derived memory (agent results, final decision, audit log) **by lineage** back to the source application, and produces an audit log entry with **measured sub-millisecond latency** per check. Includes a temporal access rule (internal officer notes unlock publicly 30 days after decision) and a query-time cross-boundary leakage check. See [Access & permissions layer](#access--permissions-layer-based-ai-track).
- **Fetch.ai / ASI:One** — a real [uAgents](https://github.com/fetchai/uAgents) process implementing the Agent Chat Protocol, deployable to Agentverse and usable directly from ASI:One. See [FETCHAI.md](FETCHAI.md).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter a real UK postcode (try `SE22 8NG`, `BA1 5HG`, or `SL6 1AP`), and start an audit. Real conservation area / listed building / flood zone / green belt / Article 4 data is fetched live for that exact point.

### LLM configuration (optional)

Project-specific extraction (extension type, height, volume from the description or an uploaded drawing) can use any OpenAI-compatible endpoint:

```bash
# OpenAI
export LLM_API_KEY=sk-...
# OpenRouter
export LLM_API_KEY=sk-or-...
export LLM_BASE_URL=https://openrouter.ai/api/v1
export LLM_MODEL=openai/gpt-4o-mini
# Local (Ollama / LM Studio, OpenAI-compatible)
export LLM_BASE_URL=http://localhost:11434/v1
export LLM_MODEL=llama3.1
```

Without any LLM configured, the app still works end-to-end using a transparent text heuristic — real government constraint data is unaffected either way, since that never depends on the LLM.

### Optional persistence

Set `MONGODB_URI` to persist to MongoDB; otherwise the app uses a local JSON store under `data/` (fine for a hackathon demo).

## Access & permissions layer (Based AI track)

Open any completed application's review page and use the **role switcher** (Public / Applicant / Case officer / Auditor):

- Try adding a case-officer note containing a phone number — it's automatically classified `personal` at write time and instantly hidden from the Public view.
- Drag the "days since decision" slider past 30 — an `internal` note automatically becomes visible to Public (the temporal access rule), with no manual reclassification.
- Click "Revoke source access" — every derived record (agent results, final decision, evidence) becomes inaccessible to Public/Applicant immediately, because access is always resolved live by following lineage back to the source application, not cached on the derivative.
- Every decision shown is logged to the audit trail with the rule that fired and the measured latency (typically < 0.05ms — see `src/lib/permissions/gate.ts`).

## Main endpoints

- `POST /api/applications/upload` — create an application (multipart, with files)
- `POST /api/applications` — create an application (JSON)
- `GET /api/applications/:id` — application + results + decision + audit
- `POST /api/applications/:id/run-agents` — run the multi-agent pipeline
- `GET /api/applications/:id/results` — agent results + final decision
- `GET /api/applications/:id/audit` — audit trail
- `GET /api/applications/:id/access?role=&asOf=` — role-scoped, permission-gated view (Based AI layer)
- `PATCH /api/applications/:id/officer-notes` — write internal notes / toggle access revocation
- `GET /api/geo/search?q=` — live UK postcode search (postcodes.io)
- `GET /api/geo/constraints?postcode=` — live planning constraints for a postcode (planning.data.gov.uk)
- `POST /api/agent/chat` — Fetch.ai / ASI:One-facing chat bridge (see [FETCHAI.md](FETCHAI.md))

## How to test it

1. `npm run dev`, then open the home page and search a real postcode.
2. Walk the 3-step wizard: confirm the live-derived constraints, add a short project description (or a demo preset from the sidebar), optionally attach a drawing.
3. Watch the processing page (parallel agent execution + audit trail), then the review page: recommendation, agent-by-agent reasoning with real citations/links, the 3D site map, the impact panel, and the access/permissions panel.
4. Run `npm run lint` before handing it to judges.

## Project layout highlights

```
src/lib/services/postcodes.ts       postcodes.io client
src/lib/services/planningData.ts    planning.data.gov.uk client
src/lib/geo/wkt.ts                  WKT -> GeoJSON parser (no external dep)
src/lib/geo/massing.ts              schematic 3D massing footprint for the map
src/lib/llm/client.ts               OpenAI-compatible LLM client (OpenAI/OpenRouter/local)
src/lib/agents/*.ts                 five specialist agents (deterministic scoring, real-data grounded)
src/lib/permissions/*.ts            Based AI permission-aware memory layer
src/app/components/SiteMap3D.tsx    MapLibre/OpenFreeMap 3D site view
agentverse/planningos_agent.py      deployable Fetch.ai uAgent (Chat Protocol)
```

## Non-goals (by design, for a hackathon-scoped MVP)

- No automated planning *approval* — the system always produces a recommendation for a human case officer.
- No live council back-office integration (that would need per-council access).
- No survey-accurate 3D model — the map's proposed-massing extrusion is explicitly labelled schematic, sized from the extracted height/volume.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [postcodes.io docs](https://postcodes.io/docs/overview)
- [planning.data.gov.uk docs](https://www.planning.data.gov.uk/docs)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [Fetch.ai uAgents](https://github.com/fetchai/uAgents) / [ASI:One](https://docs.asi1.ai)
