import XCTest
@testable import HelpDeskCore

final class SavePickerTests: XCTestCase {
    private func save(lifetime: Double, at seconds: Double) throws -> GameState {
        var s = GameState.new(
            content: try GameContent.bundled(),
            now: Date(timeIntervalSinceReferenceDate: seconds),
            language: .ru
        )
        s.lifetimeEarnings = lifetime
        return s
    }

    func testMoreEarningsWins() throws {
        let local = try save(lifetime: 100, at: 50)
        let remote = try save(lifetime: 500, at: 10)
        XCTAssertEqual(SavePicker.pick(local: local, remote: remote), remote)
        XCTAssertEqual(SavePicker.pick(local: remote, remote: local), remote)
    }

    func testTieTakesNewest() throws {
        let older = try save(lifetime: 100, at: 10)
        let newer = try save(lifetime: 100, at: 20)
        XCTAssertEqual(SavePicker.pick(local: older, remote: newer), newer)
    }

    func testMissingSides() throws {
        let s = try save(lifetime: 1, at: 1)
        XCTAssertEqual(SavePicker.pick(local: nil, remote: s), s)
        XCTAssertEqual(SavePicker.pick(local: s, remote: nil), s)
        XCTAssertNil(SavePicker.pick(local: nil, remote: nil))
    }
}
