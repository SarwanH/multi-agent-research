import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export class ResearchAgent {
  async research(topic, plan) {
    const res = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: `You are a research specialist. Use web_search to find
up-to-date information, then write a structured ~400-word brief.
Sections to cover: ${plan.sections.join(", ")}.`,
      messages: [{
        role: "user",
        content: `Topic: ${topic}
Angle: ${plan.report_angle}
Queries to use: ${plan.research_queries.join("; ")}`
      }],
    });
    const brief = res.content
      .filter(b => b.type === "text")
      .map(b => b.text).join("\n\n");
    return { brief, wordCount: brief.split(/\s+/).length };
  }
}