#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  FTH Optimizer — Installer
#  Installs the asset optimization server companion for
#  Foundry Tabletop Helpers as a systemd service.
# ============================================================

INSTALL_DIR="/opt/fth-optimizer"
SERVICE_NAME="fth-optimizer"
SERVICE_USER="fth-optimizer"
TEMP_DIR="/tmp/fth-optimizer"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ── Root check ──────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  error "This installer must be run as root (use sudo)."
  exit 1
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}  FTH Optimizer — Installation${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo ""

# ── Detect OS ───────────────────────────────────────────────
if [ -f /etc/os-release ]; then
  . /etc/os-release
  info "Detected OS: $PRETTY_NAME"
else
  warn "Cannot detect OS. Proceeding anyway — manual dependency install may be needed."
fi

# ── Check/Install Node.js ───────────────────────────────────
install_node() {
  info "Installing Node.js 20 LTS via NodeSource..."
  if command -v apt-get &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update -qq
    apt-get install -y -qq nodejs
  else
    error "apt-get not found. Please install Node.js 20+ manually and re-run."
    exit 1
  fi
}

if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -ge 20 ]; then
    ok "Node.js $(node --version) found"
  else
    warn "Node.js $(node --version) is too old (need 20+)"
    install_node
  fi
else
  warn "Node.js not found"
  install_node
fi

# ── Check/Install FFmpeg ────────────────────────────────────
if command -v ffmpeg &>/dev/null; then
  FFMPEG_VER=$(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')
  ok "FFmpeg $FFMPEG_VER found"
else
  info "Installing FFmpeg..."
  if command -v apt-get &>/dev/null; then
    apt-get install -y -qq ffmpeg
    ok "FFmpeg installed"
  else
    warn "Could not install FFmpeg automatically. Audio/video optimization will be disabled."
  fi
fi

# ── Determine source directory ──────────────────────────────
# The script may be run from inside the extracted tarball or from the repo
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$(dirname "$SCRIPT_DIR")"

# Check if this is a valid source directory
if [ ! -f "$SOURCE_DIR/package.json" ]; then
  error "Cannot find package.json. Run this script from inside the fth-optimizer directory."
  exit 1
fi

# ── Install files ───────────────────────────────────────────
info "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

# Copy application files
cp -r "$SOURCE_DIR/dist" "$INSTALL_DIR/"
cp "$SOURCE_DIR/package.json" "$INSTALL_DIR/"
[ -f "$SOURCE_DIR/package-lock.json" ] && cp "$SOURCE_DIR/package-lock.json" "$INSTALL_DIR/"

# Install production dependencies
info "Installing Node.js dependencies..."
cd "$INSTALL_DIR"
npm ci --production --quiet 2>/dev/null || npm install --production --quiet

# Create temp directory
mkdir -p "$TEMP_DIR"

# ── Generate auth token ────────────────────────────────────
if [ -f "$INSTALL_DIR/.env" ]; then
  warn "Existing .env found — preserving current configuration"
  AUTH_TOKEN=$(grep FTH_AUTH_TOKEN "$INSTALL_DIR/.env" | cut -d= -f2)
else
  AUTH_TOKEN=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

  # Detect server IP for the config
  SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")

  cat > "$INSTALL_DIR/.env" <<EOF
FTH_AUTH_TOKEN=$AUTH_TOKEN
FTH_PORT=7890
FTH_HOST=0.0.0.0
FTH_ALLOWED_ORIGINS=https://$SERVER_IP
FTH_MAX_FILE_SIZE=104857600
FTH_TEMP_DIR=$TEMP_DIR
FTH_LOG_LEVEL=info
EOF
  ok "Configuration written to $INSTALL_DIR/.env"
fi

# ── Create system user ──────────────────────────────────────
if id "$SERVICE_USER" &>/dev/null; then
  ok "System user '$SERVICE_USER' already exists"
else
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
  ok "Created system user '$SERVICE_USER'"
fi

# ── Set permissions ─────────────────────────────────────────
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$TEMP_DIR"
chmod 600 "$INSTALL_DIR/.env"

# ── Install systemd service ─────────────────────────────────
cp "$SOURCE_DIR/systemd/fth-optimizer.service" "/etc/systemd/system/$SERVICE_NAME.service"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
ok "Systemd service installed and started"

# ── Print summary ───────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  FTH Optimizer — Installed Successfully${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  URL:   ${CYAN}http://${SERVER_IP:-localhost}:7890${NC}"
echo -e "  Token: ${YELLOW}${AUTH_TOKEN}${NC}"
echo ""
echo "  Paste these into your Foundry module settings:"
echo -e "    Optimizer URL:   ${CYAN}http://${SERVER_IP:-localhost}:7890${NC}"
echo -e "    Optimizer Token: ${YELLOW}${AUTH_TOKEN}${NC}"
echo ""
echo "  Service commands:"
echo "    sudo systemctl status $SERVICE_NAME"
echo "    sudo systemctl restart $SERVICE_NAME"
echo "    sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "  Configuration: $INSTALL_DIR/.env"
echo "  Edit FTH_ALLOWED_ORIGINS to match your Foundry URL."
echo ""
