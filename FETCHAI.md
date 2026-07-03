![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

# PlanningOS Fetch.ai Bridge

This repository exposes a chat-based bridge for Agentverse / ASI:One style workflows at:

- `POST /api/agent/chat`

The bridge can:

- create a planning application from chat
- run the multi-agent pipeline
- return an explainable result with evidence and policy references
- summarize the audit trail and next steps

## Demo Flow

1. Send a message with a title, address, and description.
2. The bridge creates the application.
3. The planning agents run.
4. The response returns the recommendation and score.

Example payload:

```json
{
  "message": "Please check this loft extension",
  "title": "Loft Extension with Rear Dormer",
  "address": "24 Kingswood Road, London SE22 8NG",
  "description": "Proposed hip-to-gable loft conversion with rear dormer and rooflights."
}
```

Example response:

```json
{
  "reply": "I created and analysed the application...",
  "status": "completed",
  "applicationId": "..."
}
```

## What To Register On Agentverse

- Agent name: `PlanningOS UK Planning Agent`
- Purpose: UK planning triage with explainable multi-agent analysis
- Chat endpoint: `POST /api/agent/chat`

## Notes

- The bridge is deterministic and local-first for hackathon reliability.
- If `OPENAI_API_KEY` or `AZURE_OPENAI_API_KEY` is present, extraction can use an LLM fallback.
- If `MONGODB_URI` is present, the workflow uses MongoDB for persistence.
