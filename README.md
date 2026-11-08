# Net Planner

Plan and run a homelab or small network: racks, devices, VMs, VLANs, switch ports and configs, live status lights, Proxmox and TrueNAS sync, IoT discovery, and an iPhone / iPhone Duo / Mac app that scans device labels at the rack.

## Install on Proxmox (one command)

Run this in the **Proxmox host shell** (node → Shell). It creates a small Debian 12 container and installs Net Planner in it: the website and the server are the same install.

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/OGflo/net-planner/main/install.sh)"
```

When it finishes it prints the address, e.g. `http://10.0.10.42:8770`. Open it in a browser, and enter it in the iPhone / Mac app under **More → Link with your Mac / website**.

Put the settings you want **in front of** the command:

```bash
VLAN=10 IP=10.0.10.20/24 GW=10.0.10.1 bash -c "$(curl -fsSL https://raw.githubusercontent.com/OGflo/net-planner/main/install.sh)"
```

| Setting | Default | Meaning |
|---|---|---|
| `VLAN` | none | VLAN tag for the container (e.g. your MGMT VLAN) |
| `IP` / `GW` | DHCP | Static address and gateway |
| `CTID` | next free | Container ID |
| `BRIDGE` / `STORAGE` | `vmbr0` / `local-lvm` | Network bridge and disk storage |
| `PORT` | `8770` | Web port |
| `VERSION` | `latest` | A release tag such as `v2.0` |

**Update:** run the same command again. It finds the container and updates it; your plan and `config.json` are kept.

Inside any existing Debian/Ubuntu machine, LXC or VM the same command installs Net Planner right there (`MODE=here`).

## Other ways to install

Download `NetPlanner-Server.zip` from the [latest release](../../releases/latest):

```bash
curl -LO https://github.com/OGflo/net-planner/releases/latest/download/NetPlanner-Server.zip
unzip NetPlanner-Server.zip && cd NetPlanner-Server
```

| Where | How |
|---|---|
| Mac | double-click `install-mac.command` (starts at login) |
| Windows | double-click `install-windows.bat` |
| Linux | `sh start-linux.sh` |
| Docker | `docker compose up -d --build` |

Needs Python 3.8+ only. See `server/README.txt` for settings.

## What's in here

| Folder | What it is |
|---|---|
| `web/` | The planner itself. Bundled into every app and served by the server. |
| `server/` | Python server: live plan with merging sync, status checks, Proxmox/TrueNAS API, network scan, phone inbox. |
| `ios/` | Xcode project for the iPhone, iPad and Mac app, plus Control Center buttons. |
| `install.sh` | One-command installer for Proxmox and Debian/Ubuntu. |
| `build-server-zip.sh` | Builds `dist/NetPlanner-Server.zip`. |

## Security

The server has no login by default and anyone who can reach port 8770 can edit the plan. Keep it on your LAN, set `"token"` in `config.json`, or put it behind your VPN / zero-trust proxy. Never port-forward it.
