#!/usr/bin/env python3
"""
Net Planner server — the website behind the Net Planner apps.

* Hosts the Net Planner website and stores the live plan (data/state.netplan).
* Merges edits from the Mac, iPhone/iPad and browsers (no silent overwrites).
* Receives .netplan files sent from phones (inbox).
* Checks every device in the background (ping or TCP port) for live status lights.
* Talks to Proxmox VE and TrueNAS with API tokens kept on this server.
* Scans a subnet to discover IoT and other devices.

Only needs Python 3.8+ (standard library). Nothing to pip install.

    python3 netplanner_server.py              # start and open the browser
    python3 netplanner_server.py --no-browser # start quietly (installers, Docker, systemd)

Settings live in config.json next to this file. Environment overrides:
NETPLANNER_PORT, NETPLANNER_HOST, NETPLANNER_DATA, NETPLANNER_INTERVAL.
"""
import ipaddress
import json
import os
import platform
import re
import socket
import ssl
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
import webbrowser
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutTimeout
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

VERSION = "2.0"
ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, "web")
if not os.path.isdir(WEB):  # running from the source folder
    WEB = os.path.join(os.path.dirname(ROOT), "web")
CONFIG_PATH = os.path.join(ROOT, "config.json")
DEFAULTS = {
    "name": "Net Planner server",
    "host": "0.0.0.0",          # 0.0.0.0 = reachable from phones on your network; 127.0.0.1 = this computer only
    "port": 8770,
    "token": "",                # set a value to require it from every phone/browser (X-NetPlanner-Token)
    "history": 100,             # how many old versions of the plan to keep
    "data_dir": "data",
    "monitor_interval": 30,     # seconds between background status checks (0 = off)
    "monitor_timeout": 1.0,     # seconds to wait per device
}
MAX_BODY = 25 * 1024 * 1024
IP_RE = re.compile(r"^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$")
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
        ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
        ".netplan": "application/x-netplan+json"}
LOCK = threading.Lock()
SYSTEM = platform.system()


def load_config():
    cfg = dict(DEFAULTS)
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, encoding="utf-8") as f:
                cfg.update(json.load(f))
        except Exception as e:  # keep running with defaults rather than dying on a typo
            print("! config.json could not be read (%s); using defaults" % e)
    else:
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(DEFAULTS, f, indent=2)
        except OSError:
            pass
    for env, key, cast in (("NETPLANNER_HOST", "host", str), ("NETPLANNER_DATA", "data_dir", str),
                           ("NETPLANNER_INTERVAL", "monitor_interval", int)):
        if os.environ.get(env):
            cfg[key] = cast(os.environ[env])
    return cfg


CFG = load_config()
DATA = CFG["data_dir"] if os.path.isabs(CFG["data_dir"]) else os.path.join(ROOT, CFG["data_dir"])
STATE = os.path.join(DATA, "state.netplan")
HISTORY = os.path.join(DATA, "history")
INBOX = os.path.join(DATA, "inbox")
INTEG_PATH = os.path.join(DATA, "integrations.json")
for d in (DATA, HISTORY, INBOX):
    os.makedirs(d, exist_ok=True)


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def write_atomic(path, text):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


def read_json(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def valid_plan(doc):
    return isinstance(doc, dict) and doc.get("format") == "netplanner" and isinstance(doc.get("data"), dict)


def counts(doc):
    d = doc.get("data", {})
    return {k: len(d.get(k) or []) for k in ("racks", "devices", "vms", "vlans", "ports")}


# ======================================================================
# Checks: ping and TCP
# ======================================================================
def ping(ip, count=1, timeout=1.0):
    """Return (ok, ms). ok is None when ping can't run."""
    if SYSTEM == "Windows":
        cmd = ["ping", "-n", str(count), "-w", str(int(timeout * 1000)), ip]
    elif SYSTEM == "Darwin":
        cmd = ["ping", "-c", str(count), "-W", str(int(timeout * 1000)), ip]
    else:
        cmd = ["ping", "-c", str(count), "-W", str(max(1, round(timeout))), ip]
    kw = {"creationflags": 0x08000000} if SYSTEM == "Windows" else {}
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout * count + 3, **kw)
    except FileNotFoundError:
        return None, ""
    except Exception:
        return False, ""
    out = p.stdout or ""
    up = p.returncode == 0 and (SYSTEM != "Windows" or "TTL=" in out.upper())
    if not up:
        return False, ""
    m = re.search(r"=\s*[\d.]+/([\d.]+)/", out) or re.search(r"time[=<]\s*([\d.]+)\s*ms", out, re.I)
    return True, (round(float(m.group(1)), 1) if m else "")


