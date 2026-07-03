"""
PlanningOS UK Planning Agent — Fetch.ai / ASI:One Chat Protocol bridge.

Registers a uAgent that speaks the standard Agent Chat Protocol (ACP) so it is
discoverable and directly usable from ASI:One. Every message is forwarded to
the PlanningOS Next.js backend (POST /api/agent/chat, see src/lib/fetchai),
which creates a planning application, runs the multi-agent pipeline
(policy / heritage / flood / highways / neighbour, grounded in real UK
government data from planning.data.gov.uk and postcodes.io), and returns an
explainable recommendation.

Run locally:
    pip install -r requirements.txt
    export PLANNINGOS_API_URL=http://localhost:3000   # or your deployed URL
    python planningos_agent.py

Then register on Agentverse (https://agentverse.ai):
    1. Create a new "Local Agent" and paste this agent's address (printed on
       startup) OR upload this file directly as a Hosted Agent.
    2. Enable the Chat Protocol in the Agentverse agent settings.
    3. Add the README-style description below to the agent profile.
    4. Open ASI:One, search for "PlanningOS", and chat with it directly.

See ../FETCHAI.md for the full write-up and demo flow.
"""

import os
import re
from datetime import datetime
from uuid import uuid4

import requests
from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    StartSessionContent,
    TextContent,
    chat_protocol_spec,
)

PLANNINGOS_API_URL = os.environ.get("PLANNINGOS_API_URL", "http://localhost:3000").rstrip("/")
PLANNINGOS_PUBLIC_URL = os.environ.get("PLANNINGOS_PUBLIC_URL", PLANNINGOS_API_URL)

UK_POSTCODE_RE = re.compile(r"([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b", re.IGNORECASE)

agent = Agent(
    name="PlanningOS UK Planning Agent",
    seed=os.environ.get("PLANNINGOS_AGENT_SEED", "planningos-uk-planning-agent-seed"),
    port=int(os.environ.get("PLANNINGOS_AGENT_PORT", "8001")),
    mailbox=True,
)

chat_proto = Protocol(spec=chat_protocol_spec)


def create_text_chat(text: str, end_session: bool = False) -> ChatMessage:
    content = [TextContent(type="text", text=text)]
    if end_session:
        content.append(EndSessionContent(type="end-session"))
    return ChatMessage(timestamp=datetime.utcnow(), msg_id=uuid4(), content=content)


def extract_title(message: str) -> str:
    first_line = message.strip().splitlines()[0] if message.strip() else "Planning enquiry"
    return (first_line[:80]).strip() or "Planning enquiry via ASI:One"


def call_planningos(message: str) -> dict:
    postcode_match = UK_POSTCODE_RE.search(message)
    address = f"{postcode_match.group(1).upper()} {postcode_match.group(2).upper()}" if postcode_match else None

    payload = {
        "message": message,
        "title": extract_title(message),
        "address": address or message,  # if no postcode found, still pass the text through - the backend will report it needs a UK postcode
        "description": message,
    }

    resp = requests.post(f"{PLANNINGOS_API_URL}/api/agent/chat", json=payload, timeout=60)
    resp.raise_for_status()
    return resp.json()


@chat_proto.on_message(ChatMessage)
async def handle_message(ctx: Context, sender: str, msg: ChatMessage):
    await ctx.send(
        sender,
        ChatAcknowledgement(timestamp=datetime.utcnow(), acknowledged_msg_id=msg.msg_id),
    )

    for item in msg.content:
        if isinstance(item, StartSessionContent):
            ctx.logger.info(f"New chat session from {sender}")
            continue

        if not isinstance(item, TextContent):
            continue

        text = item.text.strip()
        if not text:
            continue

        ctx.logger.info(f"Planning enquiry from {sender}: {text[:120]}")

        try:
            result = call_planningos(text)
            reply = result.get("reply", "I processed your planning enquiry.")
            app_id = result.get("applicationId")
            if app_id:
                reply += f"\n\nFull explainable breakdown (agents, evidence, audit trail, 3D site map): {PLANNINGOS_PUBLIC_URL}/review/{app_id}"
            await ctx.send(sender, create_text_chat(reply))
        except requests.exceptions.RequestException as exc:
            ctx.logger.exception("PlanningOS backend request failed")
            await ctx.send(
                sender,
                create_text_chat(
                    f"Sorry — I could not reach the PlanningOS backend ({PLANNINGOS_API_URL}). "
                    f"Please try again shortly. Details: {exc}"
                ),
            )


@chat_proto.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    ctx.logger.info(f"Received ack from {sender} for message {msg.acknowledged_msg_id}")


agent.include(chat_proto, publish_manifest=True)


if __name__ == "__main__":
    print(f"PlanningOS agent address: {agent.address}")
    print(f"Forwarding chat messages to: {PLANNINGOS_API_URL}/api/agent/chat")
    agent.run()
