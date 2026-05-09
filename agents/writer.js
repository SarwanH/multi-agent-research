import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export class WriterAgent {
  async write(topic, plan, brief) {
    const res = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: `Produce a JSON object with:
- "report": 300-word report with ## section headers
- "email": { "subject": "...", "body": "~150 words, professional" }
- "slack": 3-bullet post starting with *, ~80 words
No markdown fences around the JSON.`,
      messages: [{
        role: "user",
        content: `Topic: ${topic}\nAudience: ${plan.audience}\n\n${brief}`
      }],
    });
    const raw = res.content
      .filter(b => b.type === "text")
      .map(b => b.text).join("");
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  }

  async dispatch(deliverables, { recipientEmail, slackChannel }) {
    const results = { email: false, slack: false };

    if (recipientEmail) {
      try {
        await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 256,
          mcp_servers: [{
            type: "url",
            url: "https://gmailmcp.googleapis.com/mcp/v1",
            name: "gmail-mcp"
          }],
          system: "Use Gmail MCP to create an email draft. Confirm when done.",
          messages: [{ role: "user", content:

            `Draft to ${recipientEmail}\nSubject: ${deliverables.email.subject}\n${deliverables.email.body}`
          }],
        });
        results.email = true;
      } catch (e) { console.warn("Gmail MCP:", e.message); }
    }

    if (slackChannel) {
      try {
        await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 256,
          mcp_servers: [{
            type: "url",
            url: "https://mcp.slack.com/mcp",
            name: "slack-mcp"
          }],
          system: "Post to Slack using the MCP. Confirm when done.",
          messages: [{ role: "user", content:
            `Post to ${slackChannel}:\n${deliverables.slack}`
          }],
        });
        results.slack = true;
      } catch (e) { console.warn("Slack MCP:", e.message); }
    }

    return results;
  }
}