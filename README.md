# Multi-Agent Research Assistant

A production-ready AI pipeline that researches any topic and automatically delivers a report, Gmail draft, and Slack post — built with the Anthropic API, AWS Lambda, and real-world integrations.

## How it works

You send a topic. Three AI agents coordinate to handle it:

```
Your request
     │
     ▼
Orchestrator agent      → plans search queries, sections, audience
     │
     ▼
Research agent          → searches the web, extracts key facts
     │
     ▼
Writer agent            → writes report, email draft, Slack post
     │
     ├── Gmail API      → creates draft in your inbox
     └── Slack API      → posts to your channel
```

Each agent is a separate Claude call with a specific role and tools. The orchestrator plans, the researcher searches, the writer publishes — no single prompt does everything.

## Architecture

```
POST /research
     │
     ▼
API Gateway (HTTP API)
     │
     ▼
Lambda — handler.js
  ├── Returns 202 immediately (beats 29s API Gateway timeout)
  └── Self-invokes asynchronously to run full pipeline
           │
           ├── OrchestratorAgent  (claude-sonnet-4-5)
           ├── ResearchAgent      (claude-sonnet-4-5 + web_search tool)
           └── WriterAgent        (claude-sonnet-4-5 + Gmail + Slack)

DynamoDB — stores run state
CloudWatch — logs every agent step
```

## Project structure

```
multi-agent-research/
├── handler.js              # Lambda entry point, async self-invocation
├── agents/
│   ├── orchestrator.js     # Plans research queries and report structure
│   ├── research.js         # Web search and fact extraction
│   └── writer.js           # Synthesizes deliverables, dispatches via Gmail and Slack
├── infra/
│   └── main.tf             # Terraform: Lambda, API Gateway, DynamoDB, IAM
├── test/
│   └── local.js            # Run the full pipeline locally without AWS
├── .env.example            # Environment variable reference
└── package.json
└── package-lock.json
```

## Prerequisites

- Node.js 20+
- An Anthropic API key — [console.anthropic.com](https://console.anthropic.com)
- AWS CLI + Terraform (for cloud deploy only)
- A Slack workspace with a bot token
- A Google Cloud project with Gmail API enabled

## Setup

### 1. Clone and install

```bash
git clone https://github.com/SarwanH/multi-agent-research.git
cd multi-agent-research
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
GMAIL_CLIENT_ID=your-google-client-id
GMAIL_CLIENT_SECRET=your-google-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
```

### 3. Set up Gmail credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → enable **Gmail API**
3. Create **OAuth 2.0 credentials** (Desktop app) → download as `credentials.json`
4. Run the auth flow to get your refresh token:

```bash
node get-gmail-token.js
```

Follow the prompts — it saves your token to `gmail-token.json` automatically.

### 4. Set up Slack

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create New App → From scratch
3. OAuth & Permissions → Bot Token Scopes → add `chat:write`
4. Install to Workspace → copy the `xoxb-...` token
5. Invite the bot to your channel: `/invite @your-app-name`

### 5. Test locally

```bash
npm test
```

You should see:

```
[Orchestrator] Done
[Research] Done — 600 words
--- REPORT ---
...
[Writer] Slack message sent
[Writer] Gmail draft created
--- DISPATCH --- { email: true, slack: true }
```

## Deploy to AWS

### Bundle and deploy

```bash
npm run bundle
cd infra
terraform init
terraform apply \
  -var="anthropic_api_key=$ANTHROPIC_API_KEY" \
  -var="slack_bot_token=$SLACK_BOT_TOKEN"
```

Terraform outputs your live API URL:

```
api_url = "https://abc123.execute-api.us-east-1.amazonaws.com/prod/research"
```

### Call the API

```bash
curl -X POST https://<your-url>/research \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "AI agents in software engineering",
    "recipientEmail": "you@example.com",
    "slackChannel": "#research"
  }'
```

Returns `202 Accepted` immediately. Results appear in your Gmail drafts and Slack channel within 60–90 seconds.

### View logs

```bash
aws logs tail /aws/lambda/multi-agent-research --follow
```

## Agent details

| Agent | Model | Tools | Output |
|-------|-------|-------|--------|
| Orchestrator | claude-sonnet-4-5 | None | JSON plan: queries, sections, audience |
| Research | claude-sonnet-4-5 | web_search | ~600-word research brief |
| Writer | claude-sonnet-4-5 | Gmail API, Slack API | Report, email draft, Slack post |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `SLACK_BOT_TOKEN` | For Slack | Bot OAuth token (`xoxb-...`) |
| `GMAIL_CLIENT_ID` | For Gmail | Google OAuth client ID |
| `GMAIL_CLIENT_SECRET` | For Gmail | Google OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | For Gmail | OAuth refresh token |

## Security notes

- Never commit `.env`, `credentials.json`, or `gmail-token.json` — all are in `.gitignore`
- Gmail OAuth creates **drafts only** — nothing is sent without your review
- Store production secrets in AWS Secrets Manager or Lambda environment variables, not in code
