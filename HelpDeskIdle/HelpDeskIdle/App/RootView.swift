import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        switch model.phase {
        case .loading:
            LoadingScreen()
        case .playing:
            JobsScreen()
                .sheet(isPresented: offlineSheetShown) {
                    if let report = model.offlineReport {
                        WelcomeBackSheet(report: report)
                    }
                }
        }
    }

    private var offlineSheetShown: Binding<Bool> {
        Binding(
            get: { model.offlineReport != nil },
            set: { if !$0 { model.offlineReport = nil } }
        )
    }
}
