import XCTest
@testable import HelpDeskCore

@MainActor
final class OfflineTests: XCTestCase {
    private var t = Date(timeIntervalSinceReferenceDate: 0)
    private var content: GameContent!

    override func setUp() async throws {
        content = try GameContent.bundled()
        t = Date(timeIntervalSinceReferenceDate: 0)
    }

    private func engine(_ edit: (inout GameState) -> Void) -> GameEngine {
        var state = GameState.new(content: content, now: t, language: .ru)
        edit(&state)
        return GameEngine(content: content, state: state, now: { [unowned self] in self.t })
    }

    func testTwoHoursWithManager() {
        let e = engine { $0.jobs["reboot"] = JobState(level: 10, hasManager: true, startedAt: self.t) }
        t += 7200
        let report = e.resume(at: t)
        XCTAssertEqual(report?.earned, 10 * floor(7200 / 0.6))
        XCTAssertEqual(report?.elapsed, 7200)
    }

    func testThirtyDaysIsCappedAt24Hours() {
        let e = engine { $0.jobs["reboot"] = JobState(level: 10, hasManager: true, startedAt: self.t) }
        t += 30 * 86_400
        let report = e.resume(at: t)
        XCTAssertEqual(report?.earned, 10 * floor(86_400 / 0.6))
        XCTAssertEqual(report?.elapsed, 30 * 86_400)
        XCTAssertTrue(e.state.money.isFinite)
    }

    func testJobWithoutManagerIsReadyAndNotPaid() {
        let e = engine {
            $0.jobs["reboot"] = JobState(level: 10, hasManager: false, startedAt: self.t)
        }
        t += 3600
        let report = e.resume(at: t)
        XCTAssertEqual(report?.readyJobs, 1)
        XCTAssertEqual(report?.earned, 0)
    }

    func testShortAbsenceAndClockBackwardsGiveNoReport() {
        let e = engine { _ in }
        t += 30
        XCTAssertNil(e.resume(at: t))
        t -= 3600
        XCTAssertNil(e.resume(at: t))
    }
}
