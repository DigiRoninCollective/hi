#!/bin/bash

################################################################################
# PumpFun Twitter Launcher - Automated Deployment Script
# For Oracle Cloud (Always Free), DigitalOcean, AWS, or any Linux VPS
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="pumpfun-bot"
REPO_URL="${REPO_URL:-https://github.com/DigiRoninCollective/hi.git}"
BRANCH="${BRANCH:-main}"
DEPLOY_DIR="/opt/pumpfun-bot"
SERVICE_NAME="pumpfun-bot"

################################################################################
# Functions
################################################################################

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root. Use: sudo bash deploy.sh"
    fi
}

check_os() {
    if [[ ! -f /etc/os-release ]]; then
        print_error "Cannot detect OS. This script supports Ubuntu/Debian/CentOS."
    fi
    . /etc/os-release
    OS=$ID
    print_success "Detected OS: $OS ($VERSION)"
}

install_docker() {
    print_header "Installing Docker"

    if command -v docker &> /dev/null; then
        print_success "Docker is already installed"
        docker --version
        return 0
    fi

    case $OS in
        ubuntu|debian)
            apt-get update
            apt-get install -y \
                apt-transport-https \
                ca-certificates \
                curl \
                gnupg \
                lsb-release

            curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            apt-get update
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        centos|rhel|fedora)
            yum install -y yum-utils
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            yum install -y docker-ce docker-ce-cli containerd.io
            ;;
        *)
            print_error "Unsupported OS: $OS"
            ;;
    esac

    # Enable and start Docker
    systemctl enable docker
    systemctl start docker
    print_success "Docker installed and started"
}

install_docker_compose() {
    print_header "Installing Docker Compose"

    if docker compose version &> /dev/null; then
        print_success "Docker Compose is already installed"
        docker compose version
        return 0
    fi

    curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_success "Docker Compose installed"
}

install_git() {
    print_header "Installing Git"

    if command -v git &> /dev/null; then
        print_success "Git is already installed"
        git --version
        return 0
    fi

    case $OS in
        ubuntu|debian)
            apt-get install -y git
            ;;
        centos|rhel|fedora)
            yum install -y git
            ;;
    esac

    print_success "Git installed"
}

install_nodejs() {
    print_header "Installing Node.js 22 (Optional - for local development)"

    if command -v node &> /dev/null; then
        print_success "Node.js is already installed"
        node --version
        return 0
    fi

    print_warning "Node.js not required for Docker deployment, but useful for development"
    read -p "Install Node.js 22? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return 0
    fi

    case $OS in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
            apt-get install -y nodejs
            ;;
        centos|rhel|fedora)
            curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
            yum install -y nodejs
            ;;
    esac

    print_success "Node.js installed: $(node --version)"
}

clone_repository() {
    print_header "Cloning Repository"

    if [[ -d "$DEPLOY_DIR" ]]; then
        print_warning "Directory $DEPLOY_DIR already exists"
        read -p "Pull latest changes? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cd "$DEPLOY_DIR"
            git fetch origin
            git checkout $BRANCH
            git pull origin $BRANCH
            print_success "Repository updated"
        fi
    else
        mkdir -p "$DEPLOY_DIR"
        git clone -b $BRANCH "$REPO_URL" "$DEPLOY_DIR"
        cd "$DEPLOY_DIR"
        print_success "Repository cloned to $DEPLOY_DIR"
    fi
}

create_env_file() {
    print_header "Creating .env Configuration"

    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        print_warning ".env file already exists"
        read -p "Overwrite .env? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_success "Keeping existing .env"
            return 0
        fi
    fi

    cat > "$DEPLOY_DIR/.env" << 'ENVFILE'
# ============================================
# Supabase Configuration
# ============================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ============================================
# Twitter API Configuration
# ============================================
TWITTER_ENABLED=false
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret
TWITTER_BEARER_TOKEN=your_bearer_token
TWITTER_USERNAMES=elonmusk,vitalikbuterin
TWITTER_HASHTAGS=LAUNCH,PUMPFUN

# ============================================
# Solana Configuration
# ============================================
SOLANA_PRIVATE_KEY=your_base58_private_key
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
SOLANA_WS_URL=wss://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY

# ============================================
# PumpFun Configuration
# ============================================
PUMPPORTAL_API_KEY=your_pumpportal_api_key
PUMPFUN_SDK_ENABLED=true
PUMPFUN_DEFAULT_SLIPPAGE_BPS=1000
PUMPFUN_PRIORITY_FEE=250000
DEFAULT_TOKEN_DECIMALS=6
DEFAULT_INITIAL_BUY_SOL=0.1

# ============================================
# Groq AI Configuration
# ============================================
GROQ_ENABLED=true
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
GROQ_SUGGESTION_COUNT=2
GROQ_AUTO_DEPLOY=false
GROQ_TEMPERATURE=0.2
GROQ_MAX_TOKENS=256

# ============================================
# SSE Server Configuration
# ============================================
SSE_PORT=3000
SSE_CORS_ORIGIN=*

# ============================================
# Alerting Configuration
# ============================================
ALERTING_ENABLED=true
ALERT_CONSOLE_OUTPUT=true
ALERT_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=

# ============================================
# Classifier Configuration
# ============================================
CLASSIFIER_MIN_CONFIDENCE=0.6
CLASSIFIER_MAX_RISK=0.7
TRUSTED_USERS=

# ============================================
# Alpha Aggregator - Telegram
# ============================================
ALPHA_TELEGRAM_ENABLED=true
ALPHA_TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ALPHA_TELEGRAM_POLLING=true
ALPHA_TELEGRAM_BOT_NAME=AlphaRaptorBot
ALPHA_TELEGRAM_BOT_DESCRIPTION=Advanced alpha signal aggregator and crypto analysis bot
TELEGRAM_ADMIN_ID=your_telegram_user_id

# ============================================
# Alpha Aggregator - Discord
# ============================================
ALPHA_DISCORD_ENABLED=false
ALPHA_DISCORD_BOT_TOKEN=your_discord_bot_token
ALPHA_DISCORD_CHANNELS=

# ============================================
# Alpha Aggregator - Reddit
# ============================================
ALPHA_REDDIT_ENABLED=false
ALPHA_REDDIT_CLIENT_ID=your_reddit_client_id
ALPHA_REDDIT_CLIENT_SECRET=your_reddit_client_secret
ALPHA_REDDIT_USERNAME=your_reddit_username
ALPHA_REDDIT_PASSWORD=your_reddit_password
ALPHA_REDDIT_USER_AGENT=AlphaAggregator/1.0.0
ALPHA_REDDIT_SUBREDDITS=CryptoMoonShots,SatoshiStreetBets
ALPHA_REDDIT_POLL_INTERVAL=30000

# ============================================
# Alpha Classifier Configuration
# ============================================
ALPHA_MIN_CONFIDENCE=0.5
ALPHA_MAX_RISK=0.7
ALPHA_LAUNCH_KEYWORDS=
ALPHA_SPAM_KEYWORDS=
ALPHA_TRUSTED_CHANNELS=
ALPHA_TRUSTED_USERS=

# ============================================
# Bundler Configuration (Jito MEV Protection)
# ============================================
BUNDLER_ENABLED=false
JITO_ENABLED=false
JITO_TIP_LAMPORTS=10000
JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf

# ============================================
# Raydium Configuration
# ============================================
RAYDIUM_ENABLED=false
RAYDIUM_AUTO_LP=false
RAYDIUM_LP_SOL_AMOUNT=1.0
ENVFILE

    print_warning "Created .env file with placeholder values"
    echo ""
    echo -e "${YELLOW}IMPORTANT: Edit $DEPLOY_DIR/.env with your actual credentials:${NC}"
    echo "  - SUPABASE_URL and SUPABASE_ANON_KEY"
    echo "  - SOLANA_PRIVATE_KEY"
    echo "  - SOLANA_RPC_URL (get Helius API key from helius.dev)"
    echo "  - ALPHA_TELEGRAM_BOT_TOKEN"
    echo "  - TELEGRAM_ADMIN_ID"
    echo "  - GROQ_API_KEY (optional, for AI features)"
    echo ""
}

build_docker_image() {
    print_header "Building Docker Image"

    cd "$DEPLOY_DIR"
    docker compose build

    print_success "Docker image built successfully"
}

create_systemd_service() {
    print_header "Creating Systemd Service"

    cat > "/etc/systemd/system/${SERVICE_NAME}.service" << SERVICEFILE
[Unit]
Description=PumpFun Twitter Launcher Bot
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=unless-stopped
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME
User=root
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

[Install]
WantedBy=multi-user.target
SERVICEFILE

    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    print_success "Systemd service created: $SERVICE_NAME"
}

start_bot() {
    print_header "Starting Bot Service"

    systemctl start $SERVICE_NAME
    sleep 5

    if systemctl is-active --quiet $SERVICE_NAME; then
        print_success "Bot service started successfully"
    else
        print_error "Bot service failed to start. Check logs: journalctl -u $SERVICE_NAME -n 50"
    fi
}

show_status() {
    print_header "Bot Status"

    systemctl status $SERVICE_NAME --no-pager

    print_header "Viewing Logs"
    echo "View logs with: journalctl -u $SERVICE_NAME -f"
    echo "View Docker logs with: docker compose -f $DEPLOY_DIR/docker-compose.yml logs -f"
}

show_next_steps() {
    print_header "✓ Deployment Complete!"

    echo -e "${GREEN}Your PumpFun Bot is now running!${NC}\n"

    echo "Next steps:"
    echo "1. Edit your configuration:"
    echo "   nano $DEPLOY_DIR/.env"
    echo ""
    echo "2. Update required values:"
    echo "   - SUPABASE credentials"
    echo "   - SOLANA_PRIVATE_KEY"
    echo "   - SOLANA_RPC_URL (with Helius API key)"
    echo "   - ALPHA_TELEGRAM_BOT_TOKEN"
    echo "   - TELEGRAM_ADMIN_ID"
    echo ""
    echo "3. Restart the bot:"
    echo "   systemctl restart $SERVICE_NAME"
    echo ""
    echo "4. Monitor logs:"
    echo "   journalctl -u $SERVICE_NAME -f"
    echo ""
    echo "5. Manage bot:"
    echo "   systemctl status $SERVICE_NAME       # Check status"
    echo "   systemctl stop $SERVICE_NAME         # Stop bot"
    echo "   systemctl restart $SERVICE_NAME      # Restart bot"
    echo ""
    echo "6. Access API:"
    echo "   curl http://localhost:3000/api/status"
    echo ""
}

################################################################################
# Main Execution
################################################################################

main() {
    print_header "PumpFun Twitter Launcher - Automated Deployment"

    # Check prerequisites
    check_root
    check_os

    # Install dependencies
    install_docker
    install_docker_compose
    install_git
    install_nodejs

    # Clone and setup
    clone_repository
    create_env_file

    # Build and deploy
    build_docker_image
    create_systemd_service
    start_bot

    # Show status and next steps
    show_status
    show_next_steps
}

# Run main function
main "$@"
