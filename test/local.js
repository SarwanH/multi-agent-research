import "dotenv/config";
import { OrchestratorAgent } from "../agents/orchestrator.js";
import { ResearchAgent }     from "../agents/research.js";
import { WriterAgent }       from "../agents/writer.js";

const topic          = "Impact of AI agents on software engineering";
const recipientEmail = "sarwanheralall11@gmail.com";
const slackChannel   = "##all-multi-research-agent";

const plan         = await new OrchestratorAgent().plan(topic);
console.log("[Orchestrator] Done\n");

const { brief, wordCount } = await new ResearchAgent().research(topic, plan);
console.log(`[Research] Done — ${wordCount} words\n`);

const writer       = new WriterAgent();
const deliverables = await writer.write(topic, plan, brief);
console.log("\n--- REPORT ---");
console.log(deliverables.report?.slice(0, 400));
console.log("\n--- EMAIL SUBJECT ---");
console.log(deliverables.email?.subject);
console.log("\n--- SLACK ---");
console.log(deliverables.slack);

const dispatched = await writer.dispatch(deliverables, { recipientEmail, slackChannel });
console.log("\n--- DISPATCH ---", dispatched);