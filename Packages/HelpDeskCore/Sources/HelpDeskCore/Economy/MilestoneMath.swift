import Foundation

/// Мультипликаторы от порогов уровней (достижений).
/// `levels` должен содержать уровни ВСЕХ работ (закрытая = 0) — от этого зависят глобальные пороги.
public enum MilestoneMath {
    public static func speedMultiplier(jobId: String, levels: [String: Int], milestones: [Milestone]) -> Double {
        multiplier(.speed, jobId: jobId, levels: levels, milestones: milestones)
    }

    public static func profitMultiplier(jobId: String, levels: [String: Int], milestones: [Milestone]) -> Double {
        multiplier(.profit, jobId: jobId, levels: levels, milestones: milestones)
    }

    /// Ближайший ещё не достигнутый порог этой работы.
    public static func nextMilestone(jobId: String, level: Int, milestones: [Milestone]) -> Milestone? {
        milestones
            .filter { $0.jobId == jobId && $0.level > level }
            .min { $0.level < $1.level }
    }

    private static func multiplier(
        _ effect: MilestoneEffect,
        jobId: String,
        levels: [String: Int],
        milestones: [Milestone]
    ) -> Double {
        let own = levels[jobId] ?? 0
        let lowest = levels.values.min() ?? 0
        var result = 1.0
        for milestone in milestones where milestone.effect == effect {
            if let target = milestone.jobId {
                if target == jobId && own >= milestone.level { result *= milestone.value }
            } else if lowest >= milestone.level {
                result *= milestone.value
            }
        }
        return result
    }
}
