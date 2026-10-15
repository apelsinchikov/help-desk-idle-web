import Foundation
import Observation

/// Вся игровая логика этапа 1. Прогресс работ вычисляется из `startedAt`,
/// поэтому одинаково работает онлайн (тик) и оффлайн (`resume`).
@MainActor
@Observable
public final class GameEngine {
    public private(set) var state: GameState
    public let content: GameContent
    @ObservationIgnored private let clock: () -> Date

    public init(content: GameContent, state: GameState, now: @escaping () -> Date = Date.init) {
        self.content = content
        self.state = state
        self.clock = now
    }

    // MARK: - Расчёты

    public func level(of jobId: String) -> Int {
        state.jobs[jobId]?.level ?? 0
    }

    private var levels: [String: Int] {
        Dictionary(uniqueKeysWithValues: content.jobs.map { ($0.id, level(of: $0.id)) })
    }

    public func cycle(of jobId: String) -> Double {
        guard let job = content.job(jobId) else { return .infinity }
        let speed = MilestoneMath.speedMultiplier(jobId: jobId, levels: levels, milestones: content.milestones)
        return Economy.cycle(time: job.time, speedMultiplier: speed)
    }

    public func payout(of jobId: String) -> Double {
        guard let job = content.job(jobId) else { return 0 }
        let profit = MilestoneMath.profitMultiplier(jobId: jobId, levels: levels, milestones: content.milestones)
        return Economy.payout(revenue: job.revenue, level: level(of: jobId), profitMultiplier: profit)
    }

    public func nextMilestone(of jobId: String) -> Milestone? {
        MilestoneMath.nextMilestone(jobId: jobId, level: level(of: jobId), milestones: content.milestones)
    }

    /// Доход в секунду от работ с менеджерами.
    public var incomePerSecond: Double {
        content.jobs.reduce(0) { sum, job in
            guard let js = state.jobs[job.id], js.level > 0, js.hasManager else { return sum }
            return sum + payout(of: job.id) / cycle(of: job.id)
        }
    }

    // MARK: - Статус

    public func status(of jobId: String) -> JobStatus {
        status(of: jobId, at: clock())
    }

    private func status(of jobId: String, at now: Date) -> JobStatus {
        guard let js = state.jobs[jobId], content.job(jobId) != nil else {
            return .locked(requirementMet: false)
        }
        if js.level == 0 { return .locked(requirementMet: requirementMet(jobId)) }

        let cycle = cycle(of: jobId)
        if js.hasManager && cycle < content.config.fastCycleThreshold {
            return .streaming(perSecond: payout(of: jobId) / cycle)
        }
        guard let start = js.startedAt else { return .idle }

        let elapsed = max(0, now.timeIntervalSince(start))
        if elapsed >= cycle {
            if !js.hasManager { return .ready }
            let into = elapsed.truncatingRemainder(dividingBy: cycle)
            return .running(progress: into / cycle, remaining: cycle - into)
        }
        return .running(progress: elapsed / cycle, remaining: cycle - elapsed)
    }

    private func requirementMet(_ jobId: String) -> Bool {
        guard let job = content.job(jobId) else { return false }
        guard let previous = content.previousJob(of: jobId) else { return true }
        return level(of: previous.id) >= job.unlockLevel
    }

    // MARK: - Действия игрока

    /// Тап по строке работы: idle → старт; ready → сбор и новый цикл.
    public func tap(jobId: String) {
        let now = clock()
        switch status(of: jobId, at: now) {
        case .idle:
            state.jobs[jobId]?.startedAt = now
        case .ready:
            credit(payout(of: jobId))
            state.jobs[jobId]?.startedAt = now
        default:
            break
        }
    }

