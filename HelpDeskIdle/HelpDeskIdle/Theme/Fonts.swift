import SwiftUI
import UIKit
import CoreText

/// Шрифты из папки Fonts (скачивает tools/fetch_assets.sh). Нет файла — системный rounded.
enum AppFont {
    private static var available: Set<String> = []

    static func registerAll() {
        for name in ["Unbounded", "Manrope"] {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else { continue }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            if UIFont.familyNames.contains(name) { available.insert(name) }
        }
    }

    /// Крупные цифры и заголовки.
    static func display(_ size: CGFloat) -> Font {
        available.contains("Unbounded")
            ? .custom("Unbounded", size: size).weight(.bold)
            : .system(size: size, weight: .heavy, design: .rounded)
    }

    /// Основной текст.
    static func body(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        available.contains("Manrope")
            ? .custom("Manrope", size: size).weight(weight)
            : .system(size: size, weight: weight, design: .rounded)
    }
}
