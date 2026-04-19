#!/usr/bin/env bash
# One-shot VPS hardening: firewall, fail2ban, unattended upgrades, Docker.
# Run as root on a fresh Ubuntu 22.04+/24.04 install.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "run as root" >&2; exit 1
fi

SSH_PORT="${SSH_PORT:-22}"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade
apt-get -y install ca-certificates curl gnupg ufw fail2ban unattended-upgrades \
                   apt-listchanges rsync git make

# --- Docker CE ------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

# --- UFW ------------------------------------------------------------
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
yes | ufw enable

# --- fail2ban -------------------------------------------------------
cat > /etc/fail2ban/jail.local <<EOF
[sshd]
enabled = true
port    = ${SSH_PORT}
maxretry = 5
bantime  = 1h
findtime = 10m
EOF
systemctl enable --now fail2ban

# --- unattended upgrades -------------------------------------------
dpkg-reconfigure -f noninteractive unattended-upgrades

echo
echo "[bootstrap] done.  Reboot recommended."
echo "[bootstrap] create an 'app' user, add SSH key, then disable root login:"
echo "           PermitRootLogin no, PasswordAuthentication no in /etc/ssh/sshd_config"