def tcp(ip, port, timeout=1.0):
    """Return (state, ms, detail)."""
    t0 = time.monotonic()
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return "up", round((time.monotonic() - t0) * 1000, 1), "TCP %d open" % port
    except ConnectionRefusedError:
        return "down", "", "TCP %d refused (host up, service down)" % port
    except socket.timeout:
        return "down", "", "TCP %d timed out" % port
    except OSError as e:
        return "down", "", "TCP %d: %s" % (port, e.strerror or e)


def check_target(ip, method, timeout):
    method = (method or "ping").strip().lower()
    if not ip or method == "none":
        return {"state": "none", "detail": "not checked" if ip else "no IP"}
    if not IP_RE.match(ip):
        try:
            ip = socket.gethostbyname(ip)
        except OSError:
            return {"state": "down", "detail": "name does not resolve"}
    if method.startswith("tcp:"):
        try:
            port = int(method.split(":", 1)[1])
        except ValueError:
            return {"state": "none", "detail": "bad TCP port"}
        st, ms, detail = tcp(ip, port, timeout)
        return {"state": st, "ms": ms, "detail": detail}
    ok, ms = ping(ip, 1, timeout)
    if ok is None:
        return {"state": "none", "detail": "ping is not installed on the server"}
    return {"state": "up" if ok else "down", "ms": ms, "detail": "ping reply" if ok else "no ping reply"}


POOL = ThreadPoolExecutor(max_workers=64)
PORT_POOL = ThreadPoolExecutor(max_workers=96)  # separate pool: port probes run inside POOL tasks
STATUS = {"checked": 0, "interval": 0, "items": {}, "ext": {}, "integrations": {}}
STATUS_LOCK = threading.Lock()
RUN_LOCK = threading.Lock()


def monitor_targets():
    doc = read_json(STATE, {}) or {}
    d = doc.get("data") or {}
    out = []
    for dev in d.get("devices") or []:
        ip = str(dev.get("mgmtIp") or "").strip()
        if dev.get("id") and ip:
            out.append((dev["id"], ip, dev.get("check") or "ping"))
    for vm in d.get("vms") or []:
        ip = str(vm.get("ip") or "").strip()
        if vm.get("id") and ip:
            out.append((vm["id"], ip, vm.get("check") or "ping"))
    return out


def run_checks():
    with RUN_LOCK:
        timeout = float(CFG.get("monitor_timeout", 1.0))
        targets = monitor_targets()
        results = list(POOL.map(lambda t: check_target(t[1], t[2], timeout), targets))
        now = time.time()
        with STATUS_LOCK:
            fresh = {}
            for (ident, ip, method), res in zip(targets, results):
                prev = STATUS["items"].get(ident, {})
                res["checked"] = now
                res["target"] = ip
                res["since"] = prev.get("since", now) if prev.get("state") == res["state"] else now
                res["lastUp"] = now if res["state"] == "up" else prev.get("lastUp")
                fresh[ident] = res
            STATUS["items"] = fresh
            STATUS["checked"] = now
        poll_integrations()


def monitor_loop():
    while True:
        interval = int(CFG.get("monitor_interval", 30))
        if interval > 0:
            try:
                run_checks()
            except Exception as e:  # keep the loop alive no matter what
                print("status check failed:", e)
        time.sleep(max(5, interval or 60))


def status_payload():
    with STATUS_LOCK:
        return {"interval": CFG.get("monitor_interval"), "checked": STATUS["checked"],
                "items": dict(STATUS["items"]), "ext": dict(STATUS["ext"]), "integrations": dict(STATUS["integrations"])}


# ======================================================================
# Integrations: Proxmox VE and TrueNAS
# ======================================================================
INTEG_LOCK = threading.Lock()
PREFIX = {"proxmox": "/api2/json/", "truenas": "/api/v2.0/"}


def load_integrations():
    return read_json(INTEG_PATH, []) or []


