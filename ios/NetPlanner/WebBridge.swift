import SwiftUI
import UIKit
import WebKit

/// Hosts the Net Planner web app (bundled index.html) and connects it to iOS:
/// - "save"    → writes the file and opens the share sheet (Save to Files, AirDrop, Mail…)
/// - "persist" → keeps Documents/NetPlanner.netplan up to date (visible in the Files app)
/// - "persistUI" → keeps settings (server address, field-mode choices, local integrations)
/// - nativeAsync: "scan" (camera / photo → text + barcodes), "probe" (is this IP up?), "http" (Proxmox/TrueNAS API)
/// - files opened into the app are handed to the web app to import.
@MainActor
final class WebBridge: NSObject, ObservableObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply, WKUIDelegate, WKNavigationDelegate {
    let webView: WKWebView
    private var loaded = false
    private var pendingFiles: [(base64: String, name: String)] = []
    private var pendingLinks: [String] = []
    private var hingeState = "none"

    static let planFileName = "NetPlanner.netplan"
    /// iPhone/iPad: the app's Documents folder (shown in Files). Mac: ~/Documents/Net Planner/.
    static var planURL: URL {
        var dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        #if targetEnvironment(macCatalyst)
        dir = dir.appendingPathComponent("Net Planner", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        #endif
        return dir.appendingPathComponent(planFileName)
    }
    /// Settings live in Application Support (not shown in the Files app).
    static var settingsURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Net Planner", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("settings.json")
    }
    static var platform: String {
        #if targetEnvironment(macCatalyst)
        return "mac"
        #else
        return UIDevice.current.userInterfaceIdiom == .pad ? "pad" : "phone"
        #endif
    }
    private let scanner = Scanner()

    override init() {
        let config = WKWebViewConfiguration()
        let content = WKUserContentController()
        // Restore the saved plan before the page's own scripts run.
        var boot = "window.NATIVE_PLATFORM=\"\(WebBridge.platform)\";"
        let device = WebBridge.platform == "mac" ? "Mac" : UIDevice.current.name
        boot += "window.NATIVE_DEVICE=\"\(Data(device.utf8).base64EncodedString())\";window.NATIVE_DEVICE=new TextDecoder().decode(Uint8Array.from(atob(window.NATIVE_DEVICE),c=>c.charCodeAt(0)));"
        if let saved = try? Data(contentsOf: WebBridge.planURL) {
            boot += "window.NATIVE_BOOT=\"\(saved.base64EncodedString())\";"
        }
        if let ui = try? Data(contentsOf: WebBridge.settingsURL) {
            boot += "window.NATIVE_UI=\"\(ui.base64EncodedString())\";"
        }
        content.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = content
        config.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()

        content.add(WeakMessageHandler(self), name: "native")
        content.addScriptMessageHandler(WeakMessageHandler(self), contentWorld: .page, name: "nativeAsync")
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground
        if #available(iOS 16.4, *) { webView.isInspectable = true }

        // iPhone Duo: tell the page when the phone folds closed or opens (iOS 27.1+).
        #if !targetEnvironment(macCatalyst)
        if #available(iOS 27.1, *) {
            let hinge = UIHingeInteraction { [weak self] _, update in
                guard let self else { return }
                var state = "none"
                var angle = 0.0
                if let h = update.hinge {
                    angle = Double(h.angle)
                    switch h.status {
                    case .closed: state = "closed"
                    case .partiallyOpen: state = "partial"
                    case .fullyOpen: state = "open"
                    default: state = "none"
                    }
                }
                self.hingeState = state
                if self.loaded { self.sendHinge(angle) }
            }
            webView.addInteraction(hinge)
        }
        #endif

