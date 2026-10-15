import Foundation

public struct GameConfig: Codable, Sendable, Equatable {
    public let offlineCapHours: Double
    public let autosaveSeconds: Double
    /// Цикл короче этого порога (секунды) у работы с менеджером считается «потоком».
    public let fastCycleThreshold: Double
}
