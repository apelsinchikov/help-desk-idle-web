import XCTest
@testable import HelpDeskCore

@MainActor
final class GameEngineTests: XCTestCase {
    private var t = Date(timeIntervalSinceReferenceDate: 0)
    private var content: GameContent!

    override func setUp() async throws {
        content = try GameContent.bundled()
        t = Date(timeIntervalSinceReferenceDate: 0)
    }

    private func engine(_ edit: (inout GameState) -> Void = { _ in }) -> GameEngine {
        var state = GameState.new(content: content, now: t, language: .ru)
        edit(&state)
        return GameEngine(content: content, state: state, now: { [unowned self] in self.t })
    }

    func testTapStartsThenReadyThenCollect() {
        let e = engine()
        XCTAssertEqual(e.status(of: "reboot"), .idle)
        e.tap(jobId: "reboot")
        guard case .running = e.status(of: "reboot") else { return XCTFail("ожидали running") }
        t += 0.6
        XCTAssertEqual(e.status(of: "reboot"), .ready)
        XCTAssertEqual(e.state.money, 0)
        e.tap(jobId: "reboot")
        XCTAssertEqual(e.state.money, 1)
        XCTAssertEqual(e.state.lifetimeEarnings, 1)
        XCTAssertEqual(e.status(of: "reboot"), .idle, "после сбора работа стоит до нового тапа")
        t += 5
        XCTAssertEqual(e.status(of: "reboot"), .idle, "сама не стартует")
        e.tap(jobId: "reboot")
        guard case .running = e.status(of: "reboot") else { return XCTFail("старт только по тапу") }
    }

    func testReadyJobIsCollectedOnlyOnce() {
        let e = engine()
        e.tap(jobId: "reboot")
        t += 0.6
        e.tap(jobId: "reboot")
        e.tap(jobId: "reboot")   // второй тап — это уже новый старт, не второй сбор
        XCTAssertEqual(e.state.money, 1)
        guard case .running = e.status(of: "reboot") else { return XCTFail("второй тап запускает цикл") }
    }

    func testWithoutManagerJobWaitsWhenReady() {
        let e = engine()
        e.tap(jobId: "reboot")
        t += 10
        e.advance(to: t)
        XCTAssertEqual(e.state.money, 0)
        XCTAssertEqual(e.status(of: "reboot"), .ready)
    }

    func testBuyOneAndInsufficientMoney() {
        let poor = engine { $0.money = 3.99 }
        XCTAssertFalse(poor.buy(jobId: "reboot", mode: .one))
        XCTAssertEqual(poor.level(of: "reboot"), 1)

        let rich = engine { $0.money = 100 }
        XCTAssertTrue(rich.buy(jobId: "reboot", mode: .one))
        XCTAssertEqual(rich.level(of: "reboot"), 2)
        XCTAssertEqual(rich.state.money, 100 - 4.28, accuracy: 1e-9)
    }

    func testBuyMaxNeverNegative() {
        let e = engine { $0.money = 1000 }
        XCTAssertTrue(e.buy(jobId: "reboot", mode: .max))
        XCTAssertGreaterThanOrEqual(e.state.money, 0)
        XCTAssertFalse(e.buy(jobId: "plug_mouse", mode: .max), "закрытую работу покупать нельзя")
    }

    func testUnlockRequiresLevel25AndMoney() {
        let early = engine { $0.jobs["reboot"]?.level = 24; $0.money = 1e6 }
        XCTAssertFalse(early.unlock(jobId: "plug_mouse"))
        XCTAssertEqual(early.status(of: "plug_mouse"), .locked(requirementMet: false))

        let ready = engine { $0.jobs["reboot"]?.level = 25; $0.money = 1e6 }
        XCTAssertEqual(ready.status(of: "plug_mouse"), .locked(requirementMet: true))
        XCTAssertTrue(ready.unlock(jobId: "plug_mouse"))
        XCTAssertEqual(ready.level(of: "plug_mouse"), 1)
        XCTAssertEqual(ready.state.money, 1e6 - 60)

        let broke = engine { $0.jobs["reboot"]?.level = 25; $0.money = 59 }
        XCTAssertFalse(broke.unlock(jobId: "plug_mouse"))
    }

    func testManagerAutoCollects() {
        let e = engine { $0.jobs["reboot"]?.level = 10; $0.money = 1000 }
        XCTAssertTrue(e.hireManager(jobId: "reboot"))
        XCTAssertEqual(e.state.money, 0)
        t += 6
        let earned = e.advance(to: t)
        XCTAssertEqual(earned, 10 * floor(6.0 / 0.6))
        XCTAssertEqual(e.state.money, earned)
        XCTAssertFalse(e.hireManager(jobId: "reboot"), "второй раз нанять нельзя")
    }

    func testFastCycleIsBatched() {
        let e = engine {
            $0.jobs["reboot"] = JobState(level: 300, hasManager: true, startedAt: self.t)
        }
        let cycle = 0.6 / 32
        XCTAssertEqual(e.cycle(of: "reboot"), cycle)
        XCTAssertEqual(e.status(of: "reboot"), .streaming(perSecond: 300 / cycle))
        t += 10
        XCTAssertEqual(e.advance(to: t), 300 * floor(10 / cycle))
    }

    func testClockMovedBackwards() {
        let e = engine { $0.jobs["reboot"] = JobState(level: 10, hasManager: true, startedAt: self.t) }
        XCTAssertEqual(e.advance(to: t - 3600), 0)
        XCTAssertEqual(e.state.money, 0)
        if case let .running(progress, _) = e.status(of: "reboot") {
            XCTAssertTrue((0...1).contains(progress))
        } else {
            XCTFail("ожидали running")
        }
    }

    func testQuoteMaxWhenBrokeShowsNextPrice() {
        let e = engine { $0.money = 1 }
        let q = e.quote(jobId: "reboot", mode: .max)
        XCTAssertEqual(q.count, 0)
        XCTAssertEqual(q.cost, 4.28, accuracy: 1e-9)
    }
}
