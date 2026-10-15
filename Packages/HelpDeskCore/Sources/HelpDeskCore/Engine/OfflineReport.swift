import Foundation

public struct OfflineReport: Equatable, Sendable {
    /// Сколько реально не было игрока (для текста «Тебя не было …»).
    public let elapsed: TimeInterval
    /// Заработано за это время (с учётом оффлайн-лимита).
    public let earned: Double
    /// Работы без менеджера, ждущие сбора.
    public let readyJobs: Int

    public init(elapsed: TimeInterval, earned: Double, readyJobs: Int) {
        self.elapsed = elapsed
        self.earned = earned
        self.readyJobs = readyJobs
    }
}
