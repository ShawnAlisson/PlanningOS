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

Open [http://localhost:3000](http://localhost:3000), enter a real UK postcode (try `SE22 8QZ`, `BA1 5HG`, or `SL6 1AP`), and start an audit. Real conservation area / listed building / flood zone / green belt / Article 4 data is fetched live for that exact point.

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

## End-to-end test guide

A full walkthrough to convince yourself (or a judge) that every piece is real and working. No API keys are required for steps 1–5; step 6 needs Python for the Fetch.ai agent.

### 0. Setup

```bash
cp .env.example .env.local   # optional - see comments inside, everything works with none of it set
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 1. Real postcode + live government data (no LLM needed)

1. On the home page, type a real postcode into the search box, e.g. `SE22 8QZ`, `BA1 5HG`, or `SL6 1AP`, and pick a suggestion (this hits `postcodes.io` live — try opening the Network tab and watch the `/api/geo/search` call).
2. Confirm the address. The app now calls `/api/geo/constraints`, which hits `planning.data.gov.uk` live for that exact lat/lng — you should see real flags appear (e.g. "Conservation area", "Flood Zone 2/3", "Green belt") depending on the postcode you picked. `SE22 8QZ` (East Dulwich) is a current South London postcode; `BA1 5HG` (Bath) sits in a World Heritage Site / conservation area; pick any rural postcode to see green belt.
3. Fill in a short project description, e.g. *"Single storey rear extension, 3.2m high, brick to match existing"*, and continue.

### 2. Real 3D footprint from an uploaded drawing

The map's proposed-massing extrusion can be built two ways, and the UI always tells you which one it's using (look at the caption strip under the map on the review page):

- **Schematic (default)** — if you don't upload a `.dxf`, the block is a square sized from the height/volume mentioned in your description (or the LLM's reading of it). Caption reads *"schematic estimated massing"*.
- **Real (upload a `.dxf`)** — a `.dxf` file is an open, text-based CAD interchange format that every CAD tool (AutoCAD, LibreCAD, QCAD, Revit, FreeCAD, SketchUp, ...) can export via *File → Save As/Export → DXF*, even if you drew the plan in `.dwg`. PlanningOS actually parses the real geometry (`src/lib/services/dxf.ts`) — every `LINE`/`LWPOLYLINE`/`POLYLINE`/`CIRCLE` entity — and computes a true bounding-box footprint, converting units using the file's own `$INSUNITS` header when present. Caption reads *"real footprint from uploaded DXF (WxD m, ...)"*.
  - **Binary `.dwg` is accepted but only stored as evidence** — there is no reliable open-source DWG parser, so PlanningOS does not pretend to extract geometry from it. This is stated in the upload screen's help text and in the map caption, not hidden.

To test the real path yourself without any CAD software, generate a minimal rectangular DXF and upload it:

```bash
cat > /tmp/extension.dxf <<'EOF'
0
SECTION
2
HEADER
9
$INSUNITS
70
6
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
0
90
4
70
1
10
0.0
20
0.0
10
8.0
20
0.0
10
8.0
20
5.0
10
0.0
20
5.0
0
ENDSEC
0
EOF
EOF
```

This describes an 8m × 5m rectangle in metres (`$INSUNITS 6`). Upload it in step 3 of the wizard (drag-and-drop or browse, it's a `.dxf` so it's accepted) alongside your description, submit, then on the review page check the map caption shows **"real footprint from uploaded DXF (8m × 5m, DXF $INSUNITS=6)"** and that the extruded block's proportions are visibly rectangular (not square) and correctly oriented.

You can also verify it purely via the API without the UI:

```bash
curl -s -X POST http://localhost:3000/api/applications/upload \
  -F 'metadata={"title":"DXF test","description":"Rear extension","address":"SE22 8QZ"}' \
  -F "files=@/tmp/extension.dxf;type=application/dxf" | tee /tmp/app.json

ID=$(python3 -c "import json;print(json.load(open('/tmp/app.json'))['id'])")
curl -s -X POST http://localhost:3000/api/applications/$ID/run-agents \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['application']['extractedData']['footprint'])"
# -> {'source': 'dxf', 'widthM': 8.0, 'depthM': 5.0, 'areaM2': 40.0, 'vertexCount': 4, 'unitAssumption': 'DXF $INSUNITS=6'}
```

### 3. The multi-agent pipeline (Conduct AI track)

On the processing page, watch the five specialist agents (Policy, Heritage, Flood, Highways, Neighbour) run and complete in seconds, each citing the real constraint entities returned in step 1 (e.g. a heritage agent citing the actual conservation area name and a `planning.data.gov.uk` link). On the review page, the "weeks → minutes" impact panel quantifies the time/cost saved versus a manual review.

### 4. Permission-aware memory layer (Based AI track)

On the review page's **Access & permissions** panel:

1. Switch role to **Public** — personal fields (e.g. applicant contact) are redacted; you'll see `[redacted: personal]` rather than the raw value.
2. Add a case-officer note containing something like `call 07123 456789` — it's classified `personal` automatically at write time (`src/lib/permissions/classify.ts`) and instantly hidden from Public.
3. Drag the "days since decision" slider past 30 — an `internal` note flips to visible under Public without any manual reclassification (the temporal access rule).
4. Click **Revoke source access** — every derived record (agent results, decision, evidence) becomes inaccessible to Public/Applicant immediately, because access is resolved live via lineage back to the source application on every read, not cached on the derivative.
5. Open `/api/applications/:id/audit` — every access decision above is logged with the rule that fired and measured latency (typically well under a millisecond, comfortably inside the sub-200ms P99 requirement).

### 5. Sanity checks

```bash
npm run lint     # should be clean
npx tsc --noEmit # should be clean
npm run build    # production build should succeed
```

### 6. Fetch.ai / ASI:One agent (optional, needs Python)

See [FETCHAI.md](FETCHAI.md) for the full write-up. Quick local test:

See the [Agent](https://asi1.ai/ai/agent1qtvkpscws7ymqkxtel3kgnf3d252c0ygg8nxlfzad4fjjsyan7tdqe2p8y7).


```bash
cd agentverse
pip install -r requirements.txt
export PLANNINGOS_API_URL=http://localhost:3000
python planningos_agent.py            # prints the agent's address, keep running
# in a second terminal:
python test_client_agent.py           # sends a sample planning enquiry and prints the reply
```

A successful run prints a natural-language reply plus a link to the generated `/review/:id` page — open it to see the same 3D map / agent breakdown / permissions panel produced purely from a chat message.

## Project layout highlights

```
src/lib/services/postcodes.ts       postcodes.io client
src/lib/services/planningData.ts    planning.data.gov.uk client
src/lib/geo/wkt.ts                  WKT -> GeoJSON parser (no external dep)
src/lib/geo/massing.ts              3D massing footprint for the map (real DXF geometry if available, else schematic)
src/lib/services/dxf.ts             real footprint extraction from an uploaded .dxf drawing
src/lib/llm/client.ts               OpenAI-compatible LLM client (OpenAI/OpenRouter/local)
src/lib/agents/*.ts                 five specialist agents (deterministic scoring, real-data grounded)
src/lib/permissions/*.ts            Based AI permission-aware memory layer
src/app/components/SiteMap3D.tsx    MapLibre/OpenFreeMap 3D site view
agentverse/planningos_agent.py      deployable Fetch.ai uAgent (Chat Protocol)
```

## Non-goals (by design, for a hackathon-scoped MVP)

- No automated planning *approval* — the system always produces a recommendation for a human case officer.
- No live council back-office integration (that would need per-council access).
- No binary .dwg parsing — DWG is a proprietary Autodesk format with no reliable open-source parser, so .dwg files are stored as evidence only. Upload a **.dxf** export of the same drawing (File → Save As / Export → DXF in AutoCAD, LibreCAD, QCAD, Revit, FreeCAD, etc.) to get a real, to-scale footprint extrusion on the 3D map instead of the schematic estimate. The map UI always labels which one it's showing.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [postcodes.io docs](https://postcodes.io/docs/overview)
- [planning.data.gov.uk docs](https://www.planning.data.gov.uk/docs)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [Fetch.ai uAgents](https://github.com/fetchai/uAgents) / [ASI:One](https://docs.asi1.ai)
