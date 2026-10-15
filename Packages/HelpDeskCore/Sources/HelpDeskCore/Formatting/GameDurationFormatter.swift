import Foundation

/// «11 мин 42 с», «1 ч 20 мин», «3 д 4 ч», «1,5 с».
public enum GameDurationFormatter {
    public static func format(_ seconds: TimeInterval, language: AppLanguage) -> String {
        let s = seconds.isFinite ? max(0, seconds) : 0
        let ru = language == .ru
        let (d, h, m, sec) = (ru ? "д" : "d", ru ? "ч" : "h", ru ? "мин" : "min", ru ? "с" : "s")
        let total = Int(s)

        if total >= 86_400 {
            let days = total / 86_400, hours = (total % 86_400) / 3_600
            return hours > 0 ? "\(days) \(d) \(hours) \(h)" : "\(days) \(d)"
        }
        if total >= 3_600 {
            let hours = total / 3_600, minutes = (total % 3_600) / 60
            return minutes > 0 ? "\(hours) \(h) \(minutes) \(m)" : "\(hours) \(h)"
        }
        if total >= 60 {
            return "\(total / 60) \(m) \(total % 60) \(sec)"
        }
        var text = String(format: "%.1f", s)
        if text.hasSuffix(".0") { text.removeLast(2) }
        if ru { text = text.replacingOccurrences(of: ".", with: ",") }
        return "\(text) \(sec)"
    }
}
