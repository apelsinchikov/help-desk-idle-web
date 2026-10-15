import SwiftUI
import HelpDeskCore

/// Карточка работы. Вся карточка — зона тапа (старт / сбор). Внутри TimelineView,
/// чтобы полоска и переход в «Готово» обновлялись каждый кадр без хранения прогресса.
struct JobCardView: View {
    let job: JobDefinition
    @Environment(AppModel.self) private var model

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30)) { _ in
            let status = model.engine.status(of: job.id)
            if case let .locked(requirementMet) = status {
                LockedJobCard(job: job, requirementMet: requirementMet)
            } else {
                OpenJobCard(job: job, status: status)
            }
        }
    }
}

private struct OpenJobCard: View {
    let job: JobDefinition
    let status: JobStatus
    @Environment(AppModel.self) private var model
    @Environment(\.theme) private var theme
    @State private var floatText: String?

    var body: some View {
        let engine = model.engine
        let l10n = model.l10n
        let level = engine.level(of: job.id)
        let quote = engine.quote(jobId: job.id, mode: model.buyMode)
        let canBuy = quote.count > 0 && quote.cost <= engine.state.money
        let isReady = status == .ready

        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 5) {
                IconProvider.image(for: job.iconKey)
                    .resizable()
                    .scaledToFit()
                    .padding(8)
                    .frame(width: 68, height: 68)
                    .background(theme.track, in: RoundedRectangle(cornerRadius: 18))
                Text(verbatim: levelText(level: level))
                    .font(AppFont.body(11, weight: .heavy))
                    .foregroundStyle(theme.ink)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(verbatim: l10n.jobTitle(job.id))
                    .font(AppFont.body(15, weight: .heavy))
                    .foregroundStyle(theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                JobProgressBar(status: status, payout: engine.payout(of: job.id))
                Button {
                    model.buy(job.id)
                } label: {
                    HStack {
                        Text(verbatim: l10n.t("buy.button", max(quote.count, 1)))
                        Spacer()
                        Text(verbatim: l10n.money(quote.cost))
                    }
                    .font(AppFont.body(13, weight: .heavy))
                    .foregroundStyle(canBuy ? theme.onAccent : theme.muted)
                    .padding(.horizontal, 12)
                    .frame(height: 36)
                    .background(canBuy ? theme.accent : theme.trackStrong, in: RoundedRectangle(cornerRadius: 12))
                }
                .disabled(!canBuy)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(theme.card, in: RoundedRectangle(cornerRadius: 20))
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(isReady ? theme.positive : Color.clear, lineWidth: 2)
        )
        .shadow(color: theme.line, radius: 0, x: 0, y: 2)
        .overlay(alignment: .topTrailing) {
            if let floatText {
                Text(verbatim: floatText)
                    .font(AppFont.body(15, weight: .heavy))
                    .foregroundStyle(theme.positive)
                    .padding(.trailing, 16)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .contentShape(RoundedRectangle(cornerRadius: 20))
        .onTapGesture {
            if let earned = model.tapJob(job.id) {
                showFloat("+" + l10n.money(earned))
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }

    private func levelText(level: Int) -> String {
        if let next = model.engine.nextMilestone(of: job.id) {
            return "\(level) / \(next.level)"
        }
        return "\(level)"
    }

    private func showFloat(_ text: String) {
        withAnimation(.easeOut(duration: 0.2)) { floatText = text }
        Task {
            try? await Task.sleep(for: .milliseconds(800))
            withAnimation(.easeIn(duration: 0.3)) { floatText = nil }
        }
    }
}
