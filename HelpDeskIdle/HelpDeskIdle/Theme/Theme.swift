import SwiftUI

/// Цветовые токены темы. Вью берут цвета ТОЛЬКО отсюда — так тему C можно добавить заменой токенов.
struct ThemeTokens {
    let background: Color
    let card: Color
    let ink: Color
    let muted: Color
    let line: Color
    let track: Color
    let trackStrong: Color
    let lockedBorder: Color
    let accent: Color
    let accentDark: Color
    let amber: Color
    let positive: Color
    let onAccent: Color
    // разделы меню
    let managers: Color
    let achievements: Color
    let upgrades: Color
    let reorg: Color
    let wardrobe: Color
    let shop: Color
    // экран «С возвращением»
    let night: Color
    let nightAccent: Color
    let nightMuted: Color

    static let officeA = ThemeTokens(
        background: Color(hex: 0xF3EFE6),
        card: Color(hex: 0xFFFFFF),
        ink: Color(hex: 0x1D1B16),
        muted: Color(hex: 0x6B655A),
        line: Color(hex: 0xE2DACB),
        track: Color(hex: 0xEEE7D8),
        trackStrong: Color(hex: 0xE7E0D2),
        lockedBorder: Color(hex: 0xCFC6B4),
        accent: Color(hex: 0x2350D8),
        accentDark: Color(hex: 0x163A9E),
        amber: Color(hex: 0xF5B82E),
        positive: Color(hex: 0x1E7A3C),
        onAccent: Color(hex: 0xFFFFFF),
        managers: Color(hex: 0x3B7DD8),
        achievements: Color(hex: 0xE0A21B),
        upgrades: Color(hex: 0xE2572B),
        reorg: Color(hex: 0x8A4FC7),
        wardrobe: Color(hex: 0xC2417A),
        shop: Color(hex: 0xB4461A),
        night: Color(hex: 0x1D2440),
        nightAccent: Color(hex: 0x8FB0FF),
        nightMuted: Color(hex: 0xD6DDF2)
    )
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

private struct ThemeKey: EnvironmentKey {
    static let defaultValue = ThemeTokens.officeA
}

extension EnvironmentValues {
    var theme: ThemeTokens {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}
