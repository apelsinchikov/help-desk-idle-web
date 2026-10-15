// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "HelpDeskCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "HelpDeskCore", targets: ["HelpDeskCore"])
    ],
    targets: [
        .target(
            name: "HelpDeskCore",
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "HelpDeskCoreTests",
            dependencies: ["HelpDeskCore"]
        )
    ],
    swiftLanguageVersions: [.v5]
)
