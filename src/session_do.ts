export interface Env {
  AI: Ai;
}

type Role = "system" | "user" | "assistant";
type ChatMessage = { role: Role; content: string; ts: number };

type ClientToServer =
  | { type: "user"; text: string }
  | { type: "ping" }
  | { type: "get_report" };

type ServerToClient =
  | { type: "hello"; sessionId: string }
  | { type: "assistant"; text: string }
  | { type: "report_ready"; markdown: string }
  | { type: "error"; message: string }
  | { type: "pong" };

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const HISTORY_KEY = "history";
const REPORT_KEY = "latest_report";

const SYSTEM_PROMPT = `You are an interview coach for quant/software roles.
Rules:
- Be precise and technical; no fluff.
- If underspecified, ask exactly one clarifying question.
- Provide: (1) brief reasoning outline, (2) final answer, (3) one drill question.
`;

function now() {
  return Date.now();
}

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export class SessionDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Allow workflow to store report
    if (url.pathname.endsWith("/report") && req.method === "PUT") {
      const body = await req.text();
      await this.state.storage.put(REPORT_KEY, body);
      this.broadcast({ type: "report_ready", markdown: body });
      return new Response("OK");
    }

    // WebSocket endpoint
    if (url.pathname.endsWith("/ws")) {
      if (req.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      this.state.acceptWebSocket(server);
      server.send(JSON.stringify({ type: "hello", sessionId: this.state.id.toString() } satisfies ServerToClient));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname.endsWith("/report")) {
      const report = (await this.state.storage.get<string>(REPORT_KEY)) ?? "";
      return new Response(report, { headers: { "content-type": "text/markdown; charset=utf-8" } });
    }

    if (url.pathname.endsWith("/history")) {
      const history = (await this.state.storage.get<ChatMessage[]>(HISTORY_KEY)) ?? [];
      return Response.json({ history });
    }

    return new Response("Not Found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = safeJsonParse<ClientToServer>(text);

    if (!parsed) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" } satisfies ServerToClient));
      return;
    }

    if (parsed.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" } satisfies ServerToClient));
      return;
    }

    if (parsed.type === "get_report") {
      const report = (await this.state.storage.get<string>(REPORT_KEY)) ?? "";
      if (report) ws.send(JSON.stringify({ type: "report_ready", markdown: report } satisfies ServerToClient));
      return;
    }

    if (parsed.type !== "user") return;

    const userText = (parsed.text ?? "").trim();
    if (!userText) return;

    const history = (await this.state.storage.get<ChatMessage[]>(HISTORY_KEY)) ?? [];
    history.push({ role: "user", content: userText, ts: now() });
    await this.state.storage.put(HISTORY_KEY, history.slice(-24));

    const assistant = await this.generateAssistantReply(history.slice(-24));

    const history2 = (await this.state.storage.get<ChatMessage[]>(HISTORY_KEY)) ?? [];
    history2.push({ role: "assistant", content: assistant, ts: now() });
    await this.state.storage.put(HISTORY_KEY, history2.slice(-24));

    this.broadcast({ type: "assistant", text: assistant });
  }

  async webSocketClose(_ws: WebSocket) {}
  async webSocketError(_ws: WebSocket) {}

  private async generateAssistantReply(history: ChatMessage[]): Promise<string> {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    const res = await this.env.AI.run(MODEL, {
      messages,
      temperature: 0.4,
      max_tokens: 450,
    });

    const out = (res as any)?.response;
    return typeof out === "string" && out.trim() ? out.trim() : "Generation failed; please retry.";
  }

  private broadcast(msg: ServerToClient) {
    const payload = JSON.stringify(msg);
    for (const sock of this.state.getWebSockets()) {
      try {
        sock.send(payload);
      } catch {}
    }
  }
}
