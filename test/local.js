import "dotenv/config";
import { handler } from "../handler.js";
process.env.NODE_ENV = 'local';

const result = await handler({
  httpMethod: "POST",
  body: JSON.stringify({
    topic: "Impact of AI agents on software engineering",
    recipientEmail: "you@example.com",
    slackChannel: "#research",
  }),
});

const body = JSON.parse(result.body);
if (body.success) {
  console.log("\n--- REPORT ---");
  console.log(body.deliverables.report.slice(0, 400));
  console.log("\n--- EMAIL SUBJECT ---");
  console.log(body.deliverables.email.subject);
  console.log("\n--- SLACK ---");
  console.log(body.deliverables.slack);
} else {
  console.error("Failed:", body.error);
}