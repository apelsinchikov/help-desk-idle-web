import SwiftUI
import HelpDeskCore

struct SettingsScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.theme) private var theme
    @Environment(\.dismiss) private var dismiss
    @State private var confirmReset = false

    var body: some View {
        let l10n = model.l10n
        NavigationStack {
            Form {
                Section {
                    Picker(selection: languageBinding) {
                        Text(verbatim: "Русский").tag(AppLanguage.ru)
                        Text(verbatim: "English").tag(AppLanguage.en)
                    } label: {
                        Text(verbatim: l10n.t("settings.language"))
                    }
                    .pickerStyle(.segmented)

                    Toggle(isOn: hapticsBinding) {
                        Text(verbatim: l10n.t("settings.haptics"))
                    }
                }
                Section {
                    HStack {
                        Text(verbatim: l10n.t("settings.cloud"))
                        Spacer()
                        Text(verbatim: cloudText(l10n))
                            .foregroundStyle(cloudColor)
                    }
                }
                Section {
                    Button(role: .destructive) {
                        confirmReset = true
                    } label: {
                        Text(verbatim: l10n.t("settings.reset"))
                    }
                }
            }
            .navigationTitle(Text(verbatim: l10n.t("menu.settings")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button { dismiss() } label: { Text(verbatim: l10n.t("common.close")) }
                }
            }
            .alert(Text(verbatim: l10n.t("settings.reset.title")), isPresented: $confirmReset) {
                Button(role: .destructive) {
                    model.resetProgress()
                } label: {
                    Text(verbatim: l10n.t("settings.reset.ok"))
                }
                Button(role: .cancel) {} label: { Text(verbatim: l10n.t("common.cancel")) }
            } message: {
                Text(verbatim: l10n.t("settings.reset.message"))
            }
        }
        .tint(theme.accent)
    }

    private func cloudText(_ l10n: LocalizationManager) -> String {
        switch model.cloudStatus {
        case .disabled: return l10n.t("cloud.disabled")
        case .syncing: return l10n.t("cloud.syncing")
        case .synced(let date):
            return l10n.t("cloud.synced", date.formatted(.dateTime.hour().minute().locale(l10n.locale)))
        case .offline: return l10n.t("cloud.offline")
        }
    }

    private var cloudColor: Color {
        switch model.cloudStatus {
        case .synced: return theme.positive
        case .offline: return theme.upgrades
        default: return theme.muted
        }
    }

    private var languageBinding: Binding<AppLanguage> {
        Binding(get: { model.l10n.language }, set: { model.setLanguage($0) })
    }

    private var hapticsBinding: Binding<Bool> {
        Binding(get: { model.engine.state.settings.haptics }, set: { model.setHaptics($0) })
    }
}
