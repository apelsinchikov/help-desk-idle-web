import XCTest
@testable import HelpDeskCore

final class ContentTests: XCTestCase {
    func testBundledContentHas12JobsInOrder() throws {
        let content = try GameContent.bundled()
        XCTAssertEqual(content.jobs.count, 12)
        XCTAssertEqual(content.jobs.first?.id, "reboot")
        XCTAssertEqual(content.jobs.last?.id, "ddos_rivals")
        XCTAssertEqual(content.job("plug_mouse")?.baseCost, 60)
        XCTAssertEqual(content.job("ddos_rivals")?.time, 36864)
        XCTAssertEqual(content.previousJob(of: "plug_mouse")?.id, "reboot")
        XCTAssertNil(content.previousJob(of: "reboot"))
        XCTAssertEqual(content.config.offlineCapHours, 24)
    }

    func testMilestonesCoverEveryJob() throws {
        let content = try GameContent.bundled()
        for job in content.jobs {
            XCTAssertTrue(
                content.milestones.contains { $0.jobId == job.id && $0.level == 25 },
                "нет порога 25 у \(job.id)"
            )
        }
    }
}
