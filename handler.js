import { OrchestratorAgent } from "./agents/orchestrator.js";
import { ResearchAgent }    from "./agents/research.js";
import { WriterAgent }       from "./agents/writer.js";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({});

export const handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers, body: "" };

  // Async worker mode — invoked by self
  if (event.source === "async") {
    const { topic, recipientEmail, slackChannel } = event;
    const plan         = await new OrchestratorAgent().plan(topic);
    const { brief }    = await new ResearchAgent().research(topic, plan);
    const writer       = new WriterAgent();
    const deliverables = await writer.write(topic, plan, brief);
    const dispatched   = await writer.dispatch(deliverables,
      { recipientEmail, slackChannel: slackChannel || "#research" });
    return { success: true, deliverables, dispatched };
  }

  // HTTP request mode — return immediately, run pipeline async
  const { topic, recipientEmail, slackChannel }
    = JSON.parse(event.body || "{}");

  if (!topic) return {
    statusCode: 400, headers,
    body: JSON.stringify({ error: "topic is required" })
  };

  await lambda.send(new InvokeCommand({
    FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    InvocationType: "Event",
    Payload: JSON.stringify({ source: "async", topic, recipientEmail, slackChannel })
  }));

  return {
    statusCode: 202,
    headers,
    body: JSON.stringify({
      success: true,
      message: "Pipeline started — check Gmail and Slack for results",
      topic
    }),
  };
};