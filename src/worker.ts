import { SessionDO } from "./session_do";
import { ReportWorkflow } from "./workflow";

export interface Env {
  AI: Ai;
  SESSION_DO: DurableObjectNamespace<SessionDO>;
  REPORT_WORKFLOW: Workflow;
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === "/health") return json({ ok: true });

    if (pathname === "/api/new-session") {
      return json({ sessionId: crypto.randomUUID() });
    }

    if (pathname === "/api/report") {
      if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

      const sessionId = url.searchParams.get("session");
      if (!sessionId) return new Response("Missing ?session=<id>", { status: 400 });

      const instanceId = `report-${sessionId}`;
      const instance = await env.REPORT_WORKFLOW.create({
        id: instanceId,
        params: { sessionId },
      });

      return json({ started: true, instanceId: instance.id });
    }

    if (pathname.startsWith("/session/")) {
      const parts = pathname.split("/").filter(Boolean);
      const sessionId = parts[1];
      if (!sessionId) return new Response("Missing session id", { status: 400 });

      const doId = env.SESSION_DO.idFromName(sessionId);
      const stub = env.SESSION_DO.get(doId);
      return stub.fetch(req);
    }

    if (pathname === "/") {
      return new Response(
        `OK. Deploy the UI via Pages from /web.

Endpoints:
- GET /api/new-session
- WS  /session/<id>/ws
- POST /api/report?session=<id>
- GET /session/<id>/report
`,
        { headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};

export { SessionDO, ReportWorkflow };
