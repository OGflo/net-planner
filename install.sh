#!/usr/bin/env bash
# Net Planner one-command installer.
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/OGflo/net-planner/main/install.sh)"
#
# On a Proxmox VE host: creates a small Debian 12 LXC and installs Net Planner inside it.
# On Debian / Ubuntu (an LXC, VM or bare metal): installs Net Planner right there.
# Run it again any time to update. Your plan data and config.json are kept.
#
# The server also hosts the website, so this one install gives you both:
#   http://<ip>:8770  — the planner website, and the address the iPhone / Mac apps link to.
#
# Optional settings (put them before the command, e.g.  VLAN=10 bash -c "$(curl ...)"):
#   MODE=lxc|here      force creating a container, or installing on this machine
#   CTID=120           container ID (default: next free)
#   CT_HOSTNAME=netplanner   container name
#   BRIDGE=vmbr0       network bridge
#   VLAN=10            VLAN tag for the container (default: none)
#   IP=10.0.10.20/24   static address (default: DHCP)
#   GW=10.0.10.1       gateway, needed with IP
#   STORAGE=local-lvm  disk storage for the container
#   TEMPLATE_STORAGE=local   where the Debian template is kept
#   DISK=4  MEMORY=512  CORES=1
#   PORT=8770          web port
#   VERSION=latest     a release tag such as v2.0, or latest
set -euo pipefail

REPO="OGflo/net-planner"
VERSION="${VERSION:-latest}"
PORT="${PORT:-8770}"
APP_DIR="${NP_APP_DIR:-/opt/netplanner}"   # NP_APP_DIR is for testing only
SERVICE="netplanner"
SELF_URL="https://raw.githubusercontent.com/${REPO}/main/install.sh"

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run this as root (on Proxmox you already are; elsewhere use sudo)."

if [ "$VERSION" = "latest" ]; then
  ZIP_URL="https://github.com/${REPO}/releases/latest/download/NetPlanner-Server.zip"
else
  ZIP_URL="https://github.com/${REPO}/releases/download/${VERSION}/NetPlanner-Server.zip"
fi

# ---------------------------------------------------------------- install here
install_here() {
  command -v apt-get >/dev/null 2>&1 || die "This installer supports Debian and Ubuntu (apt). For other systems use the zip from the GitHub release."
  say "Installing packages (python3, ping, curl, unzip)"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq python3 iputils-ping curl unzip ca-certificates >/dev/null

  TMPD="$(mktemp -d)"; local tmp="$TMPD"
  trap 'rm -rf "${TMPD:-/nonexistent}"' EXIT
  say "Downloading Net Planner ($VERSION)"
  curl -fsSL "$ZIP_URL" -o "$tmp/np.zip" || die "Could not download $ZIP_URL"
  unzip -q "$tmp/np.zip" -d "$tmp"
  [ -f "$tmp/NetPlanner-Server/netplanner_server.py" ] || die "The download does not look like a Net Planner release."

  local updating=0
  [ -f "$APP_DIR/netplanner_server.py" ] && updating=1

  id -u netplanner >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin netplanner
  mkdir -p "$APP_DIR/data"
  # program files are replaced; your data/ folder and config.json are never touched
  rm -rf "$APP_DIR/web"
  cp -R "$tmp/NetPlanner-Server/web" "$APP_DIR/web"
  cp "$tmp/NetPlanner-Server/netplanner_server.py" "$tmp/NetPlanner-Server/README.txt" "$APP_DIR/"
  if [ ! -f "$APP_DIR/config.json" ]; then
    sed "s/\"port\": *[0-9]*/\"port\": ${PORT}/" "$tmp/NetPlanner-Server/config.json" > "$APP_DIR/config.json"
  fi
  chown -R netplanner:netplanner "$APP_DIR"
  chmod 750 "$APP_DIR/data"

  say "Setting up the netplanner service (starts at boot)"
  cat > "/etc/systemd/system/${SERVICE}.service" <<EOF
[Unit]
Description=Net Planner server (website, live status, Proxmox/TrueNAS sync)
After=network-online.target
Wants=network-online.target

[Service]
User=netplanner
Group=netplanner
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/python3 -u ${APP_DIR}/netplanner_server.py --no-browser
Restart=on-failure
RestartSec=5
# ping needs raw sockets for the status checks and the network scan
AmbientCapabilities=CAP_NET_RAW

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable "$SERVICE" >/dev/null 2>&1
  systemctl restart "$SERVICE"

  local port; port="$(python3 -c "import json;print(json.load(open('$APP_DIR/config.json')).get('port',8770))" 2>/dev/null || echo "$PORT")"
  for _ in $(seq 1 20); do
    curl -fs "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1 && break
    sleep 1
  done
  curl -fs "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1 || { journalctl -u "$SERVICE" -n 20 --no-pager || true; die "The service did not start. The log is above."; }

  local ip; ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo
  if [ "$updating" = 1 ]; then say "Net Planner updated. Your plan and settings were kept."; else say "Net Planner is installed and running."; fi
  echo "    Website / app address:  http://${ip:-<this-machine>}:${port}"
  echo "    Data:                   ${APP_DIR}/data"
  echo "    Settings:               ${APP_DIR}/config.json  (then: systemctl restart ${SERVICE})"
  echo "    Logs:                   journalctl -u ${SERVICE} -f"
  echo "    Update later:           run the same install command again"
}