        if let index = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        }
    }

    // MARK: messages from the web app

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        switch action {
        case "persist":
            if let text = body["data"] as? String {
                try? Data(text.utf8).write(to: WebBridge.planURL, options: .atomic)
            }
        case "persistUI":
            if let text = body["data"] as? String {
                try? Data(text.utf8).write(to: WebBridge.settingsURL, options: .atomic)
            }
        case "haptic":
            let kind = body["kind"] as? String ?? "light"
            if kind == "warning" { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
            else if kind == "success" { UINotificationFeedbackGenerator().notificationOccurred(.success) }
            else { UIImpactFeedbackGenerator(style: .medium).impactOccurred() }
        case "save":
            guard let name = body["name"] as? String, let text = body["data"] as? String else { return }
            let isBase64 = body["base64"] as? Bool ?? false
            let data = isBase64 ? (Data(base64Encoded: text) ?? Data()) : Data(text.utf8)
            share(data: data, fileName: name)
        default:
            break
        }
    }

    /// Calls that return a value to JavaScript (a Promise on the web side).
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else {
            replyHandler(nil, "bad request"); return
        }
        Task { @MainActor in
            do {
                switch action {
                case "scan":
                    guard let top = self.topViewController() else { throw BridgeError("no window") }
                    let items = try await self.scanner.scan(from: top, anchor: self.webView)
                    replyHandler(items, nil)
                case "probe":
                    let targets = (body["targets"] as? [[String: Any]]) ?? []
                    replyHandler(await Probe.run(targets), nil)
                case "http":
                    replyHandler(try await NativeHTTP.request(body), nil)
                default:
                    replyHandler(nil, "unknown action \(action)")
                }
            } catch {
                replyHandler(nil, (error as? BridgeError)?.message ?? error.localizedDescription)
            }
        }
    }

    private func share(data: Data, fileName: String) {
        let safe = String(fileName.map { "/\\:".contains($0) ? "-" : $0 })
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("export", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(safe.isEmpty ? "export" : safe)
        do { try data.write(to: url, options: .atomic) } catch { return }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        present(sheet)
    }

    // MARK: files opened into the app

    func openFile(at url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        var data: Data?
        var error: NSError?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &error) { data = try? Data(contentsOf: $0) }
        guard let data else { return }
        let item = (base64: data.base64EncodedString(), name: url.lastPathComponent)
        if loaded { deliver(item) } else { pendingFiles.append(item) }
    }

    private func sendHinge(_ angle: Double = 0) {
        webView.evaluateJavaScript("window.netplannerHinge&&window.netplannerHinge('\(hingeState)',\(angle))")
    }

    /// netplanner://scan, netplanner://status, netplanner://check, netplanner://find (Control Center buttons)
    func openDeepLink(_ url: URL) {
        let action = String((url.host ?? url.path).filter { $0.isLetter })
        if loaded { webView.evaluateJavaScript("window.netplannerDeepLink&&window.netplannerDeepLink('\(action)')") }
        else { pendingLinks.append(action) }
    }

    func handle(url: URL) {
        if url.scheme == "netplanner" { openDeepLink(url) } else { openFile(at: url) }
    }

    private func deliver(_ item: (base64: String, name: String)) {
        let name = String(item.name.filter { $0.isLetter || $0.isNumber || " ._-()".contains($0) })
        webView.evaluateJavaScript("window.netplannerOpenBase64('\(item.base64)','\(name)')")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
        pendingFiles.forEach(deliver)
        pendingFiles.removeAll()
        sendHinge()
        // give the page a moment to finish its first render before acting on a Control Center button
        let links = pendingLinks
        pendingLinks.removeAll()
        if !links.isEmpty {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
                links.forEach { a in self?.webView.evaluateJavaScript("window.netplannerDeepLink&&window.netplannerDeepLink('\(a)')") }
            }
        }
        #if DEBUG
        // Test hook: SIMCTL_CHILD_NETPLANNER_TEST_JS="..." xcrun simctl launch …
        if let js = ProcessInfo.processInfo.environment["NETPLANNER_TEST_JS"] {
            webView.evaluateJavaScript(js)
        }
        #endif
    }

    // Links to outside sites open in Safari instead of replacing the app.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, action.navigationType == .linkActivated, url.scheme?.hasPrefix("http") == true {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // MARK: alert / confirm / prompt (WKWebView shows nothing without these)

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        if !present(alert) { completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        if !present(alert) { completionHandler(false) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
        if !present(alert) { completionHandler(nil) }
    }

    // MARK: presenting

    @discardableResult
    private func present(_ vc: UIViewController) -> Bool {
        guard let top = topViewController() else { return false }
        if let pop = vc.popoverPresentationController { // iPad share sheet anchor
            pop.sourceView = webView
            pop.sourceRect = CGRect(x: webView.bounds.maxX - 80, y: webView.safeAreaInsets.top + 20, width: 1, height: 1)
        }
        top.present(vc, animated: true)
        return true
    }

    func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
        var vc = scene?.keyWindow?.rootViewController ?? scene?.windows.first?.rootViewController
        while let shown = vc?.presentedViewController { vc = shown }
        return vc
    }
}

/// Avoids a retain cycle between WKUserContentController and the bridge.
@MainActor
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    weak var target: WebBridge?
    init(_ target: WebBridge) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        guard let target else { replyHandler(nil, "gone"); return }
        target.userContentController(controller, didReceive: message, replyHandler: replyHandler)
    }
}

struct BridgeError: Error { let message: String; init(_ m: String) { message = m } }
