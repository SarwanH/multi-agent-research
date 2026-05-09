import Anthropic from "@anthropic-ai/sdk";
import { WebClient } from "@slack/web-api";
import { google } from "googleapis";
import { existsSync, readFileSync } from "fs";

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

    // --- Slack ---
    if (process.env.SLACK_BOT_TOKEN) {
      try {
        console.log(`[Writer] Posting to Slack ${slackChannel || "#research"}...`);
        const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
        await slack.chat.postMessage({
          channel: slackChannel || "#research",
          text: deliverables.slack,
        });
        results.slack = true;
        console.log("[Writer] Slack message sent");
      } catch (e) {
        console.warn("[Writer] Slack error:", e.message);
      }
    } else {
      console.log("[Writer] No SLACK_BOT_TOKEN — skipping Slack");
    }

    // --- Gmail ---
    if (recipientEmail) {
      try {
        console.log(`[Writer] Creating Gmail draft to ${recipientEmail}...`);

        // Use env vars on Lambda, fall back to local files for local testing
        let clientId, clientSecret, credentials;

        if (process.env.GMAIL_CLIENT_ID) {
          clientId     = process.env.GMAIL_CLIENT_ID;
          clientSecret = process.env.GMAIL_CLIENT_SECRET;
          credentials  = { refresh_token: process.env.GMAIL_REFRESH_TOKEN };
        } else if (existsSync("./credentials.json")) {
          const creds  = JSON.parse(readFileSync("./credentials.json"));
          clientId     = creds.installed.client_id;
          clientSecret = creds.installed.client_secret;
          credentials  = JSON.parse(readFileSync("./gmail-token.json"));
        } else {
          console.log("[Writer] No Gmail credentials — skipping");
          return results;
        }

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials(credentials);

        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        const message = [
          `To: ${recipientEmail}`,
          `Subject: ${deliverables.email?.subject}`,
          `Content-Type: text/plain; charset=utf-8`,
          ``,
          `${deliverables.email?.body}`,
        ].join("\n");

        const encoded = Buffer.from(message)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        await gmail.users.drafts.create({
          userId: "me",
          requestBody: { message: { raw: encoded } },
        });

        results.email = true;
        console.log("[Writer] Gmail draft created");
      } catch (e) {
        console.warn("[Writer] Gmail error:", e.message);
      }
    } else {
      console.log("[Writer] No recipientEmail — skipping Gmail");
    }

    return results;
  }
}