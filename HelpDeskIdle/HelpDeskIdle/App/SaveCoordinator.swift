import Foundation
import OSLog
import HelpDeskCore

/// Когда сохранять: после покупок (saveNow), раз в N секунд (tick), при уходе в фон.
final class SaveCoordinator {
    private let store: SaveStore
    private let interval: TimeInterval
    private var lastSave = Date.distantPast
    private let log = Logger(subsystem: "HelpDeskIdle", category: "save")

    init(store: SaveStore, interval: TimeInterval) {
        self.store = store
        self.interval = interval
    }

    static func defaultStore() -> LocalSaveStore {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return LocalSaveStore(directory: base.appendingPathComponent("HelpDeskIdle", isDirectory: true))
    }

    func load() -> GameState? {
        do { return try store.load() } catch {
            log.error("load failed: \(error.localizedDescription)")
            return nil
        }
    }

    func saveNow(_ state: GameState) {
        do {
            try store.save(state)
            lastSave = Date()
        } catch {
            log.error("save failed: \(error.localizedDescription)")
        }
    }

    /// Вызывается из игрового тика; сохраняет не чаще `interval`.
    func tick(_ state: GameState, now: Date) {
        if now.timeIntervalSince(lastSave) >= interval { saveNow(state) }
    }
}
