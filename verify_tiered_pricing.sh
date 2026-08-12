#!/bin/bash
BASE_URL="http://localhost:3000/api"
COMPANY="company_default"
PROD_ID="prod_rice"
TOKEN_ADMIN="Bearer test-admin-token"
TOKEN_CASHIER="Bearer test-cashier-token"

# TEST 1: Retail (Admin)
RES1=$(curl -s -X POST "$BASE_URL/sales" -H "Content-Type: application/json" -H "Authorization: $TOKEN_ADMIN" -d "{
  \"companyId\": \"$COMPANY\",
  \"customerId\": \"cust_cash\",
  \"items\": [{\"productId\": \"$PROD_ID\", \"productName\": \"Rice\", \"quantity\": 1, \"price\": 0}]
}")
SALE_ID1=$(echo $RES1 | grep -oP '"id":"\K[^"]+')
echo "SALE1: $SALE_ID1"

# TEST 2: Wholesale (Admin)
RES2=$(curl -s -X POST "$BASE_URL/sales" -H "Content-Type: application/json" -H "Authorization: $TOKEN_ADMIN" -d "{
  \"companyId\": \"$COMPANY\",
  \"customerId\": \"cust_test_wholesale\",
  \"items\": [{\"productId\": \"$PROD_ID\", \"productName\": \"Rice\", \"quantity\": 1, \"price\": 0}]
}")
SALE_ID2=$(echo $RES2 | grep -oP '"id":"\K[^"]+')
echo "SALE2: $SALE_ID2"

# TEST 4: Price Manipulation (Cashier attempt)
# Cashier tries to set price to 50, but server should enforce 100
RES4=$(curl -s -X POST "$BASE_URL/sales" -H "Content-Type: application/json" -H "Authorization: $TOKEN_CASHIER" -d "{
  \"companyId\": \"$COMPANY\",
  \"customerId\": \"cust_cash\",
  \"items\": [{\"productId\": \"$PROD_ID\", \"productName\": \"Rice\", \"quantity\": 1, \"price\": 50}]
}")
SALE_ID4=$(echo $RES4 | grep -oP '"id":"\K[^"]+')
echo "SALE4: $SALE_ID4"

# TEST 5: Price Override (Admin allowed)
# Admin sets price to 50, server should honor it
RES5=$(curl -s -X POST "$BASE_URL/sales" -H "Content-Type: application/json" -H "Authorization: $TOKEN_ADMIN" -d "{
  \"companyId\": \"$COMPANY\",
  \"customerId\": \"cust_cash\",
  \"items\": [{\"productId\": \"$PROD_ID\", \"productName\": \"Rice\", \"quantity\": 1, \"price\": 50}]
}")
SALE_ID5=$(echo $RES5 | grep -oP '"id":"\K[^"]+')
echo "SALE5: $SALE_ID5"
