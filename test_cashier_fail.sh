#!/bin/bash
BASE_URL="http://localhost:3000/api"
COMPANY="company_default"
PROD_ID="prod_rice"
TOKEN_CASHIER="Bearer test-cashier-token"

RES4=$(curl -s -i -X POST "$BASE_URL/sales" -H "Content-Type: application/json" -H "Authorization: $TOKEN_CASHIER" -d "{
  \"companyId\": \"$COMPANY\",
  \"customerId\": \"cust_cash\",
  \"items\": [{\"productId\": \"$PROD_ID\", \"productName\": \"Rice\", \"quantity\": 1, \"price\": 50}]
}")
echo "RES4 RESPONSE:"
echo "$RES4"