def save_integrations(items):
    write_atomic(INTEG_PATH, json.dumps(items, indent=1))
    try:
        os.chmod(INTEG_PATH, 0o600)
    except OSError:
        pass


def public_integration(i):
    out = {k: i.get(k) for k in ("id", "type", "name", "url", "tokenId", "verifyTls")}
    out.update(hasSecret=bool(i.get("secret")), remote=True)
    return out


def integ_request(i, path, timeout=12):
    """GET an integration API path and return parsed JSON."""
    url = i["url"].rstrip("/") + path
    headers = {"Accept": "application/json"}
    if i["type"] == "proxmox":
        headers["Authorization"] = "PVEAPIToken=%s=%s" % (i.get("tokenId", ""), i.get("secret", ""))
    else:
        headers["Authorization"] = "Bearer %s" % i.get("secret", "")
    ctx = None
    if url.startswith("https") and not i.get("verifyTls"):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return json.loads(r.read().decode("utf-8") or "null")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError("%s returned HTTP %d %s" % (i.get("name") or i["type"], e.code, body.strip()))
    except urllib.error.URLError as e:
        raise RuntimeError("Cannot reach %s: %s" % (i["url"], e.reason))


def poll_integrations():
    """Live status for Proxmox nodes/guests/storage and TrueNAS pools/VMs/apps."""
    items = load_integrations()
    ext, info = {}, {}
    for i in items:
        iid = i["id"]
        try:
            if i["type"] == "proxmox":
                res = (integ_request(i, "/api2/json/cluster/resources") or {}).get("data") or []
                for r in res:
                    t = r.get("type")
                    if t == "node":
                        ext["%s:node/%s" % (iid, r.get("node"))] = {"state": "up" if r.get("status") == "online" else "down", "detail": r.get("status"),
                                                                   "cpu": r.get("cpu"), "mem": r.get("mem"), "maxmem": r.get("maxmem"), "uptime": r.get("uptime")}
                    elif t in ("qemu", "lxc"):
                        st = r.get("status")
                        ext["%s:%s/%s" % (iid, t, r.get("vmid"))] = {"state": "up" if st == "running" else "off", "detail": st,
                                                                      "cpu": r.get("cpu"), "mem": r.get("mem"), "maxmem": r.get("maxmem"), "uptime": r.get("uptime")}
                    elif t == "storage":
                        ext["%s:%s/storage/%s" % (iid, r.get("node"), r.get("storage"))] = {"state": "up" if r.get("status") == "available" else "down",
                                                                                            "detail": r.get("status"), "used": r.get("disk"), "size": r.get("maxdisk")}
            elif i["type"] == "truenas":
                integ_request(i, "/api/v2.0/system/info")
                ext["%s:system" % iid] = {"state": "up", "detail": "API reachable"}
                for p in integ_request(i, "/api/v2.0/pool") or []:
                    ext["%s:pool/%s" % (iid, p.get("name"))] = {"state": "up" if p.get("healthy") else "down", "detail": p.get("status"),
                                                                "used": p.get("allocated"), "size": p.get("size")}
                for path, key in (("/api/v2.0/vm", "vm"), ("/api/v2.0/app", "app")):
                    try:
                        for v in integ_request(i, path) or []:
                            st = (v.get("status") or {}).get("state") if isinstance(v.get("status"), dict) else v.get("state")
                            ident = v.get("id") if key == "vm" else v.get("name")
                            ext["%s:%s/%s" % (iid, key, ident)] = {"state": "up" if str(st).upper() == "RUNNING" else "off", "detail": st}
                    except Exception:
                        pass
            info[iid] = {"ok": True, "checked": time.time()}
        except Exception as e:
            info[iid] = {"ok": False, "error": str(e), "checked": time.time()}
            if i["type"] == "truenas":
                ext["%s:system" % iid] = {"state": "down", "detail": str(e)}
    with STATUS_LOCK:
        STATUS["ext"] = ext
        STATUS["integrations"] = info


# ======================================================================
# Discovery: ping sweep + ARP + reverse DNS + common ports
# ======================================================================
SCAN_PORTS = [22, 80, 443, 445, 554, 1883, 3389, 5000, 5001, 8006, 8007, 8080, 8123, 9100, 32400]


