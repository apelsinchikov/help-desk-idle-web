import SwiftUI

@main
struct HelpDeskIdleApp: App {
    @State private var model: AppModel
    @Environment(\.scenePhase) private var scenePhase

    init() {
        AppFont.registerAll()
        _model = State(initialValue: AppModel())
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(\.theme, .officeA)
                .environment(\.locale, model.l10n.locale)
                .task { await model.start() }
                .onChange(of: scenePhase) { _, phase in
                    model.onScenePhase(phase)
                }
        }
    }
}
