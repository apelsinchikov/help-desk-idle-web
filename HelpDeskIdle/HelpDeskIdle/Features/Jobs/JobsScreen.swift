import SwiftUI
import HelpDeskCore

/// Главный экран: шапка, список работ, нижняя панель. Меню — поверх, игра идёт на фоне.
struct JobsScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.theme) private var theme

    var body: some View {
        @Bindable var model = model
        ZStack {
            theme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                HeaderView()
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(model.engine.content.jobs) { job in
                            JobCardView(job: job)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 4)
                    .padding(.bottom, 16)
                }
                BottomBar()
            }
            if model.showMenu {
                MenuOverlay()
                    .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.2), value: model.showMenu)
        .sheet(item: $model.route) { route in
            switch route {
            case .managers: ManagersScreen()
            case .settings: SettingsScreen()
            }
        }
    }
}

private struct BottomBar: View {
    @Environment(AppModel.self) private var model
    @Environment(\.theme) private var theme

    var body: some View {
        HStack(spacing: 10) {
            Button {
                model.showMenu = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "line.3.horizontal")
                    Text(verbatim: model.l10n.t("nav.menu"))
                }
                .font(AppFont.body(16, weight: .heavy))
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(theme.ink, in: RoundedRectangle(cornerRadius: 16))
                .foregroundStyle(theme.onAccent)
                .overlay(alignment: .topTrailing) {
                    if model.hireableManagers > 0 {
                        Text("\(model.hireableManagers)")
                            .font(AppFont.body(12, weight: .heavy))
                            .foregroundStyle(theme.onAccent)
                            .padding(.horizontal, 7).padding(.vertical, 2)
                            .background(theme.upgrades, in: Capsule())
                            .offset(x: -8, y: -8)
                    }
                }
            }
            HStack(spacing: 8) {
                Image(systemName: "gift")
                Text(verbatim: model.l10n.t("nav.shop"))
                Text(verbatim: "· " + model.l10n.t("common.soon"))
                    .font(AppFont.body(12))
            }
            .font(AppFont.body(16, weight: .heavy))
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(theme.trackStrong, in: RoundedRectangle(cornerRadius: 16))
            .foregroundStyle(theme.muted)
            .accessibilityAddTraits(.isStaticText)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 4)
        .background(theme.background)
    }
}
