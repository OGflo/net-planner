#!/usr/bin/env bash
# Net Planner one-command installer.
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/OGflo/net-planner/main/install.sh)"
#
# On a Proxmox VE host: creates a small Debian 12 LXC and installs Net Planner inside it.
# On Debian / Ubuntu (an LXC, VM or bare metal): installs Net Planner right there.
# Run it again any time to update. Your plan data and config.json are kept.
#
# The server also hosts the website, so this one install gives you both.
# It listens on every address (0.0.0.0) on port 8770, so it works on whatever IP
# the machine has. The installer never sets an IP: on Proxmox the container starts
# on DHCP, and you set a static IP / VLAN in Proxmox (container → Network) any time.
#
# Optional settings (put them before the command, e.g.  PORT=8080 bash -c "$(curl ...)"):
#   PORT=8770          web port
#   MODE=lxc|here      force creating a container, or installing on this machine
#   CTID=120           container ID (default: the existing Net Planner container, or the next free ID)
#   CT_HOSTNAME=netplanner   container name
#   STORAGE=local-lvm  disk storage for the container
#   TEMPLATE_STORAGE=local   where the Debian template is kept
#   DISK=4  MEMORY=512  CORES=1
#   VERSION=latest     a release tag such as v2.0, or latest
set -euo pipefail

REPO="OGflo/net-planner"
VERSION="${VERSION:-latest}"
if [ -n "${PORT:-}" ]; then PORT_GIVEN="${PORT_GIVEN:-1}"; fi
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

  local updating=0 FIRST=1
  [ -f "$APP_DIR/netplanner_server.py" ] && { updating=1; FIRST=0; }

  id -u netplanner >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin netplanner
  mkdir -p "$APP_DIR/data"
  # program files are replaced; your data/ folder and config.json are never touched
  rm -rf "$APP_DIR/web"
  cp -R "$tmp/NetPlanner-Server/web" "$APP_DIR/web"
  cp "$tmp/NetPlanner-Server/netplanner_server.py" "$tmp/NetPlanner-Server/README.txt" "$APP_DIR/"
  [ -f "$APP_DIR/config.json" ] || cp "$tmp/NetPlanner-Server/config.json" "$APP_DIR/config.json"
  # listen on every address (0.0.0.0) so the machine's own IP works, whatever it is;
  # set the port only on a first install or when PORT is given, keep every other setting
  NP_PORT_SET="${PORT_GIVEN:-$FIRST}" NP_PORT="$PORT" python3 - "$APP_DIR/config.json" <<'PYCFG'
import json, os, sys
p = sys.argv[1]
c = json.load(open(p))
c["host"] = "0.0.0.0"
if os.environ.get("NP_PORT_SET") == "1":
    c["port"] = int(os.environ["NP_PORT"])
json.dump(c, open(p, "w"), indent=2)
PYCFG
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
  echo "    Listening on:           port ${port}, every address (0.0.0.0)"
  echo "    Open it at:             http://<this machine's IP>:${port}   (right now: http://${ip:-?}:${port})"
  echo "    Data:                   ${APP_DIR}/data"
  echo "    Settings:               ${APP_DIR}/config.json  (then: systemctl restart ${SERVICE})"
  echo "    Logs:                   journalctl -u ${SERVICE} -f"
  echo "    Update later:           run the same install command again"
}

# ---------------------------------------------------------------- create an LXC on a Proxmox host
install_lxc() {
  command -v pct >/dev/null 2>&1 || die "pct not found — this is not a Proxmox VE host. Use MODE=here to install on this machine."
  local name="${CT_HOSTNAME:-netplanner}"
  local ctid="${CTID:-}"
  if [ -z "$ctid" ]; then
    # re-running updates the container made last time (found by its name)
    ctid="$(pct list 2>/dev/null | awk -v n="$name" 'NR>1 && $NF==n {print $1; exit}')"
    [ -n "$ctid" ] || ctid="$(pvesh get /cluster/nextid)"
  fi
  local storage="${STORAGE:-local-lvm}"
  local tstore="${TEMPLATE_STORAGE:-local}"

  if pct status "$ctid" >/dev/null 2>&1; then
    if pct exec "$ctid" -- test -f "$APP_DIR/netplanner_server.py" 2>/dev/null; then
      say "Container $ctid already runs Net Planner — updating it"
      pct status "$ctid" | grep -q running || pct start "$ctid"
      pct exec "$ctid" -- bash -c "curl -fsSL '$SELF_URL' | MODE=here VERSION='$VERSION' PORT='$PORT' PORT_GIVEN='${PORT_GIVEN:-0}' bash"
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

  # no address is set here: the container starts on DHCP on vmbr0,
  # and you change IP / VLAN / bridge in Proxmox (container → Network) whenever you like
  local net="name=eth0,bridge=vmbr0,ip=dhcp"

  say "Creating container $ctid ($name) on $storage (network: DHCP on vmbr0 — change it in Proxmox any time)"
  pct create "$ctid" "${tstore}:vztmpl/${tmpl}" \
    --hostname "$name" --cores "${CORES:-1}" --memory "${MEMORY:-512}" --swap 256 \
    --rootfs "${storage}:${DISK:-4}" --net0 "$net" \
    --unprivileged 1 --features nesting=1 --onboot 1 \
    --description "Net Planner — website and server on port ${PORT}. https://github.com/${REPO}" >/dev/null
  pct start "$ctid"

  say "Waiting for the container to get on the network"
  local ok=0
  for _ in $(seq 1 60); do
    if pct exec "$ctid" -- bash -c "getent hosts deb.debian.org >/dev/null && ip route | grep -q default" 2>/dev/null; then ok=1; break; fi
    sleep 2
  done
  [ "$ok" = 1 ] || die "Container $ctid has no internet access yet. Fix its network in Proxmox (container $ctid → Network), then run this same command again."

  say "Installing Net Planner inside container $ctid"
  pct exec "$ctid" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null && curl -fsSL '$SELF_URL' | MODE=here VERSION='$VERSION' PORT='$PORT' PORT_GIVEN=1 bash"

  local ip; ip="$(pct exec "$ctid" -- hostname -I 2>/dev/null | awk '{print $1}')"
  echo
  say "Done. Net Planner runs in container $ctid ($name), port ${PORT}, on every address."
  echo "    Right now it got http://${ip:-?}:${PORT} from DHCP."
  echo "    To set its address: Proxmox → container $ctid → Network → edit net0 (Static IP, gateway, VLAN tag)."
  echo "      Net Planner follows the new address by itself — no reinstall."
  echo "    In the iPhone / Mac app: More → Link with your Mac / website → http://<its IP>:${PORT}"
  echo "    Update later:    run the same command again on this Proxmox host"
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
