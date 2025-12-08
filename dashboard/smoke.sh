#!/bin/bash
# ============================================
# Smoke Tests - Verify Critical Endpoints
# ============================================

set -e

API_URL="${API_URL:-http://localhost:5000/api}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

echo "🧪 Running smoke tests..."
echo "API URL: $API_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

test_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local expected_code="$4"
  local data="$5"
  
  echo -n "Testing: $name ... "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$API_URL$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$API_URL$endpoint")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "$expected_code" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (Expected $expected_code, got $http_code)"
    echo "Response: $body"
    ((TESTS_FAILED++))
    return 1
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Health & Core Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "Health check" "GET" "/health" "200"
test_endpoint "Root endpoint" "GET" "/" "200"

echo ""
echo "2️⃣  Authentication Flow"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Register a test user
TIMESTAMP=$(date +%s)
TEST_EMAIL="smoketest-${TIMESTAMP}@example.com"
TEST_PASSWORD="TestPass123!"
TEST_NAME="Smoke Test User"

REGISTER_DATA="{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"fullName\":\"$TEST_NAME\"}"

echo -n "Testing: User registration ... "
REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$REGISTER_DATA" "$API_URL/auth/register")
REGISTER_CODE=$(echo "$REGISTER_RESPONSE" | tail -n1)
REGISTER_BODY=$(echo "$REGISTER_RESPONSE" | sed '$d')

if [ "$REGISTER_CODE" = "201" ]; then
  echo -e "${GREEN}✓ PASS${NC} (HTTP $REGISTER_CODE)"
  ACCESS_TOKEN=$(echo "$REGISTER_BODY" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} (Expected 201, got $REGISTER_CODE)"
  echo "Response: $REGISTER_BODY"
  ((TESTS_FAILED++))
  exit 1
fi

# Test login
LOGIN_DATA="{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
test_endpoint "User login" "POST" "/auth/login" "200" "$LOGIN_DATA"

# Test protected endpoint
echo -n "Testing: Protected endpoint (GET /auth/me) ... "
ME_RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$API_URL/auth/me")
ME_CODE=$(echo "$ME_RESPONSE" | tail -n1)

if [ "$ME_CODE" = "200" ]; then
  echo -e "${GREEN}✓ PASS${NC} (HTTP $ME_CODE)"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} (Expected 200, got $ME_CODE)"
  ((TESTS_FAILED++))
fi

echo ""
echo "3️⃣  Tenant & Survey Management"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create tenant
TENANT_DATA="{\"name\":\"Smoke Test Tenant\",\"slug\":\"smoke-${TIMESTAMP}\",\"email\":\"tenant@example.com\"}"
echo -n "Testing: Create tenant ... "
TENANT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "$TENANT_DATA" "$API_URL/tenants")
TENANT_CODE=$(echo "$TENANT_RESPONSE" | tail -n1)
TENANT_BODY=$(echo "$TENANT_RESPONSE" | sed '$d')

if [ "$TENANT_CODE" = "201" ]; then
  echo -e "${GREEN}✓ PASS${NC} (HTTP $TENANT_CODE)"
  TENANT_ID=$(echo "$TENANT_BODY" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} (Expected 201, got $TENANT_CODE)"
  echo "Response: $TENANT_BODY"
  ((TESTS_FAILED++))
  TENANT_ID=""
fi

# Create API key for tenant
if [ -n "$TENANT_ID" ]; then
  API_KEY_DATA="{\"name\":\"Smoke Test Key\"}"
  echo -n "Testing: Create API key ... "
  KEY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "$API_KEY_DATA" "$API_URL/tenants/$TENANT_ID/keys")
  KEY_CODE=$(echo "$KEY_RESPONSE" | tail -n1)
  
  if [ "$KEY_CODE" = "201" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $KEY_CODE)"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC} (Expected 201, got $KEY_CODE)"
    ((TESTS_FAILED++))
  fi
fi

# Create organization (required for surveys)
ORG_DATA="{\"name\":\"Smoke Test Org\",\"slug\":\"smoke-org-${TIMESTAMP}\"}"
echo -n "Testing: Create organization ... "
ORG_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "$ORG_DATA" "$API_URL/organizations")
ORG_CODE=$(echo "$ORG_RESPONSE" | tail -n1)
ORG_BODY=$(echo "$ORG_RESPONSE" | sed '$d')

if [ "$ORG_CODE" = "201" ]; then
  echo -e "${GREEN}✓ PASS${NC} (HTTP $ORG_CODE)"
  ORG_ID=$(echo "$ORG_BODY" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} (Expected 201, got $ORG_CODE)"
  echo "Response: $ORG_BODY"
  ((TESTS_FAILED++))
  ORG_ID=""
fi

