import SwiftUI
import HelpDeskCore

/// Полоска выполнения. Рисуется от статуса — ничего не хранит.
struct JobProgressBar: View {
    let status: JobStatus
    let payout: Double
    @Environment(AppModel.self) private var model
    @Environment(\.theme) private var theme

    var body: some View {
        let l10n = model.l10n
        ZStack(alignment: .leading) {
            RoundedRectangle(cornerRadius: 10).fill(trackColor)
            GeometryReader { geo in
                RoundedRectangle(cornerRadius: 10)
                    .fill(fillColor)
                    .frame(width: geo.size.width * fill)
            }
            HStack {
                Text(verbatim: leftText(l10n))
                Spacer(minLength: 6)
                Text(verbatim: rightText(l10n))
            }
            .font(AppFont.body(13, weight: .heavy))
            .foregroundStyle(textColor)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .padding(.horizontal, 10)
        }
        .frame(height: 28)
    }

    private var fill: CGFloat {
        switch status {
        case .running(let progress, _): return CGFloat(min(max(progress, 0), 1))
        case .ready, .streaming: return 1
        default: return 0
        }
    }

    private var trackColor: Color { theme.track }

    private var fillColor: Color {
        if case .ready = status { return theme.positive }
        return theme.amber
    }

    private var textColor: Color {
        if case .ready = status { return theme.onAccent }
        return theme.ink
    }

    private func leftText(_ l10n: LocalizationManager) -> String {
        switch status {
        case .ready: return l10n.t("job.ready")
        case .streaming(let perSecond): return l10n.t("job.perSecond", l10n.money(perSecond))
        default: return l10n.money(payout)
        }
    }

    private func rightText(_ l10n: LocalizationManager) -> String {
        switch status {
        case .ready: return l10n.money(payout)
        case .running(_, let remaining): return l10n.duration(remaining)
        case .idle: return l10n.t("job.tapToStart")
        default: return ""
        }
    }
}
