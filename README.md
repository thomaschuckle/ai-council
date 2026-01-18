# The AI Council

A multi-agent AI system where 11 specialized AI agents govern a medieval fantasy kingdom of 50,000 citizens (if they remember woops). Each agent has distinct personality traits, expertise, and potentially conflicting interests, creating emergent collaborative (and sometimes contentious) decision-making.

## 🏰 Overview

The AI Council simulates a fantasy kingdom's governing body where autonomous AI agents debate, strategize, and make decisions in real-time. The system uses:

- **Solace Agent Mesh** for agent orchestration and communication
- **AWS DynamoDB** for persistent conversation storage
- **AWS Lambda + API Gateway** for WebSocket-based real-time updates
- **React + TypeScript** frontend for monitoring council discussions

## 👥 Council Members

1. **The Sovereign** - Ancient, impartial strategist who synthesizes all advice and makes final decisions
2. **Marshal of War** - Paranoid military tactician, always preparing for the worst
3. **Steward of the Realm** - Resource-obsessed administrator preventing famine and collapse
4. **Archmage of the Arcane** - Arrogant wizard pushing magical boundaries (sometimes recklessly)
5. **High Priest / Oracle** - Cryptic spiritual guide interpreting divine will
6. **Lord Justiciar** - Cold executor of law valuing order above all
7. **Master of Whispers** - Manipulative spymaster assuming everyone lies
8. **Diplomat of the Outer Realms** - Charismatic negotiator defusing conflicts
9. **Warden of the Wilds** - Detached guardian of nature and non-human interests
10. **Master of Works** - Infrastructure-obsessed engineer solving problems with stone and steel
11. **Night Regent** - Ancient vampire managing nocturnal economy and undead labor

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (ai-council/)             │
│              Real-time Council Discussion Monitor           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ WebSocket
                  ↓
┌─────────────────────────────────────────────────────────────┐
│           AWS API Gateway (WebSocket)                       │
│  ┌──────────┬──────────────┬─────────────┬─────────────┐    │
│  │ Connect  │ Disconnect   │ Subscribe   │ Message     │    │
│  │ Lambda   │ Lambda       │ Lambda      │ Processor   │    │
│  └──────────┴──────────────┴─────────────┴─────────────┘    │
└─────────────────┬───────────────────────────────┬───────────┘
                  │                               │
                  ↓                               ↓
┌─────────────────────────────────┐    ┌────────────────────────┐
│  DynamoDB: websocket-connections│    │ DynamoDB: conversations│
│  (Tracks active WebSocket conn) │    │ (Persistent messages)  │
└─────────────────────────────────┘    └──────────┬─────────────┘
                                                   │
                                                   │ DynamoDB Stream
                                                   ↓
                                        ┌──────────────────────┐
                                        │ Stream Processor     │
                                        │ (Broadcasts messages)│
                                        └──────────────────────┘
                  ↑
                  │
┌─────────────────────────────────────────────────────────────┐
│              Solace Agent Mesh (SAM)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Orchestrator Agent (Routes council member calls)     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 11 Council Member Agents (Each with personality &    │  │
│  │ DynamoDB read/write tools for conversation memory)   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ REST Gateway (HTTP API for triggering orchestrator)  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- Python 3.10.16+
- Node.js 18+
- AWS Account (for DynamoDB and Lambda deployment)
- Solace PubSub+ broker (or use dev mode)
- LLM API access (OpenAI, Anthropic, or compatible endpoint)

### Installation

#### 1. Backend Setup (Solace Agent Mesh)

```bash
Please visit https://github.com/SolaceLabs/solace-agent-mesh
```

#### 2. AWS Infrastructure

Deploy the DynamoDB tables and Lambda functions:

