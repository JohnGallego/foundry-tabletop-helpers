#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  FTH Optimizer — Uninstaller
# ============================================================

SERVICE_NAME="fth-optimizer"
INSTALL_DIR="/opt/fth-optimizer"
SERVICE_USER="fth-optimizer"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}[ERROR]${NC} This script must be run as root (use sudo)."
  exit 1
fi

echo -e "${CYAN}Removing FTH Optimizer...${NC}"

# Stop and disable service
systemctl stop "$SERVICE_NAME" 2>/dev/null || true
systemctl disable "$SERVICE_NAME" 2>/dev/null || true
rm -f "/etc/systemd/system/$SERVICE_NAME.service"
systemctl daemon-reload

# Remove files
rm -rf "$INSTALL_DIR"
rm -rf "/tmp/fth-optimizer"

# Remove user
userdel "$SERVICE_USER" 2>/dev/null || true

echo -e "${GREEN}FTH Optimizer has been removed.${NC}"
