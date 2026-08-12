#!/bin/bash
BASE_URL="http://localhost:3000/api"
COMPANY="company_default"
PROD_ID="prod_rice"

echo "TEST | EXPECTED | ACTUAL | RESULT"
echo "--- | --- | --- | ---"

# TEST 1: Retail
RES1=$(curl -s -X POST "$BASE_URL/sales" -H "Content-Type: application/json" -d "{
  \"companyId\": \"$COMPANY\",
  \"customerId\": \"cust_cash\",
  \"items\": [{\"productId\": \"$PROD_ID\", \"quantity\": 1}]
}")
PRICE1=$(echo $RES1 | grep -oP '"price":\s*"?\K[0-9.]+' | head -n 1)
[ "$PRICE1" == "100" ] && R1="✅ PASS" || R1="❌ FAIL ($PRICE1)"
echo "TEST 1: Retail sale | 100 | $PRICE1 | $R1"

# TEST 2: Wholesale
RES2=$(curl -s -X POST "$BASE_URL/sales" -H "Content-Type: application/json" -d "{
  \"companyId\": \"$COMPANY\",
  \"customerId\": \"cust_test_wholesale\",
  \"items\": [{\"productId\": \"$PROD_ID\", \"quantity\": 1}]
}")
PRICE2=$(echo $RES2 | grep -oP '"price":\s*"?\K[0-9.]+' | head -n 1)
[ "$PRICE2" == "90" ] && R2="✅ PASS" || R2="❌ FAIL ($PRICE2)"
echo "TEST 2: Wholesale sale | 90 | $PRICE2 | $R2"

# TEST 3: Distributor
RES3=$(curl -s -X POST "$BASE_URL/sales" -H "Content-Type: application/json" -d "{
  \"companyId\": \"$COMPANY\",
  \"customerId\": \"cust_test_distributor\",
  \"items\": [{\"productId\": \"$PROD_ID\", \"quantity\": 1}]
}")
PRICE3=$(echo $RES3 | grep -oP '"price":\s*"?\K[0-9.]+' | head -n 1)
[ "$PRICE3" == "80" ] && R3="✅ PASS" || R3="❌ FAIL ($PRICE3)"
echo "TEST 3: Distributor sale | 80 | $PRICE3 | $R3"

# TEST 4: Manipulated Price
RES4=$(curl -s -X POST "$BASE_URL/sales" -H "Content-Type: application/json" -d "{
  \"companyId\": \"$COMPANY\",
  \"customerId\": \"cust_cash\",
  \"items\": [{\"productId\": \"$PROD_ID\", \"quantity\": 1, \"price\": 50}]
}")
PRICE4=$(echo $RES4 | grep -oP '"price":\s*"?\K[0-9.]+' | head -n 1)
[ "$PRICE4" == "100" ] && R4="✅ PASS" || R4="❌ FAIL ($PRICE4)"
echo "TEST 4: Price Manipulation | 100 | $PRICE4 | $R4"

# TEST 6: Tenant Isolation (Read)
# Attempt to read price from another company
RES6=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/debug/prices?companyId=company_b&productId=$PROD_ID")
[ "$RES6" == "403" ] || [ "$RES6" == "401" ] && R6="✅ PASS" || R6="❌ FAIL ($RES6)"
echo "TEST 6: Tenant Isolation Read | 403/401 | $RES6 | $R6"
