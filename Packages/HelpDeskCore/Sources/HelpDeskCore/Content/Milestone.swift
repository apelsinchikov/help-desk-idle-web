import Foundation

public enum MilestoneEffect: String, Codable, Sendable {
    case speed
    case profit
}

/// Порог уровня → эффект. `jobId == nil` — глобальный порог (все работы ≥ level).
public struct Milestone: Codable, Sendable, Equatable {
    public let jobId: String?
    public let level: Int
    public let effect: MilestoneEffect
    public let value: Double

    public init(jobId: String?, level: Int, effect: MilestoneEffect, value: Double) {
        self.jobId = jobId
        self.level = level
        self.effect = effect
        self.value = value
    }
}