# ---------------------------------------------------------------- create an LXC on a Proxmox host
install_lxc() {
  command -v pct >/dev/null 2>&1 || die "pct not found — this is not a Proxmox VE host. Use MODE=here to install on this machine."
  local ctid="${CTID:-$(pvesh get /cluster/nextid)}"
  local name="${CT_HOSTNAME:-netplanner}"
  local bridge="${BRIDGE:-vmbr0}"
  local storage="${STORAGE:-local-lvm}"
  local tstore="${TEMPLATE_STORAGE:-local}"

  if pct status "$ctid" >/dev/null 2>&1; then
    if pct exec "$ctid" -- test -f "$APP_DIR/netplanner_server.py" 2>/dev/null; then
      say "Container $ctid already runs Net Planner — updating it"
      pct exec "$ctid" -- bash -c "curl -fsSL '$SELF_URL' | MODE=here VERSION='$VERSION' PORT='$PORT' bash"
      return
    fi
    die "Container ID $ctid is already used by something else. Pick another with CTID=..."
  fi

  say "Finding the Debian 12 template"
  pveam update >/dev/null 2>&1 || warn "Could not refresh the template list; using what is cached."
  local tmpl
  tmpl="$(pveam list "$tstore" 2>/dev/null | awk '{print $1}' | grep -o 'debian-12-standard[^ ]*' | sort -V | tail -1 || true)"
  if [ -z "$tmpl" ]; then
    tmpl="$(pveam available --section system | awk '{print $2}' | grep '^debian-12-standard' | sort -V | tail -1)"
    [ -n "$tmpl" ] || die "No Debian 12 template is available from pveam."
    say "Downloading $tmpl"
    pveam download "$tstore" "$tmpl" >/dev/null
  fi

  local net="name=eth0,bridge=${bridge}"
  if [ -n "${IP:-}" ]; then
    [ -n "${GW:-}" ] || die "Set GW=<gateway> together with IP=<address/prefix>."
    net="${net},ip=${IP},gw=${GW}"
  else
    net="${net},ip=dhcp"
  fi
  [ -n "${VLAN:-}" ] && net="${net},tag=${VLAN}"

  say "Creating container $ctid ($name) on $storage, network $net"
  pct create "$ctid" "${tstore}:vztmpl/${tmpl}" \
    --hostname "$name" --cores "${CORES:-1}" --memory "${MEMORY:-512}" --swap 256 \
    --rootfs "${storage}:${DISK:-4}" --net0 "$net" \
    --unprivileged 1 --features nesting=1 --onboot 1 \
    --description "Net Planner — http://<ip>:${PORT}  (https://github.com/${REPO})" >/dev/null
  pct start "$ctid"

  say "Waiting for the container to get on the network"
  local ok=0
  for _ in $(seq 1 60); do
    if pct exec "$ctid" -- bash -c "getent hosts deb.debian.org >/dev/null && ip route | grep -q default" 2>/dev/null; then ok=1; break; fi
    sleep 2
  done
  [ "$ok" = 1 ] || die "Container $ctid has no internet access. Check the bridge/VLAN (BRIDGE=, VLAN=) or DHCP, then run: pct exec $ctid -- bash -c \"\$(curl -fsSL $SELF_URL)\""

  say "Installing Net Planner inside container $ctid"
  pct exec "$ctid" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null && curl -fsSL '$SELF_URL' | MODE=here VERSION='$VERSION' PORT='$PORT' bash"

  local ip; ip="$(pct exec "$ctid" -- hostname -I 2>/dev/null | awk '{print $1}')"
  pct set "$ctid" --description "Net Planner — http://${ip}:${PORT}  (https://github.com/${REPO})" >/dev/null 2>&1 || true
  echo
  say "Done. Net Planner runs in container $ctid ($name)."
  echo "    Open:            http://${ip}:${PORT}"
  echo "    In the iPhone / Mac app: More → Link with your Mac / website → http://${ip}:${PORT}"
  echo "    Update later:    run the same command again on this Proxmox host"
  echo "    Tip: give it a static IP in pfSense (DHCP reservation) so the apps always find it."
}

MODE="${MODE:-}"
if [ -z "$MODE" ]; then
  if command -v pct >/dev/null 2>&1; then MODE=lxc; else MODE=here; fi
fi
case "$MODE" in
  lxc)  install_lxc ;;
  here) install_here ;;
  *)    die "MODE must be lxc or here" ;;
esac
