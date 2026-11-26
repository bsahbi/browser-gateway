#!/bin/bash
# Workplane Browser Gateway - P0 Operator Scripts
# Deployment, management, and troubleshooting utilities

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
COMPOSE_FILE="$PROJECT_DIR/compose.yaml"
ENV_FILE="$PROJECT_DIR/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed"
        exit 1
    fi
    
    log_success "Prerequisites met"
}

# Check if .env exists and has required values
validate_env() {
    log_info "Validating .env configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        log_error "$ENV_FILE not found. Copy .env.example and configure first."
        exit 1
    fi
    
    # Source the env file
    set -a
    source "$ENV_FILE"
    set +a
    
    # Check required values
    if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "CHANGE_ME_TO_SECURE_RANDOM_PASSWORD_32_CHARS" ]; then
        log_error "POSTGRES_PASSWORD not set or using default value. Edit $ENV_FILE with a secure password."
        exit 1
    fi
    
    if [ -z "$BULL_AUTH_KEY" ] || [ "$BULL_AUTH_KEY" = "change-this-to-a-secure-random-key-min-32-chars" ]; then
        log_error "BULL_AUTH_KEY not set or using default value. Edit $ENV_FILE with a secure key."
        exit 1
    fi
    
    if [ -z "$RABBITMQ_PASSWORD" ] || [ "$RABBITMQ_PASSWORD" = "CHANGE_ME_TO_SECURE_RANDOM_PASSWORD_32_CHARS" ]; then
        log_error "RABBITMQ_PASSWORD not set or using default value. Edit $ENV_FILE with a secure password."
        exit 1
    fi
    
    log_success "Environment validation passed"
}

# Deploy Firecrawl
deploy() {
    log_info "Deploying Firecrawl P0..."
    check_prerequisites
    validate_env
    
    log_info "Building and starting services..."
    docker compose -f "$COMPOSE_FILE" up --build -d
    
    log_info "Waiting for services to be ready..."
    if ! wait_for_services; then
        log_error "Services failed to become healthy"
        exit 1
    fi
    
    log_success "Deployment complete!"
    echo ""
    echo "Services are running:"
    echo "  - API: http://localhost:3002"
    echo "  - Health: http://localhost:3002/health/readiness"
    echo "  - Admin (if enabled): http://localhost:3002/admin/ops/queues"
    echo ""
    log_info "Next steps: Run './run-smoke-tests.sh' to verify deployment"
}

# Stop Firecrawl
stop() {
    log_info "Stopping Firecrawl services..."
    docker compose -f "$COMPOSE_FILE" stop
    
    log_success "Services stopped"
}

# Undeploy (remove volumes)
undeploy() {
    log_warn "This will stop and remove ALL containers and volumes!"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Aborted"
        exit 0
    fi
    
    log_info "Undeploying Firecrawl services..."
    docker compose -f "$COMPOSE_FILE" down -v
    
    log_success "Undeployed"
}

# View logs
logs() {
    log_info "Showing logs (tail -100)... Use --follow for live logs"
    if [ "$1" = "--follow" ] || [ "$1" = "-f" ]; then
        docker compose -f "$COMPOSE_FILE" logs -f
    else
        docker compose -f "$COMPOSE_FILE" logs --tail=100
    fi
}

# Check service health
health() {
    log_info "Checking service health..."
    
    # Check API health endpoint
    if curl -sf http://localhost:3002/health/readiness > /dev/null 2>&1; then
        log_success "API is healthy"
    else
        log_error "API is not responding"
        return 1
    fi
    
    # Show container status
    echo ""
    docker compose -f "$COMPOSE_FILE" ps --all
}

# Wait for services to be healthy
wait_for_services() {
    local timeout=180
    local elapsed=0
    
    log_info "Waiting for API to be ready (timeout: ${timeout}s)..."
    
    while [ $elapsed -lt $timeout ]; do
        if curl -sf http://localhost:3002/health/readiness > /dev/null 2>&1; then
            log_success "API is ready"
            return 0
        fi
        
        sleep 2
        elapsed=$((elapsed + 2))
        
        if [ $((elapsed % 20)) -eq 0 ]; then
            log_info "Waiting... (${elapsed}s)"
        fi
    done
    
    return 1
}