    public func quote(jobId: String, mode: BuyMode) -> (count: Int, cost: Double) {
        guard let job = content.job(jobId) else { return (0, .infinity) }
        let owned = level(of: jobId)
        let count: Int
        switch mode {
        case .one: count = 1
        case .ten: count = 10
        case .hundred: count = 100
        case .max:
            count = Economy.maxAffordable(base: job.baseCost, rate: job.growthRate, owned: owned, money: state.money)
            if count == 0 {
                return (0, Economy.nextCost(base: job.baseCost, rate: job.growthRate, owned: owned))
            }
        }
        return (count, Economy.bulkCost(base: job.baseCost, rate: job.growthRate, owned: owned, count: count))
    }

    @discardableResult
    public func buy(jobId: String, mode: BuyMode) -> Bool {
        guard level(of: jobId) >= 1 else { return false }
        let q = quote(jobId: jobId, mode: mode)
        guard q.count > 0, q.cost.isFinite, q.cost <= state.money else { return false }
        state.money -= q.cost
        state.jobs[jobId]?.level += q.count
        return true
    }

    public func canUnlock(jobId: String) -> Bool {
        guard let job = content.job(jobId), level(of: jobId) == 0 else { return false }
        return requirementMet(jobId) && state.money >= job.baseCost
    }

    @discardableResult
    public func unlock(jobId: String) -> Bool {
        guard canUnlock(jobId: jobId), let job = content.job(jobId) else { return false }
        state.money -= job.baseCost
        state.jobs[jobId]?.level = 1
        return true
    }

    public func canHireManager(jobId: String) -> Bool {
        guard let job = content.job(jobId), let js = state.jobs[jobId] else { return false }
        return js.level >= 1 && !js.hasManager && state.money >= job.managerCost
    }

    @discardableResult
    public func hireManager(jobId: String) -> Bool {
        guard canHireManager(jobId: jobId), let job = content.job(jobId) else { return false }
        state.money -= job.managerCost
        state.jobs[jobId]?.hasManager = true
        if state.jobs[jobId]?.startedAt == nil {
            state.jobs[jobId]?.startedAt = clock()
        }
        return true
    }

    public func updateSettings(_ change: (inout PlayerSettings) -> Void) {
        change(&state.settings)
    }

    // MARK: - Время

    /// Догоняет время до `now`: работы с менеджером собирают все завершённые циклы.
    /// `cap` — максимум учитываемого времени (оффлайн-лимит). Возвращает заработанное.
    @discardableResult
    public func advance(to now: Date, cap: TimeInterval? = nil) -> Double {
        var earned = 0.0
        for job in content.jobs {
            guard var js = state.jobs[job.id], js.level > 0, js.hasManager else { continue }
            var start = js.startedAt ?? now
            if start > now { start = now }                       // часы перевели назад
            if let cap { start = max(start, now.addingTimeInterval(-cap)) }

            let cycle = cycle(of: job.id)
            let completed = floor(now.timeIntervalSince(start) / cycle)
            if completed > 0 && completed.isFinite {
                earned += payout(of: job.id) * completed
                start = start.addingTimeInterval(completed * cycle)
            }
            js.startedAt = start
            state.jobs[job.id] = js
        }
        credit(earned)
        if now > state.lastActiveAt { state.lastActiveAt = now }
        return earned
    }

    /// Возврат в игру. nil — если отсутствие было короче минуты или часы ушли назад.
    public func resume(at now: Date) -> OfflineReport? {
        let elapsed = now.timeIntervalSince(state.lastActiveAt)
        guard elapsed >= 60 else {
            advance(to: now)
            return nil
        }
        let earned = advance(to: now, cap: content.config.offlineCapHours * 3_600)
        let ready = content.jobs.filter { status(of: $0.id, at: now) == .ready }.count
        return OfflineReport(elapsed: elapsed, earned: earned, readyJobs: ready)
    }

    /// Начать заново (настройки сохраняются).
    public func reset(now: Date) {
        let settings = state.settings
        state = GameState.new(content: content, now: now, language: settings.language)
        state.settings = settings
    }

    /// Подменить состояние целиком (загрузка из облака).
    public func replaceState(_ newState: GameState) {
        state = newState
    }

    private func credit(_ amount: Double) {
        guard amount > 0, amount.isFinite else { return }
        state.money += amount
        state.lifetimeEarnings += amount
    }
}
