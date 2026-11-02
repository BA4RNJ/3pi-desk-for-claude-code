import SwiftUI

@MainActor final class NativeAppearance: ObservableObject {
  static let shared = NativeAppearance()
  @Published var theme = UserDefaults.standard.string(forKey: "native.theme") ?? "system"
  @Published var language = UserDefaults.standard.string(forKey: "native.language") ?? "en"
  @Published var fontScale =
    UserDefaults.standard.object(forKey: "native.fontScale") as? Double ?? 1
  @Published var accent = UserDefaults.standard.string(forKey: "native.accent") ?? "coral"
  var scheme: ColorScheme? { theme == "system" ? nil : theme == "dark" ? .dark : .light }
  func save() {
    UserDefaults.standard.set(fontScale, forKey: "native.fontScale")
    UserDefaults.standard.set(theme, forKey: "native.theme")
    UserDefaults.standard.set(language, forKey: "native.language")
    UserDefaults.standard.set(accent, forKey: "native.accent")
  }
}

@MainActor func scaled(_ value: CGFloat) -> CGFloat { value * NativeAppearance.shared.fontScale }