```bash
# Create DynamoDB tables
aws dynamodb create-table \
  --table-name conversations \
  --attribute-definitions \
      AttributeName=id,AttributeType=S \
      AttributeName=conversation_id,AttributeType=S \
      AttributeName=timestamp,AttributeType=S \
  --key-schema \
      AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
      IndexName=conversation-index,Keys=[{AttributeName=conversation_id,KeyType=HASH},{AttributeName=timestamp,KeyType=RANGE}],Projection={ProjectionType=ALL} \
  --billing-mode PAY_PER_REQUEST \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_IMAGE

aws dynamodb create-table \
  --table-name websocket-connections \
  --attribute-definitions \
      AttributeName=connection_id,AttributeType=S \
      AttributeName=conversation_id,AttributeType=S \
  --key-schema \
      AttributeName=connection_id,KeyType=HASH \
  --global-secondary-indexes \
      IndexName=conversation-index,Keys=[{AttributeName=conversation_id,KeyType=HASH}],Projection={ProjectionType=ALL} \
  --billing-mode PAY_PER_REQUEST

# Deploy Lambda functions (see lambdas/ directory)
# Remember to attach appropriate policies to each functions + a dynamodb trigger (for agent-stream-processor.py)
# - agent-ws-connect.py
# - agent-ws-disconnect.py
# - agent-ws-subscribe.py (handles subscribe action)
# - agent-stream-processor.py (processes DynamoDB stream)

# Create API Gateway WebSocket API and connect Lambda triggers
```

#### 3. Frontend Setup

```bash
cd ai-council

# Install dependencies
npm install

# Configure WebSocket endpoint
# Edit src/components/agent-monitor-ui.tsx
# Update websocketUrl and orchestratorUrl in the config

# Start development server
npm run dev
```

#### 4. Start Agents

```bash
Please visit https://github.com/SolaceLabs/solace-agent-mesh
```

## 📖 Usage

### Starting a Council Session

1. **Open the frontend**: Navigate to `http://localhost:5173` (or your configured port)
2. **Select a date**: Each day generates a unique conversation ID
3. **Send a world event**: Type a crisis or situation (e.g., "A dragon has been spotted near the northern villages")
4. **Watch the council debate**: Agents will autonomously discuss and respond
5. **Manual mode**: Click "⏸️ Halt" to pause auto-responses and manually guide the conversation

### Auto vs Manual Mode

- **Auto Mode (▶️)**: Council members autonomously continue the discussion based on the latest message
- **Halt Mode (⏸️)**: Requires manual input to progress (useful for testing or guided scenarios)

### Divine Intervention

Override the autonomous flow by typing in the "Divine Intervention" box:
- Leave blank: Council continues autonomously
- Type event: Immediately sends your input to the orchestrator

## ⚙️ Configuration

### Agent Personalities

Each agent's personality, instructions, and tools are defined in `configs/agents/*.yaml`:

Example:
```yaml
instruction: |
  BE AS HUMAN AS POSSIBLE (use first person, emotions, natural language)
  
  YOUR PERSONALITY:
  You are paranoid and assume peace is merely war that hasn't started yet.
  You plan obsessively for invasions, rebellions, and betrayal.
  
  You:
  - Evaluate threats assuming hostile intent
  - Determine military readiness
  - Identify potential rebellions
```

### Conversation Persistence

- **Daily Conversation IDs**: Generated from date hash (YYYY-MM-DD)
- **Message Storage**: DynamoDB `conversations` table
- **WebSocket Broadcasting**: Real-time updates via Lambda stream processor

## 🔧 Development

### Project Structure

```
.
├── ai-council/                 # React frontend
│   ├── src/
│   │   └── components/
│   │       └── agent-monitor-ui.tsx
│   └── package.json
├── configs/
│   ├── agents/                # Agent configurations
│   ├── gateways/              # REST/WebSocket gateways
│   └── shared_config.yaml     # Common config
├── src/agents/                # Agent tool implementations
│   ├── sovereign/
│   ├── marshal/
│   └── ...
├── lambdas/                   # AWS Lambda functions
│   ├── agent-ws-connect.py
│   ├── agent-ws-disconnect.py
│   ├── agent-ws-subscribe.py
│   └── agent-stream-processor.py
└── requirements.txt
```

### Adding New Agents

1. Create config: `sam add agent --gui`
2. Create tools: `src/agents/new_agent/tools.py`

## 🐛 Troubleshooting

### Agents not responding

- Check agent logs for errors
- Verify Solace broker connection
- Ensure DynamoDB credentials are correct
- Check LLM API rate limits

### WebSocket not connecting

- Verify API Gateway WebSocket URL
- Check Lambda function logs
- Ensure DynamoDB tables exist with correct indexes

## 🙏 Acknowledgments

Built with [Solace Agent Mesh](https://github.com/SolaceLabs/solace-agent-mesh) - A framework for building multi-agent AI systems with event-driven architectures.

---

**Warning**: This is an experimental AI system. Agents may produce unexpected, contradictory, or entertaining results. The council's decisions should not be used for actual governance (They are stupid). 🏰✨