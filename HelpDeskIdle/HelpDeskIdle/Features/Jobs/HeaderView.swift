import SwiftUI
import HelpDeskCore

struct HeaderView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.theme) private var theme

    var body: some View {
        let l10n = model.l10n
        HStack(spacing: 12) {
            IconProvider.image(for: "avatar")
                .resizable()
                .scaledToFit()
                .padding(6)
                .frame(width: 64, height: 64)
                .background(Color(hex: 0xDCE6FF), in: RoundedRectangle(cornerRadius: 18))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(theme.card, lineWidth: 3))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: l10n.money(model.engine.state.money))
                    .font(AppFont.display(26))
                    .foregroundStyle(theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .contentTransition(.numericText())
                Text(verbatim: l10n.t("header.perSecond", GameNumberFormatter.format(model.engine.incomePerSecond, language: l10n.language)))
                    .font(AppFont.body(13, weight: .heavy))
                    .foregroundStyle(theme.positive)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                model.cycleBuyMode()
            } label: {
                VStack(spacing: 0) {
                    Text(verbatim: l10n.t("buy.label"))
                    Text(verbatim: l10n.t("buy.mode.\(model.buyMode.rawValue)"))
                }
                .font(AppFont.body(13, weight: .heavy))
                .foregroundStyle(theme.onAccent)
                .frame(width: 68, height: 52)
                .background(theme.accent, in: RoundedRectangle(cornerRadius: 14))
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 10)
    }
}
