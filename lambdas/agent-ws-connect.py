import json
import boto3
import os
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
connections_table = dynamodb.Table('websocket-connections')

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    
    print(f"New connection: {connection_id}")
    
    try:
        # Store connection
        connections_table.put_item(
            Item={
                'connection_id': connection_id,
                'conversation_id': 'UNSUBSCRIBED',  # Not subscribed yet
                'connected_at': datetime.utcnow().isoformat()
            }
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Connected successfully'})
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }