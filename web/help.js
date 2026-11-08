/* Net Planner — "How to use" guide (More → How to use on iPhone, How to use tab on Mac / web). */
function helpHtml(){
  const S_=(title,body,open)=>`<details class="help"${open?' open':''}><summary>${title}</summary><div class="hb">${body}</div></details>`;
  const addr=SV.linked&&svBase()?svBase():'http://&lt;your Mac’s address&gt;:8770';
  return `<div class="helpwrap">
  <p class="muted small" style="margin-top:0">Net Planner runs on iPhone, iPad, Mac and in any browser. Every copy can do everything; linked together, the Mac is your main desk and the iPhone is your scanner at the rack. Tap a topic to open it.</p>

  ${S_('🚀 Getting started',`
    <ol>
      <li><b>On its own:</b> just start adding things. Your plan is saved on this device automatically${NATIVE&&PLATFORM!=='mac'?' (and shows in the Files app under <i>On My iPhone → Net Planner</i>)':''}.</li>
      <li><b>With your Mac:</b> the Net Planner server runs on the Mac. On the iPhone go to <b>More → Link with your Mac / website</b>, enter <span class="mono">${addr}</span> and tap <b>Turn on live sync</b>. Allow <i>Local Network</i> when asked.</li>
      <li>First time linking, choose <b>Use server plan</b> so the phone matches the Mac (or <b>Merge</b> to add what's on the phone).</li>
      <li>Want to look around first? <b>Import / Export → Load demo network</b> fills in a sample setup. <b>Erase everything</b> clears it.</li>
    </ol>`,true)}

  ${S_('📷 Scan & add (iPhone at the rack)',`
    <ol>
      <li>Tap <b>Scan a label or barcode</b> and point the camera at the sticker (service tag, serial, MAC or model label).</li>
      <li>Highlighted text and barcodes are what it can read. <b>Tap the lines you want</b>, then tap <b>Use</b>. (Tap nothing and it uses everything on screen.)</li>
      <li>It shows what it found: the model with its specs, serial, MAC (and the likely maker), IP and asset tag.</li>
      <li>If the serial, MAC or IP is already in your plan, tap that device to <b>update it</b>. Otherwise tap <b>Add as new device</b> — the form comes pre-filled. Check it and tap <b>Save</b>.</li>
    </ol>
    <p><b>No label?</b> Type a model in <b>Or type it</b> (e.g. <i>R740</i>, <i>2960X-48LPS</i>, <i>U6 Pro</i>) and pick a suggestion.</p>
    <p class="muted">The Mac and simulator can't use the live camera — they let you take or choose a photo of the label instead and read it the same way.</p>`)}

  ${S_('📱 iPhone Duo: open, closed &amp; Control Center',`
    <ul>
      <li><b>Open:</b> field mode splits in two — lists on the left, the details, rack or guide on the right. Tap a device on the left to see it on the right.</li>
      <li><b>Closed:</b> the cover screen becomes the scanner. <b>The camera only works with the Duo closed</b> — if you tap Scan (or an empty rack U) while it's open, it waits for you to fold it, then opens the camera by itself and drops the device into that slot.</li>
      <li><b>Status glance</b> (closed only): giant up / down / stopped counts and every device that's down. Your Duo <b>buzzes</b> when something new stops answering while it's closed.</li>
      <li>Open it again after a scan and the result is waiting on the right side.</li>
      <li><b>Control Center buttons:</b> open Control Center → long-press an empty spot (or tap +) → <b>Add a Control</b> → search “Net Planner”. Pick <b>Scan Label</b>, <b>Net Status</b>, <b>Check Now</b> or <b>Find Device</b>. They also work on the Lock Screen and the Action button.</li>
    </ul>`)}

  ${S_('🗄 Walk a rack',`
    <ul>
      <li><b>Racks</b> tab → pick a rack at the top. Devices show at their U position with a live status light.</li>
      <li><b>Tap a device</b> for its details: status, IP, MAC, serial, rack position, cabling and notes. From there <b>Edit</b> it or <b>Scan into this</b> to add the serial/MAC from its label.</li>
      <li><b>Tap an empty U</b> to put something there: scan the device going in, type it, or place one you added earlier that isn't racked yet. The scanned device lands in that exact slot.</li>
      <li>On the Mac (full planner → Racks) you can also <b>drag</b> devices between slots and racks, or onto “Unplaced devices” to un-rack them.</li>
    </ul>`)}

  ${S_('🔎 Find anything',`
    <p>The <b>Find</b> tab searches names, IPs, MACs, serials, models, roles, asset tags, locations and VLANs across devices, VMs and storage. Anything that's down is listed first. Tap a result for its details.</p>`)}

  ${S_('● Live status',`
    <ul>
      <li>Green = answering. Red (blinking) = not answering. Grey = stopped (a VM that's off). Hollow = not checked (no IP, or check set to none).</li>
      <li><b>Linked to the server:</b> the server pings or connects to every device every 30 seconds, and Proxmox/TrueNAS report VM, container and pool health. The header shows <b>“N down”</b>.</li>
      <li><b>Phone on its own:</b> checks from the phone every minute with a quick connection test (iPhones can't send real pings).</li>
      <li>Each device's <b>Health check</b> field decides how it's checked: <span class="mono">ping</span> (default), <span class="mono">tcp:PORT</span> for gear that ignores ping (e.g. <span class="mono">tcp:8006</span> Proxmox, <span class="mono">tcp:443</span> pfSense/TrueNAS, <span class="mono">tcp:554</span> cameras), or <span class="mono">none</span>.</li>
      <li>Tap <b>Check now</b> to run a round immediately.</li>
    </ul>`)}

  ${S_('🔗 Working with the Mac and website',`
    <ul>
      <li><b>Live sync</b> keeps the iPhone, iPad, Mac and website on one plan. Edits merge item by item, so two people can work at once without overwriting each other. The Mac pops up what the phone just added.</li>
      <li><b>Send copy to inbox</b> drops a copy of your plan on the website for review instead of changing the live one (website → Import / Export → Inbox → Open… → Merge or Replace).</li>
      <li><b>Deploy as live plan</b> (full planner → Import / Export → Server) replaces the website's plan with yours. The server keeps old versions in its history folder.</li>
      <li><b>Pull from server</b> brings the website's plan onto this device.</li>
      <li>The Mac app finds the server on the same Mac by itself.</li>
    </ul>`)}

  ${S_('🖥 Full planner — every tool',`
    <p>On iPhone: <b>More → Full planner</b> (tap <b>📱 Field</b> at the top to come back). On Mac and the website it's the normal view.</p>
    <dl>
      <dt>Dashboard</dt><dd>Totals, rack and port usage, live status summary, recent changes from other devices, and problems: duplicate IPs, overlapping rack units, IPs outside their VLAN, unplaced devices, devices down.</dd>
      <dt>Map</dt><dd>Network map with live lights, like NetMap. Drag devices to arrange, scroll or pinch to zoom. <b>Connect</b> draws a cable between two devices. Click a VLAN to highlight everything that carries it. <b>Import NetMap</b> brings in a NetMap <span class="mono">map.json</span>.</dd>
      <dt>Status</dt><dd>Every device, VM and pool grouped by type, down first, plus Proxmox/TrueNAS connection health.</dd>
      <dt>Racks</dt><dd>Rack elevations: add racks, drag devices into U positions, click an empty slot to place or create a device.</dd>
      <dt>Devices</dt><dd>Servers, switches, routers, firewalls, storage, APs, cameras, IoT, PCs, PDUs, UPSes, patch panels. Each has model, role, serial, MAC, mgmt IP/VLAN, health check, rack position, ports, OS, CPU, RAM, location and notes.</dd>
      <dt>VMs</dt><dd>VMs, LXC containers and apps with their host, IP, VLAN and running state.</dd>
      <dt>Storage</dt><dd>Pools, datasets, shares and disks with size, used space and health.</dd>
      <dt>Ports</dt><dd>A picture of each switch's front panel. Click a port to set access/trunk/disabled, its VLAN and what it's cabled to. <b>Bulk configure</b> sets a range (e.g. ports 1–16 → VLAN 10).</dd>
      <dt>VLANs / IP</dt><dd>VLANs with subnet, gateway and color, how many IPs are used, and the <b>next free IP</b>.</dd>
      <dt>Integrations</dt><dd>Connect Proxmox and TrueNAS, and scan the network for IoT and unknown devices.</dd>
      <dt>Switch Config</dt><dd>Generates a ready-to-paste config (Cisco IOS, Aruba CX, or a plain list) from your ports and VLANs. Copy, download, or download all switches at once.</dd>
      <dt>Ping Tests</dt><dd>Ping from the server, a quick browser check, or download a Mac/Linux or Windows ping script and import its results.</dd>
      <dt>Import / Export</dt><dd>.netplan files, Excel/Google Sheets, CSV, server sync and inbox, demo and erase.</dd>
    </dl>`)}

  ${S_('🧠 Built-in hardware knowledge',`
    <p>Start typing a model in a device's <b>Model</b> field (or scan its label) and pick a suggestion. It fills in the type, maker, rack units, port count, interface names, management (iDRAC, iLO, IPMI…), CPU, RAM slots, PoE budget, uplinks, power and the right health check.</p>
    <p>It knows about 200 common models — Dell PowerEdge and Precision, HPE ProLiant, Lenovo, Supermicro, mini PCs, Cisco Catalyst, Aruba, Juniper, UniFi, MikroTik, Netgear, TP-Link, TRENDnet, pfSense/Netgate, FortiGate, Palo Alto, Synology, QNAP, TrueNAS, APC/CyberPower/Eaton UPSes and PDUs, UniFi/TP-Link APs, cameras and smart-home gear — and recognises model families it doesn't list one by one.</p>
    <p>For VMs, typing a name like <i>plex</i>, <i>homebridge</i> or <i>pihole</i> suggests the right port to check. MAC addresses show the likely maker. Specs are typical for the base model — check the unit in front of you.</p>`)}

  ${S_('🟧 Proxmox & TrueNAS',`
    <ol>
      <li>Full planner → <b>Integrations → + Proxmox VE</b> or <b>+ TrueNAS</b>.</li>
      <li><b>Proxmox:</b> in Proxmox go to Datacenter → Permissions → API Tokens → Add (e.g. user <i>root@pam</i>, ID <i>netplanner</i>), give it the read-only <b>PVEAuditor</b> role on <b>/</b>, and paste the Token ID (<span class="mono">root@pam!netplanner</span>) and secret. URL looks like <span class="mono">https://10.0.10.5:8006</span>.</li>
      <li><b>TrueNAS:</b> user icon → API Keys → Add (25.04+: Credentials → API Keys), paste the key. URL looks like <span class="mono">https://10.0.20.10</span>.</li>
      <li>Leave <i>Verify TLS</i> off for the default self-signed certificate. Tap <b>Save &amp; sync</b>.</li>
    </ol>
    <p>Sync adds or updates hosts, VMs and containers (with VLAN tag, MAC, IP and running state), storage, pools, datasets, shares, disks and apps. Your own notes and rack positions are kept. Sync again any time.</p>
    <p class="muted">Linked to the server: the token is stored only on the server and the server watches status around the clock. Phone on its own: the token is stored on the phone.</p>`)}

  ${S_('📡 IoT & network scan',`
    <ul>
      <li>Full planner → <b>Integrations → Network scan</b>. Pick a subnet (VLAN buttons fill it in) and tap <b>Scan</b>. Needs the server.</li>
      <li>It lists every device that answers, with its MAC, likely maker, hostname, open ports and a guess at what it is (Proxmox, Home Assistant, camera, MQTT, printer…), and whether it's already in your plan. Tick the ones to add.</li>
      <li>Smart-home gear without an IP (Zigbee, Z-Wave, Thread, Bluetooth): add it with type <i>iot</i>, health check <i>none</i>, and the hub in <b>Connects via</b>.</li>
      <li>The IoT checklist on that page covers VLANs, mDNS for HomeKit, and firewall rules so status lights work.</li>
    </ul>`)}

  ${S_('📁 Files, Excel & Google Sheets',`
    <ul>
      <li><b>.netplan</b> is the whole plan in one file. <b>Export</b> (iPhone: More → Export / share .netplan) opens the share sheet — AirDrop it, save to Files, mail it. Open a .netplan from Files/AirDrop/Mail and Net Planner asks to <b>Merge</b> or <b>Replace</b>. On the website, drag it onto the page.</li>
      <li><b>Excel workbook</b> (Import / Export): one tab each for racks, VLANs, devices, VMs, ports, storage, links and ping. Upload it to Google Sheets with File → Import. Edit it and import it back — rows match by name.</li>
      <li><b>Copy for Sheets</b> on any table copies it ready to paste into cell A1.</li>
      <li><b>CSV</b> for a single table; ping results from the scripts (or your own ping site) import as CSV too.</li>
    </ul>`)}

  ${S_('🛠 Tips & fixes',`
    <ul>
      <li><b>Phone won't link:</b> same Wi-Fi as the Mac? Local Network allowed (Settings → Net Planner)? The Mac's address can change — it's in <span class="mono">~/NetPlanner/server.log</span>.</li>
      <li><b>Everything shows down:</b> the server can only check what your firewall lets it reach. Allow ICMP (and the TCP ports you check) from the server to each VLAN.</li>
      <li><b>App won't open after a week:</b> apps installed from Xcode with a free Apple ID expire after 7 days. Reinstall from the Mac — your plan stays.</li>
      <li><b>Undo a big change:</b> the server keeps the last 100 versions in <span class="mono">~/NetPlanner/data/history</span>.</li>
      <li><b>Tap an item's lamp</b> (hover on Mac) to see exactly why it's up or down.</li>
    </ul>`)}
  </div>`;
}
function viewHelp(){return `<h2>How to use Net Planner</h2>${helpHtml()}`}
