import Foundation

/// Формулы из «The Math of Idle Games, Part I» (Pecorella). См. docs/ECONOMY.md.
public enum Economy {
    /// cost_next = b · r^k
    public static func nextCost(base: Double, rate: Double, owned: Int) -> Double {
        base * pow(rate, Double(owned))
    }

    /// cost(n) = b · r^k · (r^n − 1) / (r − 1)
    public static func bulkCost(base: Double, rate: Double, owned: Int, count: Int) -> Double {
        guard count > 0 else { return 0 }
        if count == 1 { return nextCost(base: base, rate: rate, owned: owned) }
        if rate == 1 { return base * Double(count) }
        return nextCost(base: base, rate: rate, owned: owned) * (pow(rate, Double(count)) - 1) / (rate - 1)
    }

    /// max = floor( log( c·(r−1) / (b·r^k) + 1 ) / log(r) ), с поправкой на погрешность Double:
    /// гарантирует bulkCost(max) ≤ money.
    public static func maxAffordable(base: Double, rate: Double, owned: Int, money: Double) -> Int {
        guard money > 0, base > 0, rate > 1, money.isFinite else { return 0 }
        let first = nextCost(base: base, rate: rate, owned: owned)
        guard first.isFinite, first <= money else { return 0 }

        let raw = floor(log(money * (rate - 1) / first + 1) / log(rate))
        var n = raw.isFinite ? Int(min(max(raw, 0), 1_000_000)) : 1

        func fits(_ count: Int) -> Bool {
            bulkCost(base: base, rate: rate, owned: owned, count: count) <= money
        }
        // Погрешность формулы — максимум на одну-две единицы.
        for _ in 0..<3 where n > 0 && !fits(n) { n -= 1 }
        for _ in 0..<3 where fits(n + 1) { n += 1 }
        // Страховка от переполнения: делим пополам, пока не влезет.
        while n > 0 && !fits(n) { n /= 2 }
        return n
    }

    /// Выплата за цикл: revenue · level · M
    public static func payout(revenue: Double, level: Int, profitMultiplier: Double) -> Double {
        revenue * Double(level) * profitMultiplier
    }

    /// Длительность цикла: time / S
    public static func cycle(time: Double, speedMultiplier: Double) -> Double {
        time / max(speedMultiplier, .leastNonzeroMagnitude)
    }
}
