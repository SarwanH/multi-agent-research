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
     │
     ├── OrchestratorAgent  (claude-sonnet-4-5)
     ├── ResearchAgent      (claude-sonnet-4-5 + web_search tool)
     └── WriterAgent        (claude-sonnet-4-5 + Gmail API + Slack API)

DynamoDB — stores run state
CloudWatch — logs every agent step
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

### 3. Set up Gmail

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → enable **Gmail API**
3. Go to **Credentials → Create Credentials → OAuth 2.0 Client ID** → Desktop app → download as `credentials.json`
4. Add yourself as a test user under **OAuth consent screen → Test users**
5. Run the auth flow once to get your refresh token:

```bash
node get-gmail-token.js
```

Follow the prompts — open the URL in your browser, authorize, paste the full redirect URL back into the terminal. It prints your three credentials:

```
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
```

Add all three to your `.env` file.

### 4. Set up Slack

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create New App → From scratch
3. OAuth & Permissions → Bot Token Scopes → add `chat:write`
4. Install to Workspace → copy the `xoxb-...` token into `.env`
5. Invite the bot to your channel in Slack: `/invite @your-app-name`

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

### Add Gmail credentials to Lambda

After deploying, add your Gmail credentials as Lambda environment variables:

```bash
aws lambda update-function-configuration \
  --function-name multi-agent-research \
  --environment "Variables={ANTHROPIC_API_KEY=your-key,SLACK_BOT_TOKEN=your-token,DYNAMODB_TABLE=multi-agent-research-state,GMAIL_CLIENT_ID=your-client-id,GMAIL_CLIENT_SECRET=your-secret,GMAIL_REFRESH_TOKEN=your-refresh-token}"
```

### Invoke the pipeline

Via AWS CLI (recommended — bypasses API Gateway timeout):

```bash
aws lambda invoke \
  --function-name multi-agent-research \
  --payload '{"httpMethod":"POST","body":"{\"topic\":\"Your topic\",\"recipientEmail\":\"you@example.com\",\"slackChannel\":\"#your-channel\"}"}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

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
| `GMAIL_REFRESH_TOKEN` | For Gmail | OAuth refresh token from auth flow |

## Security notes

- Never commit `.env`, `credentials.json`, or `gmail-token.json` — all are in `.gitignore`
- Gmail OAuth creates **drafts only** — nothing is sent without your review
- Gmail credentials are stored as Lambda environment variables in production — never hardcoded
- Rotate your `GMAIL_REFRESH_TOKEN` if it stops working — tokens expire after 7 days of inactivity

## License

MIT
