import Foundation

public enum AppLanguage: String, Codable, CaseIterable, Sendable {
    case ru
    case en

    var groupSeparator: String { self == .ru ? "\u{00A0}" : "," }
    var decimalSeparator: String { self == .ru ? "," : "." }
}
