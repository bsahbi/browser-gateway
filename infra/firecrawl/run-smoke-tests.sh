#!/bin/bash
# Workplane Browser Gateway - P0 Smoke Tests
# Validates Firecrawl deployment with automated API tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="${API_URL:-http://localhost:3002}"
TIMEOUT=75

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

test_result() {
    if [ "$1" = "pass" ]; then
        log_success "✓ $2"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_error "✗ $2"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo ""
log_info "Running Firecrawl P0 Smoke Tests"
echo "API URL: $API_URL"
echo ""

# Test 1: Health endpoint
log_info "Test 1: API Health Endpoint"
if curl -sf "$API_URL/v0/health/readiness" > /dev/null 2>&1; then
    test_result "pass" "Health endpoint returns ok"
else
    test_result "fail" "Health endpoint failed"
fi

# Test 2: Simple crawl
log_info "Test 2: Simple Scrape (example.com)"
CRAWL_RESPONSE=$(curl -sf \
    --max-time $TIMEOUT \
    -X POST \
    "$API_URL/v2/crawl" \
    -H 'Content-Type: application/json' \
    -d '{
        "url": "https://example.com",
        "limit": 3,
        "scrapeOptions": {
            "formats": ["markdown", "html"]
        }
    }' 2>&1)

if echo "$CRAWL_RESPONSE" | grep -q '"success":true'; then
    test_result "pass" "Crawl job submitted successfully"
    # Extract job ID
    JOB_ID=$(echo "$CRAWL_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    log_info "Crawl job ID: $JOB_ID"
else
    log_error "Crawl response: $CRAWL_RESPONSE"
    test_result "fail" "Crawl job submission failed"
fi

# Test 3: Scrape with waitFor
log_info "Test 3: Scrape with JavaScript Render (example.com)"
SCRAPE_RESPONSE=$(curl -sf \
    --max-time $TIMEOUT \
    -X POST \
    "$API_URL/v2/scrape" \
    -H 'Content-Type: application/json' \
    -d '{
        "url": "https://example.com",
        "formats": ["markdown"],
        "waitFor": 2000
    }' 2>&1)

if echo "$SCRAPE_RESPONSE" | grep -q '"success":true'; then
    test_result "pass" "Scrape with JS render succeeded"
else
    log_error "Scrape response: $SCRAPE_RESPONSE"
    test_result "fail" "Scrape with JS render failed"
fi

# Test 4: Sitemap crawl
log_info "Test 4: Sitemap-based Crawl"
SITEMAP_RESPONSE=$(curl -sf \
    --max-time $TIMEOUT \
    -X POST \
    "$API_URL/v2/crawl" \
    -H 'Content-Type: application/json' \
    -d '{
        "url": "https://example.com/sitemap.xml",
        "limit": 5,
        "scrapeOptions": {
            "formats": ["markdown"]
        }
    }' 2>&1)

if echo "$SITEMAP_RESPONSE" | grep -q '"success":true'; then
    test_result "pass" "Sitemap crawl submitted successfully"
else
    log_error "Sitemap crawl response: $SITEMAP_RESPONSE"
    test_result "fail" "Sitemap crawl submission failed"
fi

# Test 5: Check for markdown content
log_info "Test 5: Markdown Content Validation"
if echo "$SCRAPE_RESPONSE" | grep -q '"markdown":"[^"]*example.com[^"]*"\|"markdown":\{\|"content":"[^"]*Example"; then
    test_result "pass" "Markdown content extracted"
else
    # Try alternative validation
    if echo "$SCRAPE_RESPONSE" | grep -q "Example"; then
        test_result "pass" "Content validated (alternative)"
    else
        test_result "fail" "Could not validate markdown content"
    fi
fi

# Test 6: API remains ready after queued requests
log_info "Test 6: API Readiness After Requests"
if curl -sf "$API_URL/v0/health/readiness" > /dev/null 2>&1; then
    test_result "pass" "API remains ready"
else
    test_result "fail" "API readiness failed after requests"
fi

# Summary
echo ""
echo "========================================"
log_info "Smoke Test Summary"
echo "========================================"
echo ""
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
    log_error "Some tests failed. Check logs with: ./operator.sh logs"
    exit 1
else
    log_success "All smoke tests passed!"
    echo ""
    log_info "Firecrawl P0 is ready for use."
    echo "  - API: $API_URL"
    echo "  - Documentation: Check $API_URL/docs for OpenAPI spec"
    exit 0
fi