def arp_table():
    table = {}
    try:
        if SYSTEM == "Linux" and os.path.exists("/proc/net/arp"):
            with open("/proc/net/arp") as f:
                for line in f.readlines()[1:]:
                    p = line.split()
                    if len(p) >= 4 and p[3] != "00:00:00:00:00:00":
                        table[p[0]] = p[3].upper()
            return table
        cmd = ["arp", "-a"] if SYSTEM == "Windows" else ["arp", "-an"]
        kw = {"creationflags": 0x08000000} if SYSTEM == "Windows" else {}
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=8, **kw).stdout
        for line in out.splitlines():
            m = re.search(r"\(?(\d+\.\d+\.\d+\.\d+)\)?\s+(?:at\s+)?([0-9a-fA-F]{1,2}(?:[:-][0-9a-fA-F]{1,2}){5})", line)
            if m:
                mac = ":".join(x.zfill(2) for x in re.split("[:-]", m.group(2))).upper()
                if mac not in ("FF:FF:FF:FF:FF:FF", "00:00:00:00:00:00"):
                    table[m.group(1)] = mac
    except Exception:
        pass
    return table


def rdns(ip):
    try:
        return socket.gethostbyaddr(ip)[0]
    except OSError:
        return ""


def open_ports(ip):
    def one(port):
        try:
            with socket.create_connection((ip, port), timeout=0.5):
                return port
        except OSError:
            return None
    return [p for p in PORT_POOL.map(one, SCAN_PORTS) if p]


def discover(cidr, probe_ports=True):
    net = ipaddress.ip_network(cidr, strict=False)
    if net.version != 4 or net.num_addresses > 1024:
        raise ValueError("Use an IPv4 subnet of /22 or smaller")
    hosts = [str(h) for h in (net.hosts() if net.num_addresses > 2 else net)]
    pings = dict(zip(hosts, POOL.map(lambda h: ping(h, 1, 1.0), hosts)))
    arp = arp_table()
    alive = [h for h in hosts if (pings[h][0]) or h in arp]
    found = []
    for h in alive:
        fut = POOL.submit(rdns, h)
        try:
            name = fut.result(timeout=1.5)
        except FutTimeout:
            name = ""
        found.append({"ip": h, "mac": arp.get(h, ""), "hostname": name, "ms": pings[h][1], "ping": bool(pings[h][0])})
    if probe_ports:
        for f, ports in zip(found, POOL.map(lambda f: open_ports(f["ip"]), found)):
            f["ports"] = ports
    return found


