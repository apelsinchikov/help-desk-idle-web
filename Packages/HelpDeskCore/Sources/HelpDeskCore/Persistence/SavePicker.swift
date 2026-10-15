import Foundation

/// Какой сейв оставить, если есть и локальный, и облачный.
/// Побеждает тот, где заработано больше за всё время; при равенстве — более свежий.
public enum SavePicker {
    public static func pick(local: GameState?, remote: GameState?) -> GameState? {
        guard let local else { return remote }
        guard let remote else { return local }
        if remote.lifetimeEarnings != local.lifetimeEarnings {
            return remote.lifetimeEarnings > local.lifetimeEarnings ? remote : local
        }
        return remote.lastActiveAt > local.lastActiveAt ? remote : local
    }
}
