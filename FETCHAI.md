![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

# PlanningOS × Fetch.ai / ASI:One

PlanningOS ships two layers of Fetch.ai integration:

1. **HTTP bridge** — `POST /api/agent/chat` (see `src/lib/fetchai/bridge.ts`). Framework-agnostic; any agent runtime can call it.
2. **Deployable uAgent** — `agentverse/planningos_agent.py`. A real [uAgents](https://github.com/fetchai/uAgents) process that implements the standard **Agent Chat Protocol (ACP)**, so it can be registered on **Agentverse** and used directly from **ASI:One**.

## What the agent does

A user chats naturally (e.g. *"Check this proposal: single-storey rear extension at 24 Kingswood Road, London SE22 8NG, extending 4 metres"*). The uAgent:

1. Extracts a UK postcode from the message (regex) and forwards the full text to the PlanningOS backend.
2. The backend geocodes the postcode (postcodes.io), pulls real planning constraints for that point (planning.data.gov.uk — conservation areas, listed buildings, flood risk zones, green belt, Article 4 directions), and runs the five specialist agents (policy, heritage, flood, highways, neighbour) in parallel.
3. The reply includes the recommendation, score, and a link to the full explainable review page (agent-by-agent reasoning, citations, audit trail, 3D site map).

## Running the uAgent locally

```bash
cd agentverse
pip install -r requirements.txt
export PLANNINGOS_API_URL=http://localhost:3000     # your running Next.js app
python planningos_agent.py
```

It prints its own agent address on startup. Test it end-to-end without Agentverse using the included client:

```bash
export PLANNINGOS_AGENT_ADDRESS=agent1q...           # from the line above
python test_client_agent.py
```

## Registering on Agentverse / ASI:One

1. Go to [agentverse.ai](https://agentverse.ai) and create a new agent.
   - **Local Agent**: run `planningos_agent.py` with `mailbox=True` (already set) and connect it from the Agentverse UI using the printed address.
   - **Hosted Agent**: paste the contents of `planningos_agent.py` into a new Hosted Agent and set `PLANNINGOS_API_URL` to your deployed PlanningOS URL (a hosted agent can't reach `localhost`).
2. In the agent's settings, enable the **Chat Protocol** (this repo's agent already declares `chat_protocol_spec` and calls `agent.include(chat_proto, publish_manifest=True)`, so it will be picked up automatically).
3. Fill in the profile:
   - Name: `PlanningOS UK Planning Agent`
   - Description: *"Explainable multi-agent UK householder planning triage — policy, heritage, flood, highways, and neighbour checks grounded in real government data (planning.data.gov.uk, postcodes.io), with a human always kept in the loop."*
   - Tags: `innovationlab`, `hackathon`, `planning`, `uk`, `compliance`
4. Open **ASI:One**, search for the agent by name, and chat with it directly — that conversation is what you share as the "public ASI:One shared chat session URL" deliverable.

## Direct HTTP bridge (no Python runtime needed)

```bash
curl -X POST http://localhost:3000/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Please check this loft extension",
    "title": "Loft Extension with Rear Dormer",
    "address": "24 Kingswood Road, London SE22 8NG",
    "description": "Proposed hip-to-gable loft conversion with rear dormer and rooflights."
  }'
```

Response:

```json
{
  "reply": "I created and analysed the application \"Loft Extension with Rear Dormer\". The recommendation is APPROVE with an overall score of 92/100.",
  "status": "completed",
  "applicationId": "..."
}
```

## Notes

- The bridge is deterministic where it matters (scoring/decision logic never calls an LLM at read time — see `src/lib/permissions` for the same principle applied to access control).
- If `LLM_API_KEY` (or `OPENAI_API_KEY` / `OPENROUTER_API_KEY`) is set, project-detail extraction (height, volume, extension type) can read uploaded drawings; otherwise a transparent text heuristic is used. Either way, conservation/flood/green-belt/Article 4 facts always come from live government data, never from the LLM.
- If `MONGODB_URI` is present, the workflow persists to MongoDB; otherwise it uses the local JSON store under `data/`.
