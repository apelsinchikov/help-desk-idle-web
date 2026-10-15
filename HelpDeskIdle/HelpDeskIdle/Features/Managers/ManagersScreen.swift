import SwiftUI
import HelpDeskCore

struct ManagersScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let l10n = model.l10n
        VStack(spacing: 0) {
            VStack(spacing: 12) {
                HStack {
                    Text(verbatim: l10n.t("menu.managers"))
                        .font(AppFont.display(24))
                        .foregroundStyle(theme.onAccent)
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(theme.managers)
                            .frame(width: 40, height: 40)
                            .background(theme.card, in: Circle())
                    }
                    .accessibilityLabel(Text(verbatim: l10n.t("common.close")))
                }
                HStack(spacing: 6) {
                    Text(verbatim: l10n.t("managers.tab.cash"))
                        .foregroundStyle(theme.managers)
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .background(theme.card, in: RoundedRectangle(cornerRadius: 10))
                    Text(verbatim: l10n.t("managers.tab.coins") + " · " + l10n.t("common.soon"))
                        .foregroundStyle(theme.onAccent.opacity(0.8))
                        .frame(maxWidth: .infinity, minHeight: 36)
                }
                .font(AppFont.body(14, weight: .heavy))
                .padding(4)
                .background(theme.ink.opacity(0.18), in: RoundedRectangle(cornerRadius: 14))
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 14)
            .background(theme.managers)

            ScrollView {
                VStack(spacing: 10) {
                    HStack {
                        Text(verbatim: l10n.t("managers.balance"))
                        Spacer()
                        Text(verbatim: l10n.money(model.engine.state.money))
                    }
                    .font(AppFont.body(15, weight: .heavy))
                    .foregroundStyle(theme.ink)
                    Text(verbatim: l10n.t("managers.intro"))
                        .font(AppFont.body(13, weight: .medium))
                        .foregroundStyle(theme.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    ForEach(model.engine.content.jobs) { job in
                        ManagerRow(job: job)
                    }
                }
                .padding(16)
            }
        }
        .background(theme.background)
    }
}

private struct ManagerRow: View {
    let job: JobDefinition
    @Environment(AppModel.self) private var model
    @Environment(\.theme) private var theme

    var body: some View {
        let engine = model.engine
        let l10n = model.l10n
        let jobState = engine.state.jobs[job.id]
        let hired = jobState?.hasManager ?? false
        let jobOpen = (jobState?.level ?? 0) > 0
        let canHire = engine.canHireManager(jobId: job.id)

        HStack(spacing: 10) {
            IconProvider.image(for: job.iconKey)
                .resizable()
                .scaledToFit()
                .padding(8)
                .frame(width: 56, height: 56)
                .background(theme.track, in: RoundedRectangle(cornerRadius: 14))
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: l10n.managerName(job.id))
                    .font(AppFont.body(15, weight: .heavy))
                    .foregroundStyle(theme.ink)
                Text(verbatim: l10n.t("managers.runs", l10n.jobTitle(job.id)))
                    .font(AppFont.body(12, weight: .medium))
                    .foregroundStyle(theme.muted)
                if !hired {
                    Text(verbatim: l10n.money(job.managerCost))
                        .font(AppFont.body(13, weight: .heavy))
                        .foregroundStyle(theme.ink)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if hired {
                Text(verbatim: l10n.t("managers.working"))
                    .font(AppFont.body(13, weight: .heavy))
                    .foregroundStyle(theme.positive)
            } else if !jobOpen {
                Text(verbatim: l10n.t("managers.lockedJob"))
                    .font(AppFont.body(11, weight: .bold))
                    .foregroundStyle(theme.muted)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 90)
            } else {
                Button {
                    model.hireManager(job.id)
                } label: {
                    Text(verbatim: l10n.t("managers.hire"))
                        .font(AppFont.body(14, weight: .heavy))
                        .foregroundStyle(canHire ? theme.onAccent : theme.muted)
                        .padding(.horizontal, 14)
                        .frame(height: 40)
                        .background(canHire ? theme.managers : theme.trackStrong, in: RoundedRectangle(cornerRadius: 12))
                }
                .disabled(!canHire)
            }
        }
        .padding(10)
        .background(theme.card, in: RoundedRectangle(cornerRadius: 16))
    }
}
