#!/bin/bash

# PumpFun Twitter Launcher - Startup Script
# Starts backend server and frontend web UI simultaneously

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   PumpFun Twitter Launcher - Startup Script    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js${NC} $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npm${NC} $(npm --version)"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}✗ .env file not found in root directory${NC}"
    echo -e "${YELLOW}  Please create .env file with required configuration${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Root .env file${NC} found"

# Check if web/.env exists
if [ ! -f web/.env ]; then
    echo -e "${RED}✗ web/.env file not found${NC}"
    echo -e "${YELLOW}  Please create web/.env file with required configuration${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Web .env file${NC} found"
echo ""

# Install dependencies if needed
if [ ! -d node_modules ]; then
    echo -e "${YELLOW}Installing root dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Root dependencies installed${NC}"
    echo ""
fi

if [ ! -d web/node_modules ]; then
    echo -e "${YELLOW}Installing web dependencies...${NC}"
    cd web
    npm install
    cd ..
    echo -e "${GREEN}✓ Web dependencies installed${NC}"
    echo ""
fi

# Build TypeScript if needed
if [ ! -d dist ]; then
    echo -e "${YELLOW}Building TypeScript...${NC}"
    npm run build
    echo -e "${GREEN}✓ TypeScript build complete${NC}"
    echo ""
fi

# Start servers
echo -e "${YELLOW}Starting servers...${NC}"
echo ""

# Check if concurrently is installed
if ! npm list concurrently > /dev/null 2>&1; then
    echo -e "${YELLOW}Installing concurrently...${NC}"
    npm install --save-dev concurrently
    echo ""
fi

# Start both backend and frontend
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Starting Backend & Frontend           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Backend${NC}  : http://localhost:3000"
echo -e "${GREEN}Frontend${NC} : http://localhost:5173"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

npx concurrently \
  --names "BACKEND,FRONTEND" \
  --prefix "[{name}]" \
  --prefix-colors "blue,cyan" \
  --handle-input \
  --restart-tries 2 \
  --restart-delay 1000 \
  "npm run dev" \
  "npm run dev:web"
