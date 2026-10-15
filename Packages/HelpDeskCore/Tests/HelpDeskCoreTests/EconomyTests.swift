import XCTest
@testable import HelpDeskCore

final class EconomyTests: XCTestCase {
    func testNextCostMatchesPartOneExample() {
        // Part I: 4 · 1.07^10 = 7.87
        XCTAssertEqual(Economy.nextCost(base: 4, rate: 1.07, owned: 10), 7.87, accuracy: 0.01)
    }

    func testBulkCost() {
        XCTAssertEqual(Economy.bulkCost(base: 4, rate: 1.07, owned: 0, count: 10), 55.27, accuracy: 0.01)
        XCTAssertEqual(
            Economy.bulkCost(base: 4, rate: 1.07, owned: 7, count: 1),
            Economy.nextCost(base: 4, rate: 1.07, owned: 7),
            accuracy: 1e-9
        )
        XCTAssertEqual(Economy.bulkCost(base: 4, rate: 1.07, owned: 0, count: 0), 0)
    }

    func testMaxAffordable() {
        XCTAssertEqual(Economy.maxAffordable(base: 4, rate: 1.07, owned: 0, money: 55.27), 10)
        XCTAssertEqual(Economy.maxAffordable(base: 4, rate: 1.07, owned: 0, money: 55.26), 9)
        XCTAssertEqual(Economy.maxAffordable(base: 4, rate: 1.07, owned: 0, money: 3.99), 0)
        let huge = Economy.maxAffordable(base: 4, rate: 1.07, owned: 5000, money: 1e300)
        XCTAssertGreaterThanOrEqual(huge, 0)
    }

    func testMaxAffordableNeverExceedsMoney() {
        for money in [1.0, 4.0, 4.28, 99.99, 1234.5, 1e9, 3.3e15, 7.7e40, 1e300] {
            for owned in [0, 1, 25, 333, 4000] {
                let n = Economy.maxAffordable(base: 60, rate: 1.15, owned: owned, money: money)
                XCTAssertLessThanOrEqual(
                    Economy.bulkCost(base: 60, rate: 1.15, owned: owned, count: n), money,
                    "money \(money), owned \(owned), n \(n)"
                )
            }
        }
    }

    func testPayoutAndCycle() {
        XCTAssertEqual(Economy.payout(revenue: 60, level: 64, profitMultiplier: 1), 3840)
        XCTAssertEqual(Economy.cycle(time: 3, speedMultiplier: 4), 0.75)
    }

    func testMilestoneSpeedMultiplier() throws {
        let content = try GameContent.bundled()
        var levels = Dictionary(uniqueKeysWithValues: content.jobs.map { ($0.id, 0) })
        levels["reboot"] = 112
        XCTAssertEqual(MilestoneMath.speedMultiplier(jobId: "reboot", levels: levels, milestones: content.milestones), 8)

        // все работы ≥ 25 → включается глобальный ×2
        for key in levels.keys { levels[key] = max(levels[key]!, 25) }
        XCTAssertEqual(MilestoneMath.speedMultiplier(jobId: "reboot", levels: levels, milestones: content.milestones), 16)
        XCTAssertEqual(MilestoneMath.speedMultiplier(jobId: "plug_mouse", levels: levels, milestones: content.milestones), 4)
    }

    func testNextMilestone() throws {
        let content = try GameContent.bundled()
        XCTAssertEqual(MilestoneMath.nextMilestone(jobId: "plug_mouse", level: 64, milestones: content.milestones)?.level, 100)
        XCTAssertEqual(MilestoneMath.nextMilestone(jobId: "plug_mouse", level: 0, milestones: content.milestones)?.level, 25)
    }
}
