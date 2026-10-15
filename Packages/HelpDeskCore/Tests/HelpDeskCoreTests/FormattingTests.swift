import XCTest
@testable import HelpDeskCore

final class FormattingTests: XCTestCase {
    func testNumbers() {
        XCTAssertEqual(GameNumberFormatter.format(186_420, language: .ru), "186\u{00A0}420")
        XCTAssertEqual(GameNumberFormatter.format(186_420, language: .en), "186,420")
        XCTAssertEqual(GameNumberFormatter.format(1_244_000, language: .ru), "1,24 млн")
        XCTAssertEqual(GameNumberFormatter.format(1_244_000, language: .en), "1.24 million")
        XCTAssertEqual(GameNumberFormatter.format(3.716e12, language: .ru), "3,72 трлн")
        XCTAssertEqual(GameNumberFormatter.format(1e21, language: .ru), "1 aa")
        XCTAssertEqual(GameNumberFormatter.format(4.28, language: .ru), "4,28")
        XCTAssertEqual(GameNumberFormatter.format(0, language: .ru), "0")
        XCTAssertEqual(GameNumberFormatter.format(999_950_000, language: .ru), "1 млрд")
    }

    func testDurations() {
        XCTAssertEqual(GameDurationFormatter.format(702, language: .ru), "11 мин 42 с")
        XCTAssertEqual(GameDurationFormatter.format(4800, language: .ru), "1 ч 20 мин")
        XCTAssertEqual(GameDurationFormatter.format(702, language: .en), "11 min 42 s")
        XCTAssertEqual(GameDurationFormatter.format(1.5, language: .ru), "1,5 с")
        XCTAssertEqual(GameDurationFormatter.format(-5, language: .ru), "0 с")
        XCTAssertEqual(GameDurationFormatter.format(30 * 86_400, language: .ru), "30 д")
    }
}
