import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export class OrchestratorAgent {
  async plan(topic) {
    const res = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: `Output a JSON plan with:
- "research_queries": 3 specific search queries
- "report_angle": one sentence focus
- "audience": who this is for
- "sections": 3-4 report headings
Respond ONLY with valid JSON. No markdown.`,
      messages: [{ role: "user", content: `Topic: ${topic}` }],
    });
    const raw = res.content
      .filter(b => b.type === "text")
      .map(b => b.text).join("");
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  }
}