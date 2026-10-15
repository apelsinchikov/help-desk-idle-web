import SwiftUI
import HelpDeskCore

struct WelcomeBackSheet: View {
    let report: OfflineReport
    @Environment(AppModel.self) private var model
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let l10n = model.l10n
        ZStack {
            theme.night.ignoresSafeArea()
            VStack(spacing: 20) {
                Text(verbatim: l10n.t("welcome.title"))
                    .font(AppFont.display(28))
                    .foregroundStyle(theme.nightAccent)
                    .multilineTextAlignment(.center)
                Text(verbatim: l10n.t("welcome.away", l10n.duration(report.elapsed)))
                    .font(AppFont.body(16, weight: .bold))
                    .foregroundStyle(theme.nightMuted)

                VStack(spacing: 6) {
                    Text(verbatim: l10n.t("welcome.earned"))
                        .font(AppFont.body(14, weight: .bold))
                        .foregroundStyle(theme.muted)
                    Text(verbatim: l10n.money(report.earned))
                        .font(AppFont.display(30))
                        .foregroundStyle(theme.positive)
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                    Text(verbatim: l10n.t("welcome.joke"))
                        .font(AppFont.body(14, weight: .medium))
                        .foregroundStyle(theme.ink)
                    if report.readyJobs > 0 {
                        Text(verbatim: l10n.t("welcome.ready", report.readyJobs))
                            .font(AppFont.body(12, weight: .medium))
                            .foregroundStyle(theme.muted)
                            .padding(.top, 4)
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity)
                .background(theme.background, in: RoundedRectangle(cornerRadius: 20))

                Spacer()

                Button {
                    dismiss()
                } label: {
                    Text(verbatim: l10n.t("welcome.collect"))
                        .font(AppFont.body(17, weight: .heavy))
                        .foregroundStyle(theme.onAccent)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(theme.accent, in: RoundedRectangle(cornerRadius: 16))
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 48)
            .padding(.bottom, 24)
        }
        .presentationDetents([.large])
        .interactiveDismissDisabled()
    }
}
