#!/bin/bash

# BipFlow Integration Test - Professional Version
# Works on Linux, Mac and Git Bash

SERVER_URL="http://localhost:3001/api/v1/orders"

echo "------------------------------------------------"
echo "🚀 BipFlow Integration Engine - CLI Validation"
echo "------------------------------------------------"

# Check if server is online before testing
if ! curl -s --head  --request GET http://localhost:3001/api/v1/orders | grep "404\|200" > /dev/null; then
    echo "❌ ERROR: Server is not running on $SERVER_URL"
    echo "💡 Run 'node index.js' first."
    exit 1
fi

# Define Payload
PAYLOAD='{
  "numeroPedido": "v10089015vdb-01",
  "valorTotal": "150.50",
  "dataCriacao": "2024-05-20T10:00:00Z",
  "items": [
    { "idItem": "101", "quantidadeItem": 2, "valorItem": 75.25 }
  ]
}'

echo "📦 Sending Payload..."

# Execute cURL and handle response
RESPONSE=$(curl -s -X POST "$SERVER_URL" \
     -H "Content-Type: application/json" \
     -d "$PAYLOAD")

echo "📥 Server Response:"
# Check if jq is installed for pretty print, otherwise print raw
if command -v jq &> /dev/null; then
    echo "$RESPONSE" | jq .
else
    echo "$RESPONSE"
fi

echo "------------------------------------------------"
echo "✅ Test Cycle Completed."