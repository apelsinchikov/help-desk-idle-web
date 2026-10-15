import SwiftUI
import HelpDeskCore

struct LockedJobCard: View {
    let job: JobDefinition
    let requirementMet: Bool
    @Environment(AppModel.self) private var model
    @Environment(\.theme) private var theme

    var body: some View {
        let engine = model.engine
        let l10n = model.l10n
        let canUnlock = engine.canUnlock(jobId: job.id)
        let previous = engine.content.previousJob(of: job.id)

        HStack(alignment: .top, spacing: 12) {
            IconProvider.image(for: job.iconKey)
                .resizable()
                .scaledToFit()
                .padding(10)
                .frame(width: 68, height: 68)
                .saturation(0)
                .opacity(0.45)
                .background(theme.trackStrong, in: RoundedRectangle(cornerRadius: 18))
                .overlay(alignment: .bottomTrailing) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(theme.muted)
                        .padding(6)
                }

            VStack(alignment: .leading, spacing: 6) {
                Text(verbatim: l10n.jobTitle(job.id))
                    .font(AppFont.body(15, weight: .heavy))
                    .foregroundStyle(theme.ink)
                if let previous {
                    HStack(spacing: 4) {
                        Text(verbatim: l10n.t("job.locked.requirement", l10n.jobTitle(previous.id), job.unlockLevel))
                            .foregroundStyle(theme.ink)
                        if requirementMet {
                            Text(verbatim: "— " + l10n.t("job.locked.done"))
                                .foregroundStyle(theme.positive)
                        }
                    }
                    .font(AppFont.body(12))
                    .lineLimit(2)
                }
                Button {
                    model.unlock(job.id)
                } label: {
                    HStack {
                        Text(verbatim: l10n.t("job.unlock"))
                        Spacer()
                        Text(verbatim: l10n.money(job.baseCost))
                    }
                    .font(AppFont.body(13, weight: .heavy))
                    .foregroundStyle(canUnlock ? theme.accent : theme.muted)
                    .padding(.horizontal, 12)
                    .frame(height: 36)
                    .background(theme.card, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(canUnlock ? theme.accent : theme.lockedBorder, lineWidth: 2)
                    )
                }
                .disabled(!canUnlock)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .strokeBorder(theme.lockedBorder, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
        )
    }
}
