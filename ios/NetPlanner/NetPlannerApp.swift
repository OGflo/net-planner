import SwiftUI

@main
struct NetPlannerApp: App {
    @StateObject private var bridge = WebBridge()

    var body: some Scene {
        WindowGroup {
            PlannerWebView(bridge: bridge)
                .background(Color(uiColor: .systemBackground))
                // .netplan / .xlsx / .csv opened from Files, AirDrop, Mail, Messages…
                // and netplanner:// links from the Control Center buttons
                .onOpenURL { bridge.handle(url: $0) }
        }
    }
}

struct PlannerWebView: UIViewRepresentable {
    let bridge: WebBridge
    func makeUIView(context: Context) -> UIView { bridge.webView }
    func updateUIView(_ uiView: UIView, context: Context) {}
}
