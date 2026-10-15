import Foundation

/// Сейв в JSON-файле. Перед каждой записью предыдущий `save.json` становится `save.prev.json`.
/// Битый или «из будущего» сейв не роняет игру: пробуем резервную копию, иначе nil (новая игра).
public final class LocalSaveStore: SaveStore, @unchecked Sendable {
    private let directory: URL
    private let lock = NSLock()

    private var currentURL: URL { directory.appendingPathComponent("save.json") }
    private var backupURL: URL { directory.appendingPathComponent("save.prev.json") }

    public init(directory: URL) {
        self.directory = directory
    }

    public func load() throws -> GameState? {
        lock.lock(); defer { lock.unlock() }
        return decode(currentURL) ?? decode(backupURL)
    }

    public func save(_ state: GameState) throws {
        lock.lock(); defer { lock.unlock() }
        let fm = FileManager.default
        try fm.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(state)

        if fm.fileExists(atPath: currentURL.path), decode(currentURL) != nil {
            try? fm.removeItem(at: backupURL)
            try fm.copyItem(at: currentURL, to: backupURL)
        }
        try data.write(to: currentURL, options: .atomic)
    }

    private func decode(_ url: URL) -> GameState? {
        guard let data = try? Data(contentsOf: url),
              let state = try? JSONDecoder().decode(GameState.self, from: data),
              state.schemaVersion <= GameState.currentSchema
        else { return nil }
        return state
    }
}
