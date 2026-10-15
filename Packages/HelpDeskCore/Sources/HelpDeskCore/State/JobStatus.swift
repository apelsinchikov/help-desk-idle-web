import Foundation

public enum BuyMode: String, Codable, CaseIterable, Sendable {
    case one, ten, hundred, max

    /// Следующий режим для кнопки «Купить ×N».
    public var next: BuyMode {
        let all = BuyMode.allCases
        return all[(all.firstIndex(of: self)! + 1) % all.count]
    }
}

public enum JobStatus: Equatable, Sendable {
    /// Уровень 0. `requirementMet` — выполнено ли условие по предыдущей работе.
    case locked(requirementMet: Bool)
    /// Открыта, цикл не запущен — ждёт тапа.
    case idle
    case running(progress: Double, remaining: TimeInterval)
    /// Цикл закончился, деньги ждут сбора (только без менеджера).
    case ready
    /// Цикл быстрее порога: показываем доход в секунду.
    case streaming(perSecond: Double)
}
