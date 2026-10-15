import XCTest
@testable import HelpDeskCore

final class LocalSaveStoreTests: XCTestCase {
    private var dir: URL!
    private var content: GameContent!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        content = try GameContent.bundled()
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    private func state(money: Double) -> GameState {
        var s = GameState.new(content: content, now: Date(timeIntervalSinceReferenceDate: 0), language: .ru)
        s.money = money
        return s
    }

    func testSaveAndLoad() throws {
        let store = LocalSaveStore(directory: dir)
        XCTAssertNil(try store.load())
        try store.save(state(money: 10))
        XCTAssertEqual(try store.load(), state(money: 10))
    }

    func testCorruptedMainFallsBackToBackup() throws {
        let store = LocalSaveStore(directory: dir)
        try store.save(state(money: 1))
        try store.save(state(money: 2))   // теперь prev = 1, main = 2
        try Data("мусор".utf8).write(to: dir.appendingPathComponent("save.json"))
        XCTAssertEqual(try store.load()?.money, 1)
    }

    func testBothCorruptedReturnsNil() throws {
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try Data("{".utf8).write(to: dir.appendingPathComponent("save.json"))
        try Data("[]".utf8).write(to: dir.appendingPathComponent("save.prev.json"))
        XCTAssertNil(try LocalSaveStore(directory: dir).load())
    }

    func testFutureSchemaIsIgnored() throws {
        let store = LocalSaveStore(directory: dir)
        var future = state(money: 5)
        future.schemaVersion = 99
        try store.save(future)
        XCTAssertNil(try store.load())
    }
}
