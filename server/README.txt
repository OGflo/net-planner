NET PLANNER SERVER
==================
The website behind the Net Planner apps. It keeps one shared live plan that the Mac,
iPhone, iPad and any browser edit together (changes merge, nothing is overwritten),
checks every device in the background for live status lights (ping or TCP port),
talks to Proxmox VE and TrueNAS, scans subnets for IoT devices, and receives
.netplan files sent from phones.
Needs Python 3 (already on most Macs; on Windows get it from python.org).

INSTALL (starts automatically at login)
  Mac:      double-click  install-mac.command      -> installs to ~/NetPlanner
  Windows:  double-click  install-windows.bat      -> installs to %LOCALAPPDATA%\NetPlanner
  Then open http://localhost:8770

ON PROXMOX (Debian 12 LXC, like NetMap)
  scp -r NetPlanner-Server root@<lxc-ip>:/opt/netplanner
  apt update && apt install -y python3 iputils-ping
  cp /opt/netplanner/netplanner.service /etc/systemd/system/
  systemctl daemon-reload && systemctl enable --now netplanner
  Browse to http://<lxc-ip>:8770. Put the LXC on your MGMT VLAN and allow ICMP
  (and any TCP ports you check) from it to the other VLANs in pfSense.

DOCKER
  docker compose up -d --build      (plan data in ./data)

JUST RUN IT (no install)
  Mac: start-mac.command   Windows: start-windows.bat   Linux: sh start-linux.sh

UNINSTALL
  uninstall-mac.command / uninstall-windows.bat  (your data folder is kept)

PHONE -> WEBSITE
  1. The server prints "From your phone: http://192.168.x.x:8770" (Mac: see ~/NetPlanner/server.log).
  2. In the app: Import / Export -> Server -> paste that address -> Test.
  3. "Send to inbox"   = drop a copy on the website for you to review (Import / Export -> Inbox).
     "Deploy as live plan" = replace the website's plan (old versions are kept in data/history).
     "Pull from server" = bring the website's plan onto the phone.
  You can also AirDrop / email a .netplan file and drag it onto the website.

LIVE STATUS
  Each device's "Health check" field: ping (default), tcp:PORT (e.g. tcp:8006 for
  Proxmox, tcp:443 for pfSense/TrueNAS) or none. Checks run every monitor_interval
  seconds. GET /api/status returns the results (handy for Home Assistant).

PROXMOX / TRUENAS
  Website -> Integrations. API tokens are stored only in data/integrations.json on
  this server (file permissions 600) and are never sent to browsers or phones.

SETTINGS (config.json)
  port   - default 8770
  host   - "0.0.0.0" lets phones connect; "127.0.0.1" = this computer only
  token  - set any password-like value to require it from every phone/browser
  history - how many old versions of the plan to keep
  monitor_interval - seconds between status checks (0 turns them off)
  monitor_timeout  - seconds to wait for each device

DATA
  data/state.netplan   the live plan
  data/history/        previous versions (copy one over state.netplan to roll back)
  data/inbox/          plans sent from phones
