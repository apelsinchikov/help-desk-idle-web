import SwiftUI

struct LoadingScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.theme) private var theme
    @State private var statusIndex = Int.random(in: 1...5)
    @State private var progress: CGFloat = 0.08

    var body: some View {
        let l10n = model.l10n
        ZStack {
            theme.accent.ignoresSafeArea()
            Ellipse()
                .fill(theme.accentDark.opacity(0.45))
                .frame(width: 560, height: 440)
                .offset(y: 300)

            VStack(spacing: 24) {
                VStack(spacing: 2) {
                    Text(verbatim: "HELP DESK")
                        .foregroundStyle(theme.onAccent)
                    Text(verbatim: "IDLE")
                        .foregroundStyle(theme.amber)
                }
                .font(AppFont.display(44))
                Text(verbatim: l10n.t("loading.tagline"))
                    .font(AppFont.body(13, weight: .heavy))
                    .foregroundStyle(theme.accent)
                    .padding(.horizontal, 12).padding(.vertical, 4)
                    .background(theme.card, in: RoundedRectangle(cornerRadius: 10))

                IconProvider.image(for: "avatar")
                    .resizable()
                    .scaledToFit()
                    .padding(28)
                    .frame(width: 210, height: 230)
                    .background(theme.background, in: RoundedRectangle(cornerRadius: 48))
                    .padding(.top, 24)
                    .accessibilityHidden(true)

                Spacer()

                VStack(spacing: 10) {
                    Text(verbatim: l10n.t("loading.status.\(statusIndex)"))
                        .font(AppFont.body(16, weight: .heavy))
                        .foregroundStyle(theme.onAccent)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(theme.accentDark)
                            Capsule().fill(theme.amber).frame(width: geo.size.width * progress)
                        }
                    }
                    .frame(height: 16)
                    .overlay(Capsule().stroke(theme.card, lineWidth: 2))
                }
            }
            .padding(.horizontal, 32)
            .padding(.top, 70)
            .padding(.bottom, 40)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.3)) { progress = 0.96 }
        }
    }
}
