import Foundation
import Network

/// Quick "is it up?" checks from the device itself (used when not linked to the server).
/// iOS can't send ICMP ping, so this opens a TCP connection: a reply — even "connection refused" — proves the host is alive.
enum Probe {
    static func run(_ targets: [[String: Any]]) async -> [[String: Any]] {
        await withTaskGroup(of: [String: Any].self) { group in
            var out: [[String: Any]] = []
            var pending = targets[...]
            func next() {
                guard let t = pending.popFirst() else { return }
                group.addTask { await one(t) }
            }
            for _ in 0..<min(24, targets.count) { next() }
            for await r in group { out.append(r); next() }
            return out
        }
    }

    private static func one(_ t: [String: Any]) async -> [String: Any] {
        let id = t["id"] as? String ?? ""
        let host = t["host"] as? String ?? ""
        let port = UInt16(clamping: (t["port"] as? Int) ?? 443)
        let strict = t["strict"] as? Bool ?? false
        guard !host.isEmpty, let p = NWEndpoint.Port(rawValue: port) else {
            return ["id": id, "state": "none", "detail": "no address"]
        }
        let start = Date()
        let result: (String, String) = await withCheckedContinuation { cont in
            let conn = NWConnection(host: NWEndpoint.Host(host), port: p, using: .tcp)
            let once = Once(conn: conn, cont: cont)
            conn.stateUpdateHandler = { state in
                switch state {
                case .ready: once.finish(("up", "TCP \(port) open"))
                case .waiting(let e), .failed(let e):
                    if Probe.refused(e) { once.finish(strict ? ("down", "TCP \(port) refused (host up, service down)") : ("up", "host answered")) }
                    else if case .failed = state { once.finish(("down", e.localizedDescription)) }
                default: break
                }
            }
            conn.start(queue: .global())
            DispatchQueue.global().asyncAfter(deadline: .now() + 2.5) { once.finish(("down", "no answer")) }
        }
        var r: [String: Any] = ["id": id, "state": result.0, "detail": result.1]
        if result.0 == "up" { r["ms"] = Int(Date().timeIntervalSince(start) * 1000) }
        return r
    }
}

extension Probe {
    static func refused(_ e: NWError) -> Bool { if case .posix(let c) = e { return c == .ECONNREFUSED }; return false }
    /// Resumes the continuation exactly once, whichever of connect / refuse / timeout happens first.
    final class Once: @unchecked Sendable {
        private let lock = NSLock()
        private var done = false
        private let conn: NWConnection
        private let cont: CheckedContinuation<(String, String), Never>
        init(conn: NWConnection, cont: CheckedContinuation<(String, String), Never>) { self.conn = conn; self.cont = cont }
        func finish(_ r: (String, String)) {
            lock.lock(); defer { lock.unlock() }
            if done { return }
            done = true
            conn.cancel()
            cont.resume(returning: r)
        }
    }
}

/// HTTP for integrations when the app talks to Proxmox / TrueNAS directly (no browser CORS, self-signed certs allowed when asked).
enum NativeHTTP {
    private final class TrustAll: NSObject, URLSessionDelegate {
        func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
            if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust, let trust = challenge.protectionSpace.serverTrust {
                completionHandler(.useCredential, URLCredential(trust: trust))
            } else {
                completionHandler(.performDefaultHandling, nil)
            }
        }
    }
    private static let strictSession = URLSession(configuration: .ephemeral)
    private static let insecureSession = URLSession(configuration: .ephemeral, delegate: TrustAll(), delegateQueue: nil)

    static func request(_ body: [String: Any]) async throws -> [String: Any] {
        guard let s = body["url"] as? String, let url = URL(string: s), ["http", "https"].contains(url.scheme ?? "") else {
            throw BridgeError("Bad URL")
        }
        var req = URLRequest(url: url)
        req.httpMethod = (body["method"] as? String) ?? "GET"
        req.timeoutInterval = (body["timeout"] as? Double) ?? 15
        (body["headers"] as? [String: String])?.forEach { req.setValue($0.value, forHTTPHeaderField: $0.key) }
        if let b = body["body"] as? String { req.httpBody = Data(b.utf8) }
        let session = (body["insecure"] as? Bool ?? false) ? insecureSession : strictSession
        do {
            let (data, resp) = try await session.data(for: req)
            return ["status": (resp as? HTTPURLResponse)?.statusCode ?? 0, "body": String(decoding: data, as: UTF8.self)]
        } catch {
            throw BridgeError("Cannot reach \(url.host ?? s): \(error.localizedDescription)")
        }
    }
}
