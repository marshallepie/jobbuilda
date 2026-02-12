#!/bin/bash

# JobBuilda E2E Integration Test
# Tests the complete stack: Coordinator -> identity-mcp -> PostgreSQL/NATS

set -e

COORDINATOR_URL="${COORDINATOR_URL:-http://localhost:3000}"
TENANT_ID="00000000-0000-0000-0000-000000000001"
ADMIN_USER_ID="00000000-0000-0000-0000-000000000101"
CLIENT_USER_ID="00000000-0000-0000-0000-000000000103"

echo "========================================="
echo "JobBuilda E2E Integration Test"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run a test
run_test() {
  local test_name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  local expected_status=${5:-200}

  echo -n "Testing: $test_name ... "

  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -H "x-tenant-id: $TENANT_ID" \
      -H "x-user-id: $ADMIN_USER_ID" \
      -H "x-scopes: identity:issue_portal_token,identity:read_users" \
      -d "$data" \
      "$COORDINATOR_URL$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "x-tenant-id: $TENANT_ID" \
      -H "x-user-id: $ADMIN_USER_ID" \
      -H "x-scopes: identity:issue_portal_token,identity:read_users" \
      "$COORDINATOR_URL$endpoint")
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" -eq "$expected_status" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    echo "  Response: $body"
    echo ""
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "  Expected HTTP $expected_status, got $http_code"
    echo "  Response: $body"
    echo ""
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

echo "1. Health Check"
echo "---------------"
run_test "Health endpoint" "GET" "/health"

echo "2. Identity Resources"
echo "---------------------"
run_test "Get admin user" "GET" "/api/identity/users/$ADMIN_USER_ID"
run_test "Get tenant" "GET" "/api/identity/tenants/$TENANT_ID"

echo "3. Identity Tools"
echo "-----------------"
run_test "Issue portal token" "POST" "/api/identity/portal-tokens" \
  "{\"user_id\":\"$CLIENT_USER_ID\",\"purpose\":\"quote_view\",\"resource_id\":\"00000000-0000-0000-0000-000000000001\",\"ttl_minutes\":30}"

run_test "Check permission (has permission)" "POST" "/api/identity/check-permission" \
  "{\"user_id\":\"$ADMIN_USER_ID\",\"scope\":\"identity:issue_portal_token\"}"

run_test "Check permission (no permission)" "POST" "/api/identity/check-permission" \
  "{\"user_id\":\"$CLIENT_USER_ID\",\"scope\":\"identity:manage_users\"}"

echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. View traces in Grafana: http://localhost:3001"
  echo "  2. Check NATS events: docker logs jobbuilda-nats"
  echo "  3. Build more MCP servers following the identity-mcp pattern"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
