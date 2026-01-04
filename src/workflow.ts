import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { Env as WorkerEnv } from "./worker";

type Params = { sessionId: string };

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const REPORT_PROMPT = `You are generating a post-session interview coaching report.
Output markdown with these headings exactly:

# Summary
# Strengths
# Weaknesses
# Corrections
# 7-Day Drill Plan
# Recommended Resources

Constraints:
- Be specific and technical.
- Max 5 bullets per section.
- Drill Plan must be Day 1..Day 7 with exactly 2 tasks each day.
`;

export class ReportWorkflow extends WorkflowEntrypoint<WorkerEnv, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { sessionId } = event.payload;

    const transcript = await step.do("fetch transcript", async () => {
      const doId = this.env.SESSION_DO.idFromName(sessionId);
      const stub = this.env.SESSION_DO.get(doId);
      const r = await stub.fetch(`https://do/session/${sessionId}/history`);
      const data = (await r.json()) as { history: Array<{ role: string; content: string }> };
      return data.history ?? [];
    });

    const report = await step.do("generate report", async () => {
      const messages = [
        { role: "system", content: REPORT_PROMPT },
        { role: "user", content: `Transcript JSON:\n${JSON.stringify(transcript)}` },
      ];

      const res = await this.env.AI.run(MODEL, { messages, temperature: 0.3, max_tokens: 900 });
      const out = (res as any)?.response;
      return typeof out === "string" ? out.trim() : "# Summary\n(Report generation failed)\n";
    });

    await step.do("store report", async () => {
      const doId = this.env.SESSION_DO.idFromName(sessionId);
      const stub = this.env.SESSION_DO.get(doId);
      await stub.fetch(`https://do/session/${sessionId}/report`, { method: "PUT", body: report });
    });

    return { ok: true, sessionId };
  }
}
