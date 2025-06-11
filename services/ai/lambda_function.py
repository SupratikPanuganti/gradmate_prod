
import json

def lambda_handler(event, context):
    # Add CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',  # Allow requests from any origin
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Content-Type': 'application/json'
    }

    # Handle OPTIONS request for CORS preflight
    if event['httpMethod'] == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({})
        }

    try:
        # Verify API key
        api_key = event.get('headers', {}).get('x-api-key')
        expected_api_key = 'hbTJHKmAzW31KclNxEbAOaIMopgsitk73CM0iZYY'
        
        if not api_key or api_key != expected_api_key:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({
                    'status': 'error',
                    'message': 'Invalid API key'
                })
            }

        # Simple Hello World response
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'message': 'Hello from GradMate AI Service! 👋',
                'timestamp': context.get_remaining_time_in_millis()
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'status': 'error',
                'message': str(e)
            })
        } 