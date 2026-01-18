import json
import boto3
import os

dynamodb = boto3.resource('dynamodb')
connections_table = dynamodb.Table('websocket-connections')

def lambda_handler(event, context):
    connection_id = event['requestContext']['connectionId']
    
    print(f"Disconnecting: {connection_id}")
    
    try:
        # Remove connection
        connections_table.delete_item(
            Key={'connection_id': connection_id}
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Disconnected successfully'})
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }