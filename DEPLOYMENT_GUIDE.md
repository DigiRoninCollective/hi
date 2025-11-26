# 🚀 PumpFun Bot Deployment Guide

## Quick Start (Choose One)

### Option 1: Automated Script (Recommended for VPS)
```bash
# SSH into your VPS and run:
sudo bash <(curl -s https://raw.githubusercontent.com/DigiRoninCollective/hi/claude/check-project-progress-01CDH5JEqF9KtD3iUNkp2vqx/deploy.sh)
```

### Option 2: Docker Compose (Recommended for Docker-savvy users)
```bash
# Clone the repo
git clone -b claude/check-project-progress-01CDH5JEqF9KtD3iUNkp2vqx https://github.com/DigiRoninCollective/hi.git
cd hi

# Copy .env template
cp .env.example .env

# Edit configuration
nano .env

# Build and start
docker compose up -d

# View logs
docker compose logs -f
```

### Option 3: Manual Deployment
See "Manual Installation" section below

---

## 📋 Prerequisites

### For Oracle Cloud Always Free:
1. Create account at https://www.oracle.com/cloud/free/
2. Launch an ARM instance (always free)
3. SSH into the instance
4. Have `sudo` access

### For DigitalOcean:
1. Create an account and $5 droplet
2. Choose Ubuntu 22.04 LTS
3. SSH into the droplet
4. Have `sudo` access

### For AWS/Google Cloud:
Use free tier (12 months for AWS, $300 credit for GCP)

### Required Credentials:
- ✅ **Telegram Bot Token** - Get from @BotFather on Telegram
- ✅ **Your Telegram User ID** - Message your bot, then check updates API
- ✅ **Helius API Key** - Free tier at https://helius.dev/ (for Solana RPC)
- ⚠️ **Groq API Key** (Optional) - For AI features at https://console.groq.com/
- ⚠️ **Supabase credentials** (Optional) - For persistent storage

---

## 🔧 Automated Deployment (Easiest)

### Step 1: Prepare Your VPS
```bash
# SSH into your VPS
ssh root@your_vps_ip

# OR with a regular user (add sudo):
ssh ubuntu@your_vps_ip
```

### Step 2: Run Deployment Script
```bash
# Download and execute (as root):
curl -fsSL https://raw.githubusercontent.com/DigiRoninCollective/hi/claude/check-project-progress-01CDH5JEqF9KtD3iUNkp2vqx/deploy.sh | sudo bash

# OR download first, review, then execute:
wget https://raw.githubusercontent.com/DigiRoninCollective/hi/claude/check-project-progress-01CDH5JEqF9KtD3iUNkp2vqx/deploy.sh
sudo bash deploy.sh
```

### Step 3: Configure Environment
The script creates `/opt/pumpfun-bot/.env` with placeholders.

Edit it with your credentials:
```bash
sudo nano /opt/pumpfun-bot/.env
```

**Minimum required settings:**
```env
# Telegram (REQUIRED)
ALPHA_TELEGRAM_ENABLED=true
ALPHA_TELEGRAM_BOT_TOKEN=8442033778:AAGH21NPEZdyLO3EFGRFSfc2vyNy31GIeQs
TELEGRAM_ADMIN_ID=7211408835

# Solana RPC (REQUIRED)
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
SOLANA_PRIVATE_KEY=your_base58_private_key

# Groq AI (OPTIONAL but recommended)
GROQ_API_KEY=your_groq_api_key
```

### Step 4: Start the Bot
```bash
# Start
sudo systemctl start pumpfun-bot

# Check status
sudo systemctl status pumpfun-bot

# View logs
sudo journalctl -u pumpfun-bot -f
```

---

## 🐳 Docker Compose Deployment

### Step 1: Install Docker
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# CentOS/RHEL
sudo yum install docker docker-compose
sudo systemctl start docker
sudo systemctl enable docker
```

### Step 2: Clone Repository
```bash
git clone -b claude/check-project-progress-01CDH5JEqF9KtD3iUNkp2vqx https://github.com/DigiRoninCollective/hi.git
cd hi
```

### Step 3: Configure Environment
```bash
# Copy example to .env
cp .env.example .env

# Edit with your credentials
nano .env
```

**Key variables to update:**
```env
ALPHA_TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_ID=your_user_id
SOLANA_RPC_URL=your_helius_rpc_url
SOLANA_PRIVATE_KEY=your_wallet_key
GROQ_API_KEY=your_groq_key (optional)
```

### Step 4: Build and Run
```bash
# Build image
docker compose build

# Start containers
docker compose up -d

# View logs
docker compose logs -f pumpfun-bot

# Stop containers
docker compose down
```

### Step 5: Manage the Bot
```bash
# Status
docker compose ps

# Restart
docker compose restart

# View logs
docker compose logs -f pumpfun-bot

# Access shell
docker compose exec pumpfun-bot /bin/sh
```

---

## 📝 Manual Installation

If you prefer not to use Docker:

### Step 1: Install Dependencies
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm git curl

# CentOS/RHEL
sudo yum install -y nodejs npm git curl
```

### Step 2: Clone Repository
```bash
git clone -b claude/check-project-progress-01CDH5JEqF9KtD3iUNkp2vqx https://github.com/DigiRoninCollective/hi.git
cd hi
```

### Step 3: Install Dependencies
```bash
npm install
npm run build
```

### Step 4: Configure
```bash
cp .env.example .env
nano .env  # Edit with your credentials
```

### Step 5: Create Systemd Service
```bash
sudo tee /etc/systemd/system/pumpfun-bot.service > /dev/null << 'EOF'
[Unit]
Description=PumpFun Twitter Launcher Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/hi
ExecStart=/usr/bin/node dist/index.js
Restart=unless-stopped
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable pumpfun-bot
sudo systemctl start pumpfun-bot
```

### Step 6: Monitor
```bash
sudo systemctl status pumpfun-bot
sudo journalctl -u pumpfun-bot -f
```

---

## 🎯 Verifying Deployment

### Check Bot Is Running
```bash
# View service status
sudo systemctl status pumpfun-bot

# Check port 3000 is listening
sudo netstat -tlnp | grep 3000
# OR
sudo ss -tlnp | grep 3000

# Test API endpoint
curl http://localhost:3000/api/status
```

### Check Telegram Connection
```bash
# View logs for Telegram initialization
sudo journalctl -u pumpfun-bot | grep -i telegram

# You should see:
# [Telegram] Starting Telegram service...
# [Telegram] Bot logged in as @AlphaRaptorBot
```

### Test Bot Commands
Send these commands to your Telegram bot:
- `/status` - Check bot status
- `/groq` - Start AI mode (you are admin)
- `/help` - Show available commands

---

## 🔐 Security Best Practices

### 1. Firewall Configuration
```bash
# Allow SSH
sudo ufw allow 22

# Allow HTTP (for API)
sudo ufw allow 80

# Allow HTTPS
sudo ufw allow 443

# Block everything else
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
```

### 2. Protect Credentials
```bash
# Never commit .env to git
echo ".env" >> .gitignore

# Use strong permissions
sudo chmod 600 /opt/pumpfun-bot/.env

# Use environment variables instead of hardcoding
export SOLANA_PRIVATE_KEY="..."
export GROQ_API_KEY="..."
```

### 3. Regular Updates
```bash
# Update system packages monthly
sudo apt update && sudo apt upgrade -y

# Update bot code
cd /opt/pumpfun-bot
git pull origin claude/check-project-progress-01CDH5JEqF9KtD3iUNkp2vqx
docker compose build
docker compose restart
```

### 4. Monitor Resource Usage
```bash
# View resource usage
docker stats

# Set resource limits in docker-compose.yml
# (already configured in our file)
```

---

## 🐛 Troubleshooting

### Bot Won't Start
```bash
# Check logs
sudo journalctl -u pumpfun-bot -n 50

# Common issues:
# 1. Port 3000 already in use
sudo lsof -i :3000

# 2. Missing environment variables
nano /opt/pumpfun-bot/.env

# 3. Invalid credentials
# Check SOLANA_PRIVATE_KEY format
# Check TELEGRAM_BOT_TOKEN format
```

### Telegram Bot Not Responding
```bash
# Check logs for TLS error
sudo journalctl -u pumpfun-bot | grep -i "TLS\|SSL\|handshake"

# This is usually a network connectivity issue, not code
# Verify RPC connectivity:
curl "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

### High Memory Usage
```bash
# Check what's using memory
docker stats

# Restart the container
docker compose restart

# Check for memory leaks in logs
docker compose logs --tail 100 | grep -i "memory\|leak\|error"
```

### Bot Commands Not Working
```bash
# Check if commands are registered
sudo journalctl -u pumpfun-bot | grep "commands registered"

# Restart to reload commands
sudo systemctl restart pumpfun-bot

# Check for /groq permission errors
sudo journalctl -u pumpfun-bot | grep -i "groq"
```

---

## 📊 Monitoring

### Setup Uptime Monitoring
```bash
# Use a service like UptimeRobot to monitor:
# http://your_vps_ip:3000/api/status
```

### Log Rotation
```bash
# Logs are automatically rotated (see docker-compose.yml)
# Max 10MB per file, keep 3 files

# Manual cleanup
docker compose logs --tail 0 -f
```

### Performance Metrics
```bash
# View CPU and memory usage
docker stats pumpfun-bot

# View container details
docker inspect pumpfun-bot
```

---

## 🔄 Updating the Bot

### Pull Latest Code
```bash
cd /opt/pumpfun-bot
git fetch origin
git checkout claude/check-project-progress-01CDH5JEqF9KtD3iUNkp2vqx
git pull origin claude/check-project-progress-01CDH5JEqF9KtD3iUNkp2vqx
```

### Rebuild Docker Image
```bash
docker compose build --no-cache
docker compose up -d
```

### Restart Service
```bash
# Automated script
sudo systemctl restart pumpfun-bot

# Docker Compose
docker compose restart
```

---

## 📞 Support & Troubleshooting

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Port 3000 already in use | `sudo lsof -i :3000` then kill process or change port in .env |
| Docker build fails | `docker compose build --no-cache` |
| Out of disk space | `docker system prune -a` |
| Container won't start | Check logs: `docker compose logs pumpfun-bot` |
| Telegram token invalid | Verify token format from @BotFather |
| Groq API errors | Check GROQ_API_KEY at console.groq.com |
| RPC connection errors | Verify Helius API key, check rate limits |

### Getting Help

1. Check logs first
2. Verify all environment variables
3. Test RPC connectivity manually
4. Check Telegram token format
5. Review network/firewall settings

---

## 🎉 Next Steps

After deployment:

1. **Test the bot** - Send `/status` command
2. **Enable Groq AI** - Set GROQ_API_KEY for AI features
3. **Configure alerts** - Set up Discord/Telegram webhooks
4. **Monitor performance** - Watch logs and resource usage
5. **Secure the server** - Enable UFW firewall
6. **Setup backups** - Regular data backups

---

## 📌 Useful Commands

```bash
# View bot logs
sudo journalctl -u pumpfun-bot -f

# Restart bot
sudo systemctl restart pumpfun-bot

# Stop bot
sudo systemctl stop pumpfun-bot

# Start bot
sudo systemctl start pumpfun-bot

# Check status
sudo systemctl status pumpfun-bot

# View Docker logs
docker compose logs -f

# SSH into container
docker compose exec pumpfun-bot /bin/sh

# Copy files
sudo cp /opt/pumpfun-bot/.env /opt/pumpfun-bot/.env.backup
```

---

**Deployment Guide Complete!** Your PumpFun Bot is ready to run 24/7 on your free VPS. 🚀
