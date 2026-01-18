# src/agents/highpriest/tools.py

import boto3
from botocore.exceptions import ClientError
from datetime import datetime, timezone
from typing import List, Dict

AGENT_NAME = "HighPriest"
TABLE_NAME = "conversations"
REGION_NAME = "ca-central-1"

dynamodb = boto3.resource("dynamodb", region_name=REGION_NAME)
table = dynamodb.Table(TABLE_NAME)

from typing import Optional, Dict

import hashlib

def generate_message_id(content: str, timestamp: str, agent_name: str) -> str:
    """Generate deterministic message ID from content, timestamp, and agent name."""
    hash_input = f"{content}{timestamp}{agent_name}"
    return hashlib.sha256(hash_input.encode()).hexdigest()[:16]

def generate_conversation_id() -> str:
    """Generate conversation ID based on today's date."""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    return hashlib.sha256(today.encode()).hexdigest()[:16]

def dynamodbWrite(content: str, metadata: Optional[dict] = None) -> Dict:
    if metadata is None:
        metadata = {}
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # Generate IDs
    message_id = generate_message_id(content, timestamp, AGENT_NAME)
    conversation_id = generate_conversation_id()
    
    item = {
        "id": message_id,
        "conversation_id": conversation_id,
        "agent_name": AGENT_NAME,
        "timestamp": timestamp,
        "role": "assistant",
        "content": content,
        "metadata": metadata
    }
    
    try:
        table.put_item(Item=item)
        return {"success": True, "timestamp": timestamp, "id": message_id, "conversation_id": conversation_id}
    except ClientError as e:
        return {"error": str(e)}

def dynamodbRead(limit: int = 11) -> List[Dict]:
    """Reviews last council messages to provide divine insight."""
    try:
        response = table.scan()
        items = response.get("Items", [])
        items.sort(key=lambda x: x["timestamp"])
        return items[-limit:]
    except ClientError as e:
        return [{"error": str(e)}]
