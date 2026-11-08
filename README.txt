NET PLANNER
===========
web/       The planner website: index.html + kb.js (hardware knowledge), integ.js (status,
           Proxmox/TrueNAS, network scan), topo.js (map + NetMap import), field.js (iPhone field mode).
server/    Python backend: hosts the site, merges edits from every device, live status checks,
           Proxmox/TrueNAS API, subnet discovery, phone inbox. Also Dockerfile / LXC service.
ios/       One Xcode project → iPhone, iPad and Mac (Catalyst) app. Bundles web/ automatically.
dist/      NetPlanner-Server.zip — unpack on any computer (or a Proxmox LXC) and install.

Rebuild the zip after changing web/ or server/:   ./build-server-zip.sh
File format: .netplan (JSON) — works in the apps, the website and the server.
