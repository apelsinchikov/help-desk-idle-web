import Foundation

public enum ContentError: Error, Equatable {
    case missingResource(String)
}

/// Весь баланс игры, загруженный из JSON.
public struct GameContent: Sendable {
    /// Отсортированы по `order`.
    public let jobs: [JobDefinition]
    public let milestones: [Milestone]
    public let config: GameConfig

    public init(jobs: [JobDefinition], milestones: [Milestone], config: GameConfig) {
        self.jobs = jobs.sorted { $0.order < $1.order }
        self.milestones = milestones
        self.config = config
    }

    public init(jobs: Data, milestones: Data, config: Data) throws {
        let decoder = JSONDecoder()
        self.init(
            jobs: try decoder.decode([JobDefinition].self, from: jobs),
            milestones: try decoder.decode([Milestone].self, from: milestones),
            config: try decoder.decode(GameConfig.self, from: config)
        )
    }

    public static func bundled() throws -> GameContent {
        func load(_ name: String) throws -> Data {
            guard let url = Bundle.module.url(forResource: name, withExtension: "json") else {
                throw ContentError.missingResource(name)
            }
            return try Data(contentsOf: url)
        }
        return try GameContent(jobs: load("jobs"), milestones: load("milestones"), config: load("config"))
    }

    public func job(_ id: String) -> JobDefinition? {
        jobs.first { $0.id == id }
    }

    public func previousJob(of id: String) -> JobDefinition? {
        guard let index = jobs.firstIndex(where: { $0.id == id }), index > 0 else { return nil }
        return jobs[index - 1]
    }
}