# Create survey
if [ -n "$TENANT_ID" ]; then
  SURVEY_DATA="{\"tenantId\":\"$TENANT_ID\",\"organizationId\":\"$ORG_ID\",\"title\":\"Smoke Test Survey\",\"description\":\"Test survey\",\"surveyType\":\"poll\"}"
  echo -n "Testing: Create survey ... "
  SURVEY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "$SURVEY_DATA" "$API_URL/surveys")
  SURVEY_CODE=$(echo "$SURVEY_RESPONSE" | tail -n1)
  SURVEY_BODY=$(echo "$SURVEY_RESPONSE" | sed '$d')
  
  if [ "$SURVEY_CODE" = "201" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $SURVEY_CODE)"
    SURVEY_ID=$(echo "$SURVEY_BODY" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    SURVEY_KEY=$(echo "$SURVEY_BODY" | grep -o '"survey_key":"[^"]*' | head -1 | cut -d'"' -f4)
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC} (Expected 201, got $SURVEY_CODE)"
    echo "Response: $SURVEY_BODY"
    ((TESTS_FAILED++))
    SURVEY_ID=""
  fi
fi

echo ""
echo "4️⃣  Question Management"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$ORG_ID" ]; then
  QUESTION_DATA="{\"organizationId\":\"$ORG_ID\",\"questionText\":\"What is your favorite color?\",\"questionType\":\"multiple_choice\",\"options\":[\"Red\",\"Blue\",\"Green\"],\"isActive\":true}"
  echo -n "Testing: Create question ... "
  QUESTION_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "$QUESTION_DATA" "$API_URL/questions")
  QUESTION_CODE=$(echo "$QUESTION_RESPONSE" | tail -n1)
  QUESTION_BODY=$(echo "$QUESTION_RESPONSE" | sed '$d')
  
  if [ "$QUESTION_CODE" = "201" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $QUESTION_CODE)"
    QUESTION_ID=$(echo "$QUESTION_BODY" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC} (Expected 201, got $QUESTION_CODE)"
    echo "Response: $QUESTION_BODY"
    ((TESTS_FAILED++))
    QUESTION_ID=""
  fi
  
  # List questions
  if [ -n "$QUESTION_ID" ]; then
    echo -n "Testing: List questions ... "
    LIST_RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$API_URL/questions")
    LIST_CODE=$(echo "$LIST_RESPONSE" | tail -n1)
    
    if [ "$LIST_CODE" = "200" ]; then
      echo -e "${GREEN}✓ PASS${NC} (HTTP $LIST_CODE)"
      ((TESTS_PASSED++))
    else
      echo -e "${RED}✗ FAIL${NC} (Expected 200, got $LIST_CODE)"
      ((TESTS_FAILED++))
    fi
  fi
fi

echo ""
echo "5️⃣  Micro-Survey Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test Micro-Survey mock health
echo -n "Testing: Micro-Survey mock health ... "
MS_HEALTH=$(curl -s -w "\n%{http_code}" "http://localhost:4000/health" 2>/dev/null || echo "000")
MS_CODE=$(echo "$MS_HEALTH" | tail -n1)

if [ "$MS_CODE" = "200" ]; then
  echo -e "${GREEN}✓ PASS${NC} (HTTP $MS_CODE)"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} (Expected 200, got $MS_CODE)"
  echo "Note: Micro-Survey mock may not be running"
  ((TESTS_FAILED++))
fi

# Submit response to survey (if survey exists)
if [ -n "$SURVEY_KEY" ]; then
  RESPONSE_DATA="{\"answers\":[{\"questionId\":\"q1\",\"answer\":\"Blue\"}]}"
  echo -n "Testing: Submit survey response ... "
  RESPONSE_RESULT=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$RESPONSE_DATA" "http://localhost:4000/v1/surveys/$SURVEY_KEY/responses" 2>/dev/null || echo "000")
  RESPONSE_CODE=$(echo "$RESPONSE_RESULT" | tail -n1)
  
  if [ "$RESPONSE_CODE" = "201" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $RESPONSE_CODE)"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC} (Expected 201, got $RESPONSE_CODE)"
    ((TESTS_FAILED++))
  fi
fi

echo ""
echo "6️⃣  Frontend Health (Optional)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "Testing: Frontend availability ... "
FRONTEND_RESPONSE=$(curl -s -w "\n%{http_code}" "$FRONTEND_URL" 2>/dev/null || echo "000")
FRONTEND_CODE=$(echo "$FRONTEND_RESPONSE" | tail -n1)

if [ "$FRONTEND_CODE" = "200" ]; then
  echo -e "${GREEN}✓ PASS${NC} (HTTP $FRONTEND_CODE)"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} (Expected 200, got $FRONTEND_CODE)"
  echo "Note: Frontend may not be running"
  ((TESTS_FAILED++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SMOKE TEST RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total:  $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All smoke tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Check logs above.${NC}"
  exit 1
fi
