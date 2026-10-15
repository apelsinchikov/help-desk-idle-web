import Foundation

public protocol SaveStore: Sendable {
    func load() throws -> GameState?
    func save(_ state: GameState) throws
}
