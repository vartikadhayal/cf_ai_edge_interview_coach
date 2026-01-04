# cf_ai_edge_interview_coach

Edge Interview Coach is a realtime AI-powered interview preparation application built entirely on Cloudflare.

The app uses Workers AI (Llama 3.3) to provide technical interview coaching via a WebSocket-based chat interface, while Durable Objects maintain per-session memory and coordinate live connections. A Cloudflare Workflow can be triggered to asynchronously generate a structured post-session report with targeted feedback and drills.

---

## Features

- Realtime chat UI using WebSockets
- LLM responses powered by Workers AI (Llama 3.3)
- Per-session memory and state using Durable Objects
- Async report generation using Cloudflare Workflows
- Fully edge-native architecture

---

## Architecture Overview

Browser (Pages)
↕ WebSocket  
Cloudflare Worker  
↕  
Durable Object (session memory + coordination)  
↕  
Workers AI (Llama 3.3)

Worker → Workflow → Durable Object (post-session report)

---

## Core Components

### LLM
- Workers AI
- Model: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

### Workflow / Coordination
- Durable Objects:
  - Store chat history
  - Manage WebSocket connections
  - Persist session state
- Cloudflare Workflows:
  - Generate post-session coaching reports asynchronously

### User Input
- Web-based chat interface
- WebSocket communication for low-latency interaction

### Memory / State
- Durable Object storage maintains conversation context across messages
- Reports are stored and retrievable per session

---

## API Endpoints

- `GET /api/new-session`  
  Creates a new chat session.

- `WS /session/<sessionId>/ws`  
  WebSocket endpoint for realtime chat.

- `POST /api/report?session=<sessionId>`  
  Triggers report-generation workflow.

- `GET /session/<sessionId>/report`  
  Fetches the latest generated report.

---

## Running / Trying the Project

This repository is designed for Cloudflare Workers + Pages deployment.

### Local or Deployment Setup
1. Deploy the Worker using Cloudflare Wrangler.
2. Deploy the `/web` directory using Cloudflare Pages.
3. Open the Pages URL and begin chatting.

(Exact deployment steps are included in code comments; no local runtime is required to review the architecture.)

---

## Notes

- All code is original.
- No external frameworks are required.
- Designed to demonstrate stateful, realtime AI applications at the edge using Cloudflare primitives.

