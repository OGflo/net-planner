import AppIntents
import SwiftUI
import WidgetKit

/// Control Center (and Lock Screen / Action button) buttons for Net Planner.
/// Each one opens the app straight to a tool with a netplanner:// link.
@main
struct NetPlannerControls: WidgetBundle {
    var body: some Widget {
        ScanControl()
        StatusControl()
        CheckControl()
        FindControl()
    }
}

private func link(_ action: String) -> OpenURLIntent {
    OpenURLIntent(URL(string: "netplanner://\(action)")!)
}

struct ScanControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "local.netplanner.controls.scan") {
            ControlWidgetButton(action: link("scan")) {
                Label("Scan Label", systemImage: "barcode.viewfinder")
            }
        }
        .displayName("Scan Label")
        .description("Open Net Planner's label and barcode scanner.")
    }
}

struct StatusControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "local.netplanner.controls.status") {
            ControlWidgetButton(action: link("status")) {
                Label("Net Status", systemImage: "network")
            }
        }
        .displayName("Network Status")
        .description("See what's up and what's down.")
    }
}

struct CheckControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "local.netplanner.controls.check") {
            ControlWidgetButton(action: link("check")) {
                Label("Check Now", systemImage: "dot.radiowaves.left.and.right")
            }
        }
        .displayName("Check Every Device")
        .description("Run a status check on every device now.")
    }
}

struct FindControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "local.netplanner.controls.find") {
            ControlWidgetButton(action: link("find")) {
                Label("Find Device", systemImage: "magnifyingglass")
            }
        }
        .displayName("Find a Device")
        .description("Search by name, IP, MAC or serial.")
    }
}
