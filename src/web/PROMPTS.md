# PROMPTS.md
AI-assisted coding log for cf_ai_edge_interview_coach

This file documents the prompts used to assist development, as required.
All final code was written, reviewed, and adapted by myself.

---

## Prompt 1 — Project architecture
"Design an original Cloudflare AI application using Workers AI (Llama 3.3), Durable Objects for memory/state, and Workflows for coordination. The app should be a realtime chat application with per-session memory and an async post-session report."

---

## Prompt 2 — Worker routing
"Generate a Cloudflare Worker (TypeScript) that:
- creates a new session ID
- routes /session/<id> requests to a Durable Object
- triggers a Workflow using env.REPORT_WORKFLOW.create()
- follows Cloudflare Workers conventions"

---

## Prompt 3 — Durable Object (state + realtime)
"Show a Durable Object that:
- accepts WebSocket connections
- stores chat history in Durable Object storage
- calls Workers AI (Llama 3.3) using env.AI.run
- broadcasts assistant responses to all connected clients
- exposes REST endpoints to fetch history and store a report"

---

## Prompt 4 — Workers AI usage
"Demonstrate how to call Workers AI with the model
@cf/meta/llama-3.3-70b-instruct-fp8-fast
using the messages[] format and return a text response suitable for chat."

---

## Prompt 5 — Workflow report generation
"Create a Cloudflare Workflow that:
- fetches a chat transcript from a Durable Object
- calls Workers AI to generate a structured markdown report
- writes the report back to the Durable Object
- is triggered by a Worker API endpoint"

---

## Prompt 6 — Frontend UI
"Write a minimal browser-only HTML + JavaScript chat UI that:
- creates a session via /api/new-session
- opens a WebSocket to /session/<id>/ws
- sends user messages
- renders assistant responses
- triggers report generation via POST /api/report"
