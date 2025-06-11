# Create a ZIP file of the Lambda function
Compress-Archive -Path lambda_function.py -DestinationPath function.zip -Force

# Deploy to AWS Lambda
aws lambda update-function-code `
    --function-name gradmate-ai-service `
    --zip-file fileb://function.zip `
    --region us-east-2

# Clean up
Remove-Item function.zip 