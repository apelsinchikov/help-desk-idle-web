import SwiftUI
import UIKit
import Observation
import HelpDeskCore

enum AppPhase {
    case loading
    case playing
}

enum CloudStatus: Equatable {
    case disabled
    case syncing
    case synced(Date)
    case offline
}

enum AppRoute: String, Identifiable {
    case managers, settings
    var id: String { rawValue }
}

/// Связывает движок, сохранение, язык и навигацию.
@Observable
final class AppModel {
    let engine: GameEngine
    let l10n: LocalizationManager
    var phase: AppPhase = .loading
    var buyMode: BuyMode = .one
    var offlineReport: OfflineReport?
    var showMenu = false
    var route: AppRoute?
    var cloudStatus: CloudStatus = .disabled

    private let saver: SaveCoordinator
    @ObservationIgnored private var tickTask: Task<Void, Never>?
    @ObservationIgnored private var started = false
    private let cloud: CloudSaveService?
    @ObservationIgnored private var lastUpload = Date.distantPast
    private let uploadInterval: TimeInterval = 60

    init() {
        let content: GameContent
        do { content = try GameContent.bundled() } catch {
            fatalError("Не найден баланс игры (jobs.json): \(error)")
        }
        let saver = SaveCoordinator(store: SaveCoordinator.defaultStore(), interval: content.config.autosaveSeconds)
        let state = saver.load()
            ?? GameState.new(content: content, now: Date(), language: LocalizationManager.systemLanguage)
        self.saver = saver
        self.engine = GameEngine(content: content, state: state)
        self.l10n = LocalizationManager(language: state.settings.language)
        self.cloud = SupabaseConfig.load().map { CloudSaveService(config: $0) }
    }

    // MARK: - Жизненный цикл

    func start() async {
        guard !started else { return }
        started = true
        let minimumLoading = Task { try? await Task.sleep(for: .seconds(1.4)) }
        await syncFromCloud()
        await minimumLoading.value
        offlineReport = engine.resume(at: Date())
        phase = .playing
        startTicking()
    }

    func onScenePhase(_ phase: ScenePhase) {
        guard started else { return }
        switch phase {
        case .background:
            stopTicking()
            saver.saveNow(engine.state)
            uploadIfNeeded(force: true)
        case .active:
            if tickTask == nil {
                if let report = engine.resume(at: Date()) { offlineReport = report }
                startTicking()
            }
        default:
            break
        }
    }

    private func startTicking() {
        tickTask?.cancel()
        tickTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                let now = Date()
                self.engine.advance(to: now)
                self.saver.tick(self.engine.state, now: now)
                self.uploadIfNeeded(force: false)
                try? await Task.sleep(for: .milliseconds(100))
            }
        }
    }

    private func stopTicking() {
        tickTask?.cancel()
        tickTask = nil
    }

    // MARK: - Облако

    /// При запуске: берём облачный сейв, если в нём заработано больше (см. SavePicker).
    private func syncFromCloud() async {
        guard let cloud else { return }
        cloudStatus = .syncing
        do {
            let remote = try await cloud.download(timeout: 5)
            if let chosen = SavePicker.pick(local: engine.state, remote: remote), chosen != engine.state {
                engine.replaceState(chosen)
                l10n.language = chosen.settings.language
                saver.saveNow(chosen)
            }
            cloudStatus = .synced(Date())
        } catch {
            cloudStatus = .offline
        }
    }

    /// Выгрузка не чаще раза в минуту (и принудительно при уходе в фон). Ошибки игру не блокируют.
    private func uploadIfNeeded(force: Bool) {
        guard let cloud else { return }
        let now = Date()
        guard force || now.timeIntervalSince(lastUpload) >= uploadInterval else { return }
        lastUpload = now
        let snapshot = engine.state
        Task {
            do {
                try await cloud.upload(snapshot)
                cloudStatus = .synced(Date())
            } catch {
                cloudStatus = .offline
            }
        }
    }

    // MARK: - Действия

    /// Тап по работе. Возвращает собранную сумму (для «+$X»), если был сбор.
    @discardableResult
    func tapJob(_ id: String) -> Double? {
        let wasReady = engine.status(of: id) == .ready
        let before = engine.state.money
        engine.tap(jobId: id)
        guard wasReady else { return nil }
        haptic()
        return engine.state.money - before
    }

    func buy(_ id: String) {
        if engine.buy(jobId: id, mode: buyMode) { saver.saveNow(engine.state) }
    }

    func unlock(_ id: String) {
        if engine.unlock(jobId: id) {
            haptic()
            saver.saveNow(engine.state)
        }
    }

    func hireManager(_ id: String) {
        if engine.hireManager(jobId: id) {
            haptic()
            saver.saveNow(engine.state)
        }
    }

    func cycleBuyMode() {
        buyMode = buyMode.next
    }

    func setLanguage(_ language: AppLanguage) {
        engine.updateSettings { $0.language = language }
        l10n.language = language
        saver.saveNow(engine.state)
    }

    func setHaptics(_ on: Bool) {
        engine.updateSettings { $0.haptics = on }
        saver.saveNow(engine.state)
    }

    func resetProgress() {
        engine.reset(now: Date())
        saver.saveNow(engine.state)
        uploadIfNeeded(force: true)
        route = nil
        showMenu = false
    }

    /// Сколько менеджеров можно нанять прямо сейчас (бейдж на «Меню»).
    var hireableManagers: Int {
        engine.content.jobs.filter { engine.canHireManager(jobId: $0.id) }.count
    }

    private func haptic() {
        guard engine.state.settings.haptics else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
