import { OrchestratorAgent } from "./agents/orchestrator.js";
import { ResearchAgent }    from "./agents/research.js";
import { WriterAgent }       from "./agents/writer.js";

export const handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers, body: "" };

  const { topic, recipientEmail, slackChannel }
    = JSON.parse(event.body || "{}");

  if (!topic) return {
    statusCode: 400, headers,
    body: JSON.stringify({ error: "topic is required" })
  };

  const plan          = await new OrchestratorAgent().plan(topic);
  const { brief }     = await new ResearchAgent().research(topic, plan);
  const writer        = new WriterAgent();
  const deliverables  = await writer.write(topic, plan, brief);
  const dispatched    = await writer.dispatch(deliverables,
    { recipientEmail, slackChannel: slackChannel || "#research" });

  return {
    statusCode: 200, headers,
    body: JSON.stringify({ success: true, deliverables, dispatched }),
  };
};