import json
import boto3
import os

def deserialize_dynamodb_item(item):
    """Convert DynamoDB stream format to normal dict"""
    result = {}
    for key, value in item.items():
        if 'S' in value:
            result[key] = value['S']
        elif 'N' in value:
            result[key] = value['N']
        elif 'BOOL' in value:
            result[key] = value['BOOL']
        elif 'M' in value:
            result[key] = deserialize_dynamodb_item(value['M'])
        elif 'L' in value:
            result[key] = [deserialize_dynamodb_item({'item': v})['item'] for v in value['L']]
        elif 'NULL' in value:
            result[key] = None
    return result

dynamodb = boto3.resource('dynamodb')
connections_table = dynamodb.Table('websocket-connections')

# This will be set via environment variables
WEBSOCKET_ENDPOINT = os.environ.get('WEBSOCKET_ENDPOINT')

apigateway = boto3.client('apigatewaymanagementapi', endpoint_url=WEBSOCKET_ENDPOINT)

def lambda_handler(event, context):
    print(f"Processing {len(event['Records'])} stream records")
    
    for record in event['Records']:
        # Only process new messages (INSERT events)
        if record['eventName'] != 'INSERT':
            print(f"Skipping {record['eventName']} event")
            continue
        
        # Extract the new message
        dynamodb_item = record['dynamodb']['NewImage']
        message = deserialize_dynamodb_item(dynamodb_item)
        
        conversation_id = message.get('conversation_id')
        print(f"New message in conversation: {conversation_id}")
        
        if not conversation_id:
            print("No conversation_id in message, skipping")
            continue
        
        try:
            # Get all connections subscribed to this conversation
            response = connections_table.query(
                IndexName='conversation-index',
                KeyConditionExpression='conversation_id = :cid',
                ExpressionAttributeValues={':cid': conversation_id}
            )
            
            connections = response.get('Items', [])
            print(f"Broadcasting to {len(connections)} connections")
            
            # Broadcast to all connected clients
            dead_connections = []
            
            for conn in connections:
                connection_id = conn['connection_id']
                
                try:
                    apigateway.post_to_connection(
                        ConnectionId=connection_id,
                        Data=json.dumps(message, default=str)
                    )
                    print(f"✓ Sent to connection {connection_id}")
                    
                except apigateway.exceptions.GoneException:
                    print(f"✗ Connection {connection_id} is gone")
                    dead_connections.append(connection_id)
                    
                except Exception as e:
                    print(f"✗ Error sending to {connection_id}: {e}")
            
            # Clean up dead connections
            for connection_id in dead_connections:
                try:
                    connections_table.delete_item(
                        Key={'connection_id': connection_id}
                    )
                    print(f"Removed dead connection {connection_id}")
                except Exception as e:
                    print(f"Error removing connection {connection_id}: {e}")
                    
        except Exception as e:
            print(f"Error processing message: {e}")
            import traceback
            traceback.print_exc()
    
    return {'statusCode': 200}