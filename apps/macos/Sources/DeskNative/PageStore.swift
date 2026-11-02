import AppKit
import SwiftUI

@MainActor func interfaceText(_ key: String) -> String {
  let language = NativeAppearance.shared.language
  let bundle =
    Bundle(
      path: Bundle.module.bundleURL.appendingPathComponent(language.lowercased() + ".lproj").path)
    ?? .module
  return NSLocalizedString(key, bundle: bundle, comment: "")
}
func dictionary(_ value: Any?) -> [String: Any] { value as? [String: Any] ?? [:] }
func objects(_ value: Any?) -> [[String: Any]] { value as? [[String: Any]] ?? [] }
func string(_ value: Any?) -> String { value as? String ?? "" }
func jsonText(_ value: Any?) -> String {
  guard let value, JSONSerialization.isValidJSONObject(value),
    let data = try? JSONSerialization.data(
      withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
  else { return "{}" }
  return String(decoding: data, as: UTF8.self)
}

@MainActor final class PageStore: ObservableObject {
  let model: AppModel
  @Published var page = "general"
  @Published var extensionPage = "mcp"
  @Published var scope = "user"
  @Published var fields: [String: String] = [:]
  @Published var flags: [String: Bool] = [:]
  @Published var snapshot: [String: Any] = [:]
  @Published var providers = [[String: Any]]()
  @Published var extensions: [String: Any] = [:]
  @Published var market: [String: Any] = [:]
  @Published var background = [[String: Any]]()
  @Published var versions: [String: Any] = [:]
  @Published var message = ""
  @Published var busy = false
  @Published var pluginBusy = false
  @Published var editor = false
  @Published var confirmation = false
  var pendingAction: (() -> Void)?
  init(model: AppModel) {
    self.model = model
    fields["backgroundCwd"] = model.cwd ?? FileManager.default.homeDirectoryForCurrentUser.path
  }
  var cwd: String { model.cwd ?? FileManager.default.homeDirectoryForCurrentUser.path }
  func text(_ key: String) -> Binding<String> {
    Binding(get: { self.fields[key] ?? "" }, set: { self.fields[key] = $0 })
  }
  func toggle(_ key: String) -> Binding<Bool> {
    Binding(get: { self.flags[key] ?? false }, set: { self.flags[key] = $0 })
  }
  func run(_ method: String, _ params: [String: Any] = [:], then: ((Any) -> Void)? = nil) {
    busy = true
    message = ""
    let pluginAction = [
      "extensions:pluginAction", "extensions:marketplaceAdd", "extensions:marketplaceUpdate",
      "extensions:marketplaceRemove",
    ].contains(method)
    if pluginAction { pluginBusy = true }
    model.call(method, params) { [weak self] result in
      guard let self else { return }
      self.busy = false
      if pluginAction { self.pluginBusy = false }
      switch result {
      case .success(let value): then?(value)
      case .failure(let error): self.message = error.localizedDescription
      }
    }
  }
  func load() {
    fields["theme"] = NativeAppearance.shared.theme
    fields["language"] = NativeAppearance.shared.language
    run("settings:get") { value in
      self.snapshot = dictionary(value)
      let api = dictionary(self.snapshot["api"])
      let preferences = dictionary(self.snapshot["preferences"])
      let rules = dictionary(self.snapshot["permissionRules"])
      for key in ["baseUrl", "model", "providerId", "authMode", "tokenMasked"] {
        self.fields[key] = string(api[key])
      }
      self.fields["token"] = ""
      for key in [
        "ideIntegration", "chromeIntegration", "closeToTray", "globalShortcut", "compactMode",
      ] { self.flags[key] = preferences[key] as? Bool ?? false }
      for key in ["accent", "maxBudgetUsd", "fontScale"] {
        self.fields[key] =
          preferences[key].flatMap { $0 is NSNull ? nil : String(describing: $0) } ?? ""
      }
      for key in ["additionalDirectories", "allowedTools", "disallowedTools"] {
        self.fields[key] = (preferences[key] as? [String] ?? []).joined(separator: "\n")
      }
      for key in ["allow", "ask", "deny"] {
        self.fields[key] = (rules[key] as? [String] ?? []).joined(separator: "\n")
      }
    }
    model.call("providers:list") {
      if case .success(let value) = $0 { self.providers = objects(value) }
    }
  }
  func loadPage() {
    message = ""
    if page == "extensions" { reloadExtensions() }
    if page == "usage",
      let selected = model.availableModels.first(where: { string($0["id"]) == model.modelID }),
      let pricing = selected["pricing"]
    {
      run("model:pricing", ["pricing": pricing]) { self.fields["pricing"] = string($0) }
    }
    if page == "about" { run("app:versionInfoLocal") { self.versions = dictionary($0) } }
    if page == "background" { run("background:list") { self.background = objects($0) } }
  }
  func apiPatch() -> [String: Any] {
    var patch: [String: Any] = [:]
    for key in ["baseUrl", "model", "providerId", "authMode"] { patch[key] = fields[key] ?? "" }
    if let token = fields["token"], !token.isEmpty { patch["token"] = token }
    return patch
  }
  var needsToken: Bool {
    let api = dictionary(snapshot["api"])
    return api["hasToken"] as? Bool == true && fields["providerId"] != string(api["providerId"])
      && (fields["token"] ?? "").isEmpty
  }
  func saveAPI() {
    guard !needsToken else {
      message = interfaceText("Enter a token for the selected provider.")
      return
    }
    run("settings:saveApi", ["patch": apiPatch()]) { _ in
      self.load()
      self.message = interfaceText("API configuration saved; applies to new chats.")
    }
  }
  func testAPI() {
    run("models:test", ["patch": apiPatch()]) { value in
      let result = dictionary(value)
      self.message = jsonText(result)
      if let model = result["discoveredModel"] as? String { self.fields["model"] = model }
      if let auth = result["authMode"] as? String { self.fields["authMode"] = auth }
      self.snapshot["discoveredModels"] = result["models"]
    }
  }
  func savePreferences() {
    var patch: [String: Any] = flags
    patch["accent"] = fields["accent"] ?? "coral"
    patch["fontScale"] = Double(fields["fontScale"] ?? "1") ?? 1
    if let amount = Double(fields["maxBudgetUsd"] ?? "") {
      patch["maxBudgetUsd"] = amount
    } else {
      patch["maxBudgetUsd"] = NSNull()
    }
    for key in ["additionalDirectories", "allowedTools", "disallowedTools"] {
      patch[key] = lines(key)
    }
    run("settings:savePreferences", ["patch": patch]) { _ in
      self.message = interfaceText("Preferences saved; applies to new chats.")
    }
  }
  func lines(_ key: String) -> [String] {
    (fields[key] ?? "").split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }
      .filter { !$0.isEmpty }
  }
  func saveRules() {
    run(
      "settings:savePermissionRules",
      ["rules": ["allow": lines("allow"), "ask": lines("ask"), "deny": lines("deny")]]
    ) { _ in self.message = interfaceText("Permission rules saved; applies to new chats.") }
  }
  func reloadExtensions() {
    run("extensions:list", ["cwd": cwd]) {
      self.extensions = dictionary($0)
      self.refreshMcp()
    }
    readConfig()
  }
  func refreshMcp() {
    guard model.hasSession else { return }
    model.call("mcpStatus") { result in
      if case .success(let value) = result {
        let statuses = objects(value)
        self.extensions["mcp"] = objects(self.extensions["mcp"]).map { server in
          var next = server
          if let status = statuses.first(where: { string($0["name"]) == string(server["name"]) }) {
            next.merge(status) { _, value in value }
          }
          return next
        }
      }
    }
  }
  func readConfig() {
    if extensionPage == "mcp" || extensionPage == "hooks" {
      run(
        extensionPage == "mcp" ? "extensions:readMcp" : "extensions:readHooks",
        ["cwd": cwd, "scope": scope]
      ) {
        self.fields["config"] = string(dictionary($0)["text"])
        self.fields["configPath"] = string(dictionary($0)["path"])
      }
    }
    if extensionPage == "plugins" {
      run("extensions:marketplaces", ["cwd": cwd]) { self.market = dictionary($0) }
    }
  }
  func saveConfig() {
    run(
      extensionPage == "mcp" ? "extensions:saveMcp" : "extensions:saveHooks",
      ["cwd": cwd, "scope": scope, "text": fields["config"] ?? "{}"]
    ) { _ in self.message = interfaceText("Configuration saved; applies to new chats.") }
  }
  func openEditor(_ item: [String: Any]) {
    fields["editorPath"] = string(item["path"])
    fields["editorName"] = string(item["name"])
    run("extensions:readFile", ["cwd": cwd, "path": string(item["path"])]) {
      self.fields["editorText"] = string(dictionary($0)["text"])
      self.editor = true
    }
  }
  func newEditor() {
    fields["editorPath"] = ""
    fields["editorName"] = ""
    fields["editorText"] = "---\nname: my-extension\ndescription: Describe this extension\n---\n\n"
    editor = true
  }
  func saveEditor() {
    let path = fields["editorPath"] ?? ""
    let method = path.isEmpty ? "extensions:createFile" : "extensions:writeFile"
    run(
      method,
      [
        "cwd": cwd, "path": path, "kind": extensionPage == "skills" ? "skill" : "agent",
        "scope": scope, "name": fields["editorName"] ?? "", "text": fields["editorText"] ?? "",
      ]
    ) { _ in
      self.editor = false
      self.reloadExtensions()
    }
  }
  func confirm(_ action: @escaping () -> Void) {
    pendingAction = action
    confirmation = true
  }
  func directory() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    if panel.runModal() == .OK, let path = panel.url?.path {
      fields["additionalDirectories"] = ((fields["additionalDirectories"] ?? "") + "\n" + path)
        .trimmingCharacters(in: .whitespacesAndNewlines)
    }
  }
}