# Show status
status() {
    log_info "Firecrawl P0 Status"
    echo "==================="
    echo ""
    
    if docker compose -f "$COMPOSE_FILE" ps 2>/dev/null | grep -q "Up"; then
        log_success "Firecrawl is running"
        docker compose -f "$COMPOSE_FILE" ps
    else
        log_warn "Firecrawl is not running"
    fi
    
    echo ""
    log_info "Environment file: $ENV_FILE"
    
    if [ -f "$ENV_FILE" ]; then
        echo ""
        log_info "Configuration (passwords redacted):"
        set -a
        source "$ENV_FILE"
        set +a
        echo "  FIRECRAWL_VERSION: ${FIRECRAWL_VERSION}"
        echo "  USE_DB_AUTHENTICATION: ${USE_DB_AUTHENTICATION}"
        echo "  BULL_AUTH_KEY: ***hidden***"
        echo "  POSTGRES_PASSWORD: ***hidden***"
        echo "  RABBITMQ_PASSWORD: ***hidden***"
    fi
}

# Run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."
    check_prerequisites
    
    echo ""
    log_info "Test 1: API Health Check"
    if curl -sf http://localhost:3002/health/readiness | grep -q "ok"; then
        log_success "API health check passed"
    else
        log_error "API health check failed"
        exit 1
    fi
    
    echo ""
    log_info "Test 2: Simple Scrape (example.com)"
    local scrape_response
    scrape_response=$(curl -sf \
        --max-time 75 \
        -X POST \
        http://localhost:3002/v2/scrape \
        -H 'Content-Type: application/json' \
        -d '{"url": "https://example.com", "formats": ["markdown"], "timeout": 60000}' 2>&1)
    
    if echo "$scrape_response" | grep -q '"success":true'; then
        log_success "Scrape test passed"
        echo ""
        echo "Scrape response:"
        echo "$scrape_response" | jq '.'
    else
        log_error "Scrape test failed"
        echo ""
        echo "Response: $scrape_response"
        exit 1
    fi
    
    echo ""
    log_info "Test 3: JavaScript Rendering"
    local js_response
    js_response=$(curl -sf \
        --max-time 75 \
        -X POST \
        http://localhost:3002/v2/scrape \
        -H 'Content-Type: application/json' \
        -d '{"url": "https://example.com", "formats": ["markdown"], "waitFor": 2000}' 2>&1)
    
    if echo "$js_response" | grep -q '"success":true'; then
        log_success "JavaScript rendering test passed"
    else
        log_error "JavaScript rendering test failed"
        echo ""
        echo "Response: $js_response"
        exit 1
    fi
    
    echo ""
    log_success "All smoke tests passed!"
}

# Show usage
usage() {
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  deploy          Deploy and start Firecrawl services"
    echo "  stop            Stop Firecrawl services"
    echo "  restart         Restart Firecrawl services"
    echo "  undeploy        Stop and remove all containers and volumes"
    echo "  logs [-f|--follow]  View logs (default: last 100 lines)"
    echo "  health          Check service health endpoints"
    echo "  status          Show deployment status"
    echo "  smoke-tests     Run smoke tests to verify deployment"
    echo "  help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy       # Deploy and start services"
    echo "  $0 smoke-tests  # Run smoke tests"
    echo "  $0 logs -f      # Follow logs in real-time"
    echo ""
    echo "Environment:"
    echo "  Compose file: $COMPOSE_FILE"
    echo "  Env file: $ENV_FILE"
}

# Main
case "${1:-}" in
    deploy)
        deploy
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        sleep 5
        deploy
        ;;
    undeploy)
        undeploy
        ;;
    logs)
        logs "${2:-}"
        ;;
    health)
        health
        ;;
    status)
        status
        ;;
    smoke-tests)
        run_smoke_tests
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        log_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac
