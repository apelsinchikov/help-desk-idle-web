import Foundation
import Observation
import HelpDeskCore

/// Язык меняется внутри игры, без перезапуска: строки берутся из нужного .lproj.
@Observable
final class LocalizationManager {
    var language: AppLanguage {
        didSet { bundle = Self.bundle(for: language) }
    }
    private(set) var bundle: Bundle

    init(language: AppLanguage) {
        self.language = language
        self.bundle = Self.bundle(for: language)
    }

    static var systemLanguage: AppLanguage {
        (Locale.preferredLanguages.first ?? "en").hasPrefix("ru") ? .ru : .en
    }

    private static func bundle(for language: AppLanguage) -> Bundle {
        guard let path = Bundle.main.path(forResource: language.rawValue, ofType: "lproj"),
              let bundle = Bundle(path: path) else { return .main }
        return bundle
    }

    var locale: Locale { Locale(identifier: language.rawValue) }

    func t(_ key: String) -> String {
        bundle.localizedString(forKey: key, value: key, table: nil)
    }

    func t(_ key: String, _ args: CVarArg...) -> String {
        String(format: t(key), locale: locale, arguments: args)
    }

    func money(_ value: Double) -> String {
        "$ " + GameNumberFormatter.format(value, language: language)
    }

    func duration(_ seconds: TimeInterval) -> String {
        GameDurationFormatter.format(seconds, language: language)
    }

    func jobTitle(_ id: String) -> String { t("job.\(id).title") }
    func jobSubtitle(_ id: String) -> String { t("job.\(id).subtitle") }
    func managerName(_ id: String) -> String { t("manager.\(id).name") }
}
