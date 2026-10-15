import SwiftUI

/// Меню — колонка кнопок поверх затемнённой игры (игра продолжает идти).
struct MenuOverlay: View {
    @Environment(AppModel.self) private var model
    @Environment(\.theme) private var theme

    var body: some View {
        ZStack(alignment: .bottom) {
            theme.ink.opacity(0.62)
                .ignoresSafeArea()
                .onTapGesture { model.showMenu = false }

            VStack(spacing: 10) {
                item("menu.managers", color: theme.managers, badge: model.hireableManagers) {
                    open(.managers)
                }
                lockedItem("menu.achievements", color: theme.achievements)
                lockedItem("menu.upgrades", color: theme.upgrades)
                lockedItem("menu.wardrobe", color: theme.wardrobe)
                lockedItem("menu.reorg", color: theme.reorg)
                item("menu.settings", color: theme.muted, badge: 0) {
                    open(.settings)
                }
                Button {
                    model.showMenu = false
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(theme.ink)
                        .frame(width: 56, height: 56)
                        .background(theme.card, in: Circle())
                }
                .accessibilityLabel(Text(verbatim: model.l10n.t("common.close")))
                .padding(.top, 8)
            }
            .padding(.horizontal, 56)
            .padding(.bottom, 24)
        }
    }

    private func open(_ route: AppRoute) {
        model.showMenu = false
        model.route = route
    }

    private func item(_ key: String, color: Color, badge: Int, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Circle().fill(color).frame(width: 12, height: 12)
                Text(verbatim: model.l10n.t(key))
                Spacer()
                if badge > 0 {
                    Text("\(badge)")
                        .font(AppFont.body(12, weight: .heavy))
                        .foregroundStyle(theme.onAccent)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(theme.upgrades, in: Capsule())
                }
            }
            .font(AppFont.body(16, weight: .heavy))
            .foregroundStyle(theme.ink)
            .padding(.horizontal, 14)
            .frame(height: 52)
            .background(theme.card, in: RoundedRectangle(cornerRadius: 16))
        }
    }

    private func lockedItem(_ key: String, color: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "lock.fill").font(.system(size: 12, weight: .bold))
            Text(verbatim: model.l10n.t(key))
            Spacer()
            Text(verbatim: model.l10n.t("common.soon")).font(AppFont.body(12))
        }
        .font(AppFont.body(16, weight: .heavy))
        .foregroundStyle(theme.muted)
        .padding(.horizontal, 14)
        .frame(height: 52)
        .background(theme.trackStrong, in: RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: .combine)
    }
}
