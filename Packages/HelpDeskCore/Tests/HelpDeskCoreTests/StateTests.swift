import XCTest
@testable import HelpDeskCore

final class StateTests: XCTestCase {
    func testNewGame() throws {
        let content = try GameContent.bundled()
        let state = GameState.new(content: content, now: Date(timeIntervalSinceReferenceDate: 0), language: .ru)
        XCTAssertEqual(state.jobs["reboot"]?.level, 1)
        XCTAssertEqual(state.jobs["plug_mouse"]?.level, 0)
        XCTAssertEqual(state.jobs.count, 12)
        XCTAssertEqual(state.money, 0)
    }

    func testRoundTripJSON() throws {
        let content = try GameContent.bundled()
        var state = GameState.new(content: content, now: Date(timeIntervalSinceReferenceDate: 100), language: .en)
        state.money = 12_345.67
        state.jobs["reboot"]?.startedAt = Date(timeIntervalSinceReferenceDate: 42)
        let data = try JSONEncoder().encode(state)
        XCTAssertEqual(try JSONDecoder().decode(GameState.self, from: data), state)
    }

    func testBuyModeCycles() {
        XCTAssertEqual(BuyMode.one.next, .ten)
        XCTAssertEqual(BuyMode.max.next, .one)
    }
}
