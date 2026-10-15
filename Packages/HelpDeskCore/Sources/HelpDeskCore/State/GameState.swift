import Foundation

public struct JobState: Codable, Equatable, Sendable {
    public var level: Int
    public var hasManager: Bool
    /// Начало текущего цикла; nil — работа стоит (ждёт тапа).
    public var startedAt: Date?

    public init(level: Int, hasManager: Bool = false, startedAt: Date? = nil) {
        self.level = level
        self.hasManager = hasManager
        self.startedAt = startedAt
    }
}

public struct PlayerSettings: Codable, Equatable, Sendable {
    public var language: AppLanguage
    public var haptics: Bool

    public init(language: AppLanguage, haptics: Bool = true) {
        self.language = language
        self.haptics = haptics
    }
}

/// Всё, что сохраняется. Меняя формат — увеличь `currentSchema`.
public struct GameState: Codable, Equatable, Sendable {
    public static let currentSchema = 1

    public var schemaVersion: Int
    public var money: Double
    public var lifetimeEarnings: Double
    public var jobs: [String: JobState]
    public var lastActiveAt: Date
    public var settings: PlayerSettings

    public init(
        schemaVersion: Int = GameState.currentSchema,
        money: Double,
        lifetimeEarnings: Double,
        jobs: [String: JobState],
        lastActiveAt: Date,
        settings: PlayerSettings
    ) {
        self.schemaVersion = schemaVersion
        self.money = money
        self.lifetimeEarnings = lifetimeEarnings
        self.jobs = jobs
        self.lastActiveAt = lastActiveAt
        self.settings = settings
    }

    /// Новая игра: первая работа открыта (уровень 1), остальные закрыты.
    public static func new(content: GameContent, now: Date, language: AppLanguage) -> GameState {
        var jobs: [String: JobState] = [:]
        for (index, job) in content.jobs.enumerated() {
            jobs[job.id] = JobState(level: index == 0 ? 1 : 0)
        }
        return GameState(
            money: 0,
            lifetimeEarnings: 0,
            jobs: jobs,
            lastActiveAt: now,
            settings: PlayerSettings(language: language)
        )
    }
}
