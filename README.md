# Net Planner

Plan and run a homelab or small network: racks, devices, VMs, VLANs, switch ports and configs, live status lights, Proxmox and TrueNAS sync, IoT discovery, and an iPhone / iPhone Duo / Mac app that scans device labels at the rack.

## Install the server

Download `NetPlanner-Server.zip` from the [latest release](../../releases/latest) on any machine:

```bash
curl -LO https://github.com/OGflo/net-planner/releases/latest/download/NetPlanner-Server.zip
unzip NetPlanner-Server.zip && cd NetPlanner-Server
```

| Where | How |
|---|---|
| Mac | double-click `install-mac.command` (starts at login) |
| Windows | double-click `install-windows.bat` |
| Linux | `sh start-linux.sh` |
| Proxmox LXC (Debian 12) | copy to `/opt/netplanner`, `apt install -y python3 iputils-ping`, copy `netplanner.service` to `/etc/systemd/system/`, `systemctl enable --now netplanner` |
| Docker | `docker compose up -d --build` |

Then open `http://<server>:8770`. Needs Python 3.8+ only. See `server/README.txt` for settings.

## What's in here

| Folder | What it is |
|---|---|
| `web/` | The planner itself. Bundled into every app and served by the server. |
| `server/` | Python server: live plan with merging sync, status checks, Proxmox/TrueNAS API, network scan, phone inbox. |
| `ios/` | Xcode project for the iPhone, iPad and Mac app, plus Control Center buttons. |
| `build-server-zip.sh` | Builds `dist/NetPlanner-Server.zip`. |

## Security

The server has no login by default and anyone who can reach port 8770 can edit the plan. Keep it on your LAN, set `"token"` in `config.json`, or put it behind your VPN / zero-trust proxy. Never port-forward it.
