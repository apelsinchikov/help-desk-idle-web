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

    private var languageBinding: Binding<AppLanguage> {
        Binding(get: { model.l10n.language }, set: { model.setLanguage($0) })
    }

    private var hapticsBinding: Binding<Bool> {
        Binding(get: { model.engine.state.settings.haptics }, set: { model.setHaptics($0) })
    }
}