# ======================================================================
# HTTP
# ======================================================================
class Handler(BaseHTTPRequestHandler):
    server_version = "NetPlanner/" + VERSION

    def log_message(self, fmt, *args):
        line = args[0] if args else ""
        if any(x in str(line) for x in ("/api/health", "/api/status")):
            return
        sys.stdout.write("%s  %s\n" % (datetime.now().strftime("%H:%M:%S"), fmt % args))

    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-NetPlanner-Token, X-NetPlanner-Client")
        self.send_header("Access-Control-Max-Age", "600")

    def send_json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.cors()
        self.end_headers()
        self.wfile.write(body)

    def error(self, code, msg):
        self.send_json({"error": msg}, code)

    def body_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ValueError("File is too large")
        raw = self.rfile.read(n) if n else b"{}"
        return json.loads(raw.decode("utf-8"))

    def authorized(self):
        tok = CFG.get("token") or ""
        return not tok or self.headers.get("X-NetPlanner-Token", "") == tok

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def route(self, method):
        u = urlparse(self.path)
        path = unquote(u.path)
        self.query = parse_qs(u.query)
        if not path.startswith("/api/"):
            if method != "GET":
                return self.error(405, "Method not allowed")
            return self.static(path)
        if path == "/api/health":
            doc = read_json(STATE, {}) or {}
            return self.send_json({"app": "netplanner", "version": VERSION, "name": CFG.get("name"),
                                   "updated": doc.get("updated"), "tokenRequired": bool(CFG.get("token")),
                                   "ping": True, "monitor": CFG.get("monitor_interval"), "features": ["merge", "status", "integrations", "discover"]})
        if not self.authorized():
            return self.error(401, "Wrong or missing token")
        try:
            if path == "/api/state":
                return self.api_state(method)
            if path == "/api/status" and method == "GET":
                return self.send_json(status_payload())
            if path == "/api/check" and method == "POST":
                run_checks()
                return self.send_json(status_payload())
            if path == "/api/inbox":
                return self.api_inbox(method)
            if path.startswith("/api/inbox/"):
                return self.api_inbox_item(method, path[len("/api/inbox/"):])
            if path == "/api/ping" and method == "POST":
                return self.api_ping()
            if path == "/api/discover" and method == "POST":
                body = self.body_json()
                return self.send_json({"hosts": discover(str(body.get("cidr", "")), bool(body.get("ports", True)))})
            if path == "/api/integrations" or path.startswith("/api/integrations/"):
                return self.api_integrations(method, path[len("/api/integrations"):].strip("/"))
            if path == "/api/history" and method == "GET":
                files = sorted(os.listdir(HISTORY), reverse=True)
                return self.send_json([f for f in files if f.endswith(".netplan")])
        except ValueError as e:
            return self.error(400, str(e))
        except RuntimeError as e:
            return self.error(502, str(e))
        return self.error(404, "Not found")

    do_GET = lambda self: self.route("GET")
    do_POST = lambda self: self.route("POST")
    do_PUT = lambda self: self.route("PUT")
    do_DELETE = lambda self: self.route("DELETE")

    # --- the live plan (with conflict detection so devices merge instead of overwrite) ---
    def api_state(self, method):
        if method == "GET":
            doc = read_json(STATE)
            if not doc:
                return self.send_json({"updated": None, "data": None})
            return self.send_json({"updated": doc.get("updated"), "data": doc.get("data"), "by": doc.get("by")})
        if method == "PUT":
            doc = self.body_json()
            if not valid_plan(doc):
                return self.error(400, "Not a Net Planner plan")
            base = doc.pop("baseUpdated", None)
            force = doc.pop("force", False)
            with LOCK:
                cur = read_json(STATE)
                if cur and not force and base is not None and base != cur.get("updated"):
                    # someone else saved since this client last synced: hand back the newer plan to merge
                    return self.send_json({"error": "conflict", "updated": cur.get("updated"), "data": cur.get("data")}, 409)
                if cur:
                    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
                    os.replace(STATE, os.path.join(HISTORY, "state-%s.netplan" % stamp))
                    old = sorted(f for f in os.listdir(HISTORY) if f.endswith(".netplan"))
                    for f in old[:-max(1, int(CFG.get("history", 100)))]:
                        os.remove(os.path.join(HISTORY, f))
                doc["updated"] = now_iso()
                doc["by"] = self.headers.get("X-NetPlanner-Client", "")[:60]
                write_atomic(STATE, json.dumps(doc))
            return self.send_json({"ok": True, "updated": doc["updated"]})
        return self.error(405, "Method not allowed")

    # --- inbox: plans sent from phones ---
    def api_inbox(self, method):
        if method == "GET":
            items = []
            for f in sorted(os.listdir(INBOX), reverse=True):
                if not f.endswith(".netplan"):
                    continue
                doc = read_json(os.path.join(INBOX, f))
                if not doc:
                    continue
                items.append({"id": f[:-8], "label": doc.get("label") or "", "source": doc.get("source") or "",
                              "exported": doc.get("exported"), "received": doc.get("received"), "counts": counts(doc)})
            return self.send_json(items)
        if method == "POST":
            doc = self.body_json()
            if not valid_plan(doc):
                return self.error(400, "Not a Net Planner plan")
            doc["received"] = now_iso()
            ident = datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
            write_atomic(os.path.join(INBOX, ident + ".netplan"), json.dumps(doc))
            print("  ↳ received plan in inbox: %s (%s)" % (doc.get("label") or ident, doc.get("source")))
            return self.send_json({"ok": True, "id": ident})
        return self.error(405, "Method not allowed")

    def api_inbox_item(self, method, ident):
        if not ID_RE.match(ident):
            return self.error(400, "Bad id")
        path = os.path.join(INBOX, ident + ".netplan")
        if not os.path.exists(path):
            return self.error(404, "Not found")
        if method == "GET":
            return self.send_json(read_json(path))
        if method == "DELETE":
            os.remove(path)
            return self.send_json({"ok": True})
        return self.error(405, "Method not allowed")

    # --- real ICMP ping from this computer ---
    def api_ping(self):
        body = self.body_json()
        targets = [t.strip() for t in (body.get("targets") or []) if isinstance(t, str) and IP_RE.match(t.strip())]
        targets = list(dict.fromkeys(targets))[:256]

        def one(ip):
            ok, ms = ping(ip, 2, 1.5)
            return {"ip": ip, "status": "up" if ok else "down", "ms": ms if ok else ""}
        return self.send_json({"results": list(POOL.map(one, targets))})

    # --- integrations (secrets never leave this server) ---
    def api_integrations(self, method, rest):
        with INTEG_LOCK:
            items = load_integrations()
            if not rest:
                if method == "GET":
                    return self.send_json([public_integration(i) for i in items])
                if method == "POST":
                    b = self.body_json()
                    i = self.clean_integration(b, {"id": "%s-%s" % (b.get("type", "x"), uuid.uuid4().hex[:6])})
                    items.append(i)
                    save_integrations(items)
                    return self.send_json(public_integration(i))
                return self.error(405, "Method not allowed")
            parts = rest.split("/", 1)
            ident, action = parts[0], (parts[1] if len(parts) > 1 else "")
            i = next((x for x in items if x["id"] == ident), None)
            if not i:
                return self.error(404, "No such integration")
            if not action:
                if method == "PUT":
                    i.update(self.clean_integration(self.body_json(), i))
                    save_integrations(items)
                    return self.send_json(public_integration(i))
                if method == "DELETE":
                    save_integrations([x for x in items if x["id"] != ident])
                    return self.send_json({"ok": True})
                return self.error(405, "Method not allowed")
        if action == "get" and method == "GET":
            p = (self.query.get("path") or [""])[0]
            if not p.startswith(PREFIX[i["type"]]) or ".." in p or not re.match(r"^[A-Za-z0-9_/.\-?=&%:,+]*$", p):
                return self.error(400, "Path not allowed")
            return self.send_json({"data": integ_request(i, p)})
        return self.error(404, "Not found")

    @staticmethod
    def clean_integration(b, base):
        t = b.get("type", base.get("type"))
        if t not in PREFIX:
            raise ValueError("type must be proxmox or truenas")
        url = str(b.get("url", base.get("url", ""))).strip().rstrip("/")
        if not re.match(r"^https?://[^\s/]+(:\d+)?$", url):
            raise ValueError("URL must look like https://10.0.10.5:8006 (no path)")
        out = dict(base)
        out.update({"type": t, "name": str(b.get("name") or base.get("name") or t)[:60], "url": url,
                    "tokenId": str(b.get("tokenId", base.get("tokenId", "")))[:120], "verifyTls": bool(b.get("verifyTls", base.get("verifyTls", False)))})
        if b.get("secret"):
            out["secret"] = str(b["secret"])[:300]
        return out

    # --- website files ---
    def static(self, path):
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        full = os.path.realpath(os.path.join(WEB, rel))
        if not full.startswith(os.path.realpath(WEB) + os.sep) or not os.path.isfile(full):
            return self.error(404, "Not found")
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(os.path.splitext(full)[1].lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # no packet is sent; just picks the outgoing interface
        return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()


def main():
    try:
        sys.stdout.reconfigure(line_buffering=True)  # show log lines immediately (launchd / log files)
    except Exception:
        pass
    host = CFG["host"]
    port = int(os.environ.get("NETPLANNER_PORT") or os.environ.get("PORT") or CFG["port"])
    try:
        httpd = ThreadingHTTPServer((host, port), Handler)
    except OSError as e:
        print("Could not start on port %d (%s). Is Net Planner already running? Change \"port\" in config.json." % (port, e))
        sys.exit(1)
    local = "http://localhost:%d" % port
    print("Net Planner server %s" % VERSION)
    print("  On this computer:  %s" % local)
    ip = lan_ip()
    if host in ("0.0.0.0", "") and ip:
        print("  From your phone:   http://%s:%d   (enter this in the app: Import / Export → Server)" % (ip, port))
    print("  Data folder:       %s" % DATA)
    print("  Status checks:     every %ss" % CFG.get("monitor_interval"))
    if CFG.get("token"):
        print("  Access token is required (see config.json)")
    print("Press Ctrl+C to stop.\n")
    threading.Thread(target=monitor_loop, daemon=True).start()
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(local)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
