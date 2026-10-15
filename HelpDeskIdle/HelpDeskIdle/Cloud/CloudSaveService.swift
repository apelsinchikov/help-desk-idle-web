import Foundation
import Supabase
import HelpDeskCore

/// Адрес и ключ проекта Supabase из `Secrets.plist` (в .gitignore).
/// Нет файла — облако выключено, игра работает только локально.
nonisolated struct SupabaseConfig {
    let url: URL
    let key: String

    static func load() -> SupabaseConfig? {
        guard let fileURL = Bundle.main.url(forResource: "Secrets", withExtension: "plist"),
              let dict = NSDictionary(contentsOf: fileURL) as? [String: Any],
              let urlString = dict["SUPABASE_URL"] as? String,
              let url = URL(string: urlString),
              let key = dict["SUPABASE_KEY"] as? String,
              !key.isEmpty
        else { return nil }
        return SupabaseConfig(url: url, key: key)
    }
}

nonisolated enum CloudError: Error {
    case timeout
}

/// Строка таблицы `public.game_saves` (см. supabase/migrations).
nonisolated private struct SaveRow: Codable {
    let userId: UUID
    let payload: GameState
    let schemaVersion: Int
    let lifetimeEarnings: Double
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case payload
        case schemaVersion = "schema_version"
        case lifetimeEarnings = "lifetime_earnings"
        case updatedAt = "updated_at"
    }
}

/// Облачный бэкап: анонимный вход + одна строка на игрока.
actor CloudSaveService {
    private let client: SupabaseClient

    init(config: SupabaseConfig) {
        client = SupabaseClient(supabaseURL: config.url, supabaseKey: config.key)
    }

    /// Сессия хранится в Keychain, поэтому после переустановки игрок остаётся тем же.
    private func userId() async throws -> UUID {
        if let session = try? await client.auth.session {
            return session.user.id
        }
        return try await client.auth.signInAnonymously().user.id
    }

    func upload(_ state: GameState) async throws {
        let row = SaveRow(
            userId: try await userId(),
            payload: state,
            schemaVersion: state.schemaVersion,
            lifetimeEarnings: state.lifetimeEarnings,
            updatedAt: Date()
        )
        try await client.from("game_saves").upsert(row).execute()
    }

    func download() async throws -> GameState? {
        let id = try await userId()
        let rows: [SaveRow] = try await client
            .from("game_saves")
            .select()
            .eq("user_id", value: id.uuidString)
            .limit(1)
            .execute()
            .value
        return rows.first?.payload
    }

    /// download(), но не дольше `seconds` — чтобы плохая сеть не держала экран загрузки.
    func download(timeout seconds: Double) async throws -> GameState? {
        try await withThrowingTaskGroup(of: GameState?.self) { group in
            group.addTask { try await self.download() }
            group.addTask {
                try await Task.sleep(for: .seconds(seconds))
                throw CloudError.timeout
            }
            defer { group.cancelAll() }
            return try await group.next() ?? nil
        }
    }
}
