import Foundation

/// Неизменяемое описание работы (аналог бизнеса AdCap). Значения — из `jobs.json`.
public struct JobDefinition: Codable, Identifiable, Sendable, Equatable {
    public let id: String
    public let order: Int
    public let baseCost: Double
    public let growthRate: Double
    public let time: Double
    public let revenue: Double
    public let unlockLevel: Int
    public let managerCost: Double
    public let iconKey: String
}
