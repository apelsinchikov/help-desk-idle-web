import Foundation

/// Деньги в игре: «186 420», «1,24 млн», «3,72 трлн», дальше «1 aa», «1 ab»…
public enum GameNumberFormatter {
    private static let ruScale = ["млн", "млрд", "трлн", "квдрлн", "квнтлн"]
    private static let enScale = ["million", "billion", "trillion", "quadrillion", "quintillion"]

    public static func format(_ value: Double, language: AppLanguage) -> String {
        guard value.isFinite else { return "∞" }
        let sign = value < 0 ? "-" : ""
        let v = abs(value)

        if v < 1_000_000 {
            if v < 1_000 && v.rounded() != v {
                return sign + decimal(v, digits: 2, language: language)
            }
            return sign + grouped(Int64(v.rounded()), language: language)
        }

        var exponent = Int(floor(log10(v) / 3)) * 3
        var mantissa = v / pow(10, Double(exponent))
        var digits = mantissa < 10 ? 2 : (mantissa < 100 ? 1 : 0)
        // 999,95 млн → «1 млрд», а не «1000 млн»
        if (mantissa * pow(10, Double(digits))).rounded() >= 1000 * pow(10, Double(digits)) {
            exponent += 3
            mantissa = v / pow(10, Double(exponent))
            digits = 2
        }
        return sign + decimal(mantissa, digits: digits, language: language) + " " + scaleName(exponent, language: language)
    }

    private static func scaleName(_ exponent: Int, language: AppLanguage) -> String {
        let index = (exponent - 6) / 3
        let names = language == .ru ? ruScale : enScale
        if index < names.count { return names[index] }
        let k = index - names.count
        let letters = Array("abcdefghijklmnopqrstuvwxyz")
        let first = letters[min(k / 26, 25)]
        let second = letters[k % 26]
        return String([first, second])
    }

    /// Фиксированное число знаков, без хвостовых нулей.
    private static func decimal(_ v: Double, digits: Int, language: AppLanguage) -> String {
        var text = String(format: "%.\(digits)f", v)
        if text.contains(".") {
            while text.hasSuffix("0") { text.removeLast() }
            if text.hasSuffix(".") { text.removeLast() }
        }
        let parts = text.split(separator: ".", omittingEmptySubsequences: false)
        let integer = grouped(Int64(parts[0]) ?? 0, language: language)
        return parts.count > 1 ? integer + language.decimalSeparator + parts[1] : integer
    }

    private static func grouped(_ n: Int64, language: AppLanguage) -> String {
        let digits = Array(String(n))
        var out = ""
        for (i, ch) in digits.enumerated() {
            if i > 0 && (digits.count - i) % 3 == 0 { out += language.groupSeparator }
            out.append(ch)
        }
        return out
    }
}
