"""
Local test client — sends one chat message to the PlanningOS agent and prints
the reply. Useful for verifying the Agent Chat Protocol wiring before
registering on Agentverse.

Usage:
    1. In one terminal: python planningos_agent.py   (prints its address)
    2. Copy that address into PLANNINGOS_AGENT_ADDRESS below (or env var)
    3. In another terminal: python test_client_agent.py
"""

import os
from datetime import datetime
from uuid import uuid4

from uagents import Agent, Context
from uagents_core.contrib.protocols.chat import ChatAcknowledgement, ChatMessage, TextContent, chat_protocol_spec
from uagents import Protocol

PLANNINGOS_AGENT_ADDRESS = os.environ.get("PLANNINGOS_AGENT_ADDRESS", "")
TEST_MESSAGE = os.environ.get(
    "PLANNINGOS_TEST_MESSAGE",
    "Please check this proposal: single-storey rear extension at 12 Grove Vale, London SE22 8QZ, "
    "extending 4 metres with a flat roof and two rooflights.",
)

client = Agent(name="planningos-test-client", seed="planningos-test-client-seed", port=8002, mailbox=True)
chat_proto = Protocol(spec=chat_protocol_spec)


@chat_proto.on_message(ChatMessage)
async def handle_reply(ctx: Context, sender: str, msg: ChatMessage):
    for item in msg.content:
        if isinstance(item, TextContent):
            print("\n=== PlanningOS agent reply ===\n")
            print(item.text)
            print()


@chat_proto.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    ctx.logger.info("Message acknowledged by PlanningOS agent")


client.include(chat_proto, publish_manifest=True)


@client.on_event("startup")
async def send_test_message(ctx: Context):
    if not PLANNINGOS_AGENT_ADDRESS:
        ctx.logger.error("Set PLANNINGOS_AGENT_ADDRESS to the address printed by planningos_agent.py")
        return

    await ctx.send(
        PLANNINGOS_AGENT_ADDRESS,
        ChatMessage(timestamp=datetime.utcnow(), msg_id=uuid4(), content=[TextContent(type="text", text=TEST_MESSAGE)]),
    )


if __name__ == "__main__":
    client.run()
