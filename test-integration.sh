#!/bin/bash
SERVER_URL="http://localhost:3000/api/v1/orders"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'
RANDOM_VAL=$((1 + $RANDOM % 9999))
ORDER_ID="v${RANDOM_VAL}vdb-01"
echo -e "${BLUE}------------------------------------------------------------${NC}"
echo -e "🚀 ${YELLOW}BIPFLOW ENGINE | PRO-SERVICE VALIDATION${NC}"
echo -e "${BLUE}------------------------------------------------------------${NC}"
echo -n "🔍 [1/3] Verificando conectividade com a API... "
if ! curl -s --head "$SERVER_URL" > /dev/null; then
    echo -e "${RED}FAILED${NC}"
    echo -e "❌ ${RED}ERROR:${NC} Servidor offline"
    exit 1
fi
echo -e "${GREEN}ONLINE${NC}"
echo -e "📦 [2/3] Preparando payload ID: ${BLUE}$ORDER_ID${NC}"
PAYLOAD=$(cat <<EOP
{
  "numeroPedido": "$ORDER_ID",
  "valorTotal": "285.90",
  "dataCriacao": "$TIMESTAMP",
  "items": [
    { "idItem": "SKU-990", "quantidadeItem": 2, "valorItem": 100.00 },
    { "idItem": "SKU-442", "quantidadeItem": 1, "valorItem": 85.90 }
  ]
}
EOP
)
echo -n "🚀 [3/3] Executando integração... "
RESPONSE=$(curl -s -X POST "$SERVER_URL" -H "Content-Type: application/json" -d "$PAYLOAD")
if [[ $RESPONSE == *"Success"* ]]; then
    echo -e "${GREEN}SUCCESS${NC}"
    echo -e "📥 ${GREEN}SERVER RESPONSE:${NC}"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
    echo -e "${RED}REJECTED${NC}"
    echo "$RESPONSE"
fi
echo -e "${BLUE}v1.0.2 | Professional Services Assessment${NC}"
