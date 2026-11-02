import AppKit
import Combine
import SwiftUI

@MainActor func localized(_ key: String) -> String { interfaceText(key) }

@MainActor final class AppModel: ObservableObject {
  init() {
    let config =
      ProcessInfo.processInfo.environment["CLAUDE_CONFIG_DIR"].map { URL(fileURLWithPath: $0) }
      ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".claude")
    if let data = try? Data(contentsOf: config.appendingPathComponent("settings.json")),
      let settings = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      let env = settings["env"] as? [String: String], let model = env["ANTHROPIC_MODEL"],
      !model.isEmpty
    {
      modelID = model
    }
    let appData =
      ProcessInfo.processInfo.environment["DESK_NATIVE_DATA_DIR"].map { URL(fileURLWithPath: $0) }
      ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(
        "Library/Application Support/claude-desk")
    if let data = try? Data(contentsOf: appData.appendingPathComponent("settings.json")),
      let settings = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    {
      applySavedControls(dictionary(dictionary(settings["preferences"])["lastChatSettings"]))
    }
  }
  private func applySavedControls(_ settings: [String: Any]) {
    if let value = settings["model"] as? String, !value.isEmpty { modelID = value }
    if let value = settings["effort"] as? String,
      ["default", "low", "medium", "high", "xhigh", "max"].contains(value)
    {
      effort = value
    }
    if let value = settings["permissionMode"] as? String,
      ["default", "acceptEdits", "plan", "bypassPermissions"].contains(value)
    {
      mode = value
    }
  }
  private func persistControls() {
    call("settings:get") { result in
      guard case .success(let value) = result else { return }
      let preferences = dictionary(dictionary(value)["preferences"])
      var saved = dictionary(preferences["chatSettings"])
      let current: [String: Any] = [
        "model": self.modelID, "effort": self.effort, "permissionMode": self.mode,
        "updatedAt": Date().timeIntervalSince1970 * 1000,
      ]
      if let id = self.resumeID { saved[id] = current }
      saved = Dictionary(
        uniqueKeysWithValues: saved.sorted {
          (dictionary($0.value)["updatedAt"] as? Double ?? 0)
            > (dictionary($1.value)["updatedAt"] as? Double ?? 0)
        }.prefix(100).map { ($0.key, $0.value) })
      self.call(
        "settings:savePreferences", ["patch": ["chatSettings": saved, "lastChatSettings": current]]
      ) { _ in }
    }
  }
  @Published var modelID = "deepseek-v4.1-flash"
  @Published var effort = "default"
  @Published var mode = "default"
  @Published var customTitle: String?
  var title: String {
    customTitle.flatMap { $0.isEmpty ? nil : $0 } ?? transcript.entries.first(where: {
      $0.role == "You"
    })?.text.prefix(60).description ?? localized("chat.new")
  }
  func changeModel(_ value: String) {
    guard !value.trimmingCharacters(in: .whitespaces).isEmpty else { return }
    let previous = modelID
    modelID = value
    if started {
      request("model", params: ["model": value]) { result in
        if case .failure = result { self.modelID = previous } else { self.persistControls() }
      }
    } else {
      persistControls()
    }
  }
  func changeEffort(_ value: String) {
    guard !running, !connecting else {
      notice = interfaceText("Stop the current task before changing effort.")
      return
    }
    let previous = effort
    effort = value
    if started {
      request("effort", params: ["effort": value]) { result in
        if case .failure = result { self.effort = previous } else { self.persistControls() }
      }
    } else {
      persistControls()
    }
  }
  func changeMode(_ value: String) {
    let previous = mode
    mode = value
    if started {
      request("mode", params: ["mode": value]) { result in
        if case .failure = result { self.mode = previous } else { self.persistControls() }
      }
    } else {
      persistControls()
    }
  }
  @Published var transcript = Transcript()
  @Published var running = false
  @Published var connecting = false
  private var revision = -1
  var entries: [Transcript.Entry] { transcript.entries }
  @Published var cwd: String? = nil
  @Published var draft = ""
  @Published var attachments = [[String: Any]]()
  @Published var attachmentErrors = [[String: Any]]()
  var hasSession: Bool { started }
  func addClipboardImage(_ data: Data) {
    guard data.count <= 12 * 1024 * 1024 else {
      attachmentErrors.append(["name": interfaceText("Clipboard image"), "reason": "too-large"])
      return
    }
    attachments.append([
      "kind": "image", "name": interfaceText("Clipboard image"), "mediaType": "image/png",
      "data": data.base64EncodedString(),
    ])
  }
  func addAttachmentPaths(_ paths: [String]) {
    call("files:attachments", ["paths": paths]) { result in
      switch result {
      case .success(let value):
        self.attachments += objects(dictionary(value)["attachments"])
        self.attachmentErrors = objects(dictionary(value)["errors"])
      case .failure(let error): self.notice = error.localizedDescription
      }
    }
  }
  func pickAttachments() {
    let panel = NSOpenPanel()
    panel.allowsMultipleSelection = true
    panel.canChooseDirectories = false
    if panel.runModal() == .OK { addAttachmentPaths(panel.urls.map(\.path)) }

  }
  func openHistory(_ session: [String: Any]) {
    reset()
    customTitle =
      string(session["customTitle"]).isEmpty
      ? string(session["summary"]) : string(session["customTitle"])
    cwd = string(session["cwd"])
    resumeID = string(session["sessionId"])
    connecting = true
    call("settings:get") { result in
      if case .success(let value) = result {
        let prefs = dictionary(dictionary(value)["preferences"])
        self.applySavedControls(dictionary(dictionary(prefs["chatSettings"])[self.resumeID ?? ""]))
      }
    }
    call("sessions:messages", ["cwd": cwd ?? "", "sessionId": resumeID ?? ""]) { result in
      switch result {
      case .success(let value):
        self.transcript.load(objects(value))
        self.connecting = false
      case .failure(let error):
        self.notice = error.localizedDescription
        self.connecting = false
      }
    }
  }
  @Published var notice: String? = nil
  @Published var permission: [String: Any]? = nil
  private var process: Process?
  private var input: FileHandle?
  private var buffer = Data()
  private var tabID = UUID().uuidString
  private var started = false
  private var pending = [String: String]()
  func regenerate(_ entry: Transcript.Entry) {
    guard let index = entries.firstIndex(where: { $0.id == entry.id }),
      let user = entries.prefix(index).last(where: { $0.role == "You" })
    else { return }
    editMessage(user, regenerate: true)
  }
  func branch(_ entry: Transcript.Entry, completion: @escaping (String, String) -> Void) {
    guard let resumeID, let uuid = entry.transcriptID, let cwd else { return }
    call("sessions:fork", ["cwd": cwd, "sessionId": resumeID, "upToMessageId": uuid]) { result in
      switch result {
      case .success(let value):
        let id = string(dictionary(value)["sessionId"])
        if !id.isEmpty { completion(id, cwd) }
      case .failure(let error): self.notice = error.localizedDescription
      }
    }
  }
  private var completions = [String: (Result<Any, Error>) -> Void]()
  @Published var availableModels = [[String: Any]]()
  @Published var usage: [String: Any] = [:]
  @Published var usageSummary: [String: Any] = [:]
  @Published var statistics: [String: Any] = [:]
  @Published var context: [String: Any] = [:]
  @Published var resumeID: String?
  @Published var tasks = [[String: Any]]()
  private var permissionQueue = [[String: Any]]()
  func editMessage(_ entry: Transcript.Entry, withdraw: Bool = false, regenerate: Bool = false) {
    guard !running, let index = entries.firstIndex(where: { $0.id == entry.id }) else { return }
    let oldSession = resumeID
    let previous = index > 0 ? entries[index - 1].transcriptID : nil
    func finish(_ forkID: String?) {
      if self.started { self.request("stop") }
      self.started = false
      self.resumeID = forkID
      self.transcript.truncate(before: index)
      if !withdraw {
        self.draft = entry.text
        self.attachments = entry.attachments
      }
      if let forkID {
        self.call("sessions:messages", ["cwd": self.cwd ?? "", "sessionId": forkID]) { result in
          switch result {
          case .success(let value):
            self.transcript.load(objects(value))
            if regenerate { self.send() }
          case .failure(let error): self.notice = error.localizedDescription
          }
        }
      } else if regenerate {
        self.send()
      }
      if let oldSession {
        self.call("settings:get") { result in
          if case .success(let value) = result {
            let prefs = dictionary(dictionary(value)["preferences"])
            var hidden = prefs["hiddenSessions"] as? [String] ?? []
            if !hidden.contains(oldSession) { hidden.append(oldSession) }
            self.call("settings:savePreferences", ["patch": ["hiddenSessions": hidden]]) { _ in }
          }
        }
      }
    }
    if let oldSession, let previous {
      call("sessions:fork", ["cwd": cwd ?? "", "sessionId": oldSession, "upToMessageId": previous])
      { result in
        switch result {
        case .success(let value): finish(string(dictionary(value)["sessionId"]))
        case .failure(let error): self.notice = error.localizedDescription
        }
      }
    } else {
      finish(nil)
    }
  }
  func call(
    _ method: String, _ params: [String: Any] = [:],
    completion: @escaping (Result<Any, Error>) -> Void
  ) {
    do {
      try startBridge()
      request(method, params: params, completion: completion)
    } catch { completion(.failure(error)) }
  }

  func chooseWorkspace() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    if panel.runModal() == .OK, let url = panel.url {
      reset()
      cwd = url.path
    }
  }
  func reset() {
    if started { request("stop") }
    tabID = UUID().uuidString
    started = false
    customTitle = nil
    transcript = Transcript()
    permission = nil
    permissionQueue = []
    resumeID = nil
    attachments = []
    attachmentErrors = []
    statistics = [:]
    context = [:]
    tasks = []
    usage = [:]
    usageSummary = [:]
    running = false
    connecting = false
  }
  func startBridge() throws {
    if process?.isRunning == true { return }
    let runtime = Bundle.main.resourceURL?.appendingPathComponent("Runtime")
    let node =
      ProcessInfo.processInfo.environment["DESK_NATIVE_NODE"]
      ?? runtime?.appendingPathComponent("bin/node").path
    let script =
      ProcessInfo.processInfo.environment["DESK_NATIVE_BRIDGE"]
      ?? runtime?.appendingPathComponent("agent/bridge.cjs").path
    guard let node, let script, FileManager.default.isExecutableFile(atPath: node),
      FileManager.default.fileExists(atPath: script)
    else {
      throw NSError(
        domain: "DeskNative", code: 1,
        userInfo: [NSLocalizedDescriptionKey: localized("bridge.unavailable")])
    }
    let process = Process()
    process.executableURL = URL(fileURLWithPath: node)
    process.arguments = [script]
    let stdin = Pipe()
    let stdout = Pipe()
    process.standardInput = stdin
    process.standardOutput = stdout
    process.standardError = FileHandle.nullDevice
    stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
      let data = handle.availableData
      guard !data.isEmpty else {
        handle.readabilityHandler = nil
        return
      }
      DispatchQueue.main.async { self?.receive(data) }
    }
    process.terminationHandler = { [weak self] _ in Task { @MainActor in self?.bridgeEnded() } }
    try process.run()
    self.process = process
    input = stdin.fileHandleForWriting
  }
  func bridgeEnded() {
    let error = NSError(
      domain: "Bridge", code: 2,
      userInfo: [NSLocalizedDescriptionKey: localized("bridge.unavailable")])
    let callbacks = Array(completions.values)
    completions.removeAll()
    for callback in callbacks { callback(.failure(error)) }
    running = false
    connecting = false
    revision = -1
    buffer = Data()
    process = nil
    input = nil
    started = false
    pending.removeAll()
    permission = nil
    notice = localized("bridge.unavailable")
  }
  func request(
    _ method: String, params: [String: Any] = [:], completion: ((Result<Any, Error>) -> Void)? = nil
  ) {
    guard let input else {
      notice = localized("bridge.unavailable")
      completion?(
        .failure(
          NSError(
            domain: "Bridge", code: 2,
            userInfo: [NSLocalizedDescriptionKey: notice ?? "Bridge unavailable"])))
      return
    }
    let id = UUID().uuidString
    let object: [String: Any] = [
      "version": 1, "id": id, "method": method, "tabId": tabID, "params": params,
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: object) else { return }
    pending[id] = method
    if let completion { completions[id] = completion }
    do { try input.write(contentsOf: data + Data([10])) } catch {
      pending.removeValue(forKey: id)
      completions.removeValue(forKey: id)?(.failure(error))
      notice = error.localizedDescription
    }
  }
  func send() {
    let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let cwd, !text.isEmpty || !attachments.isEmpty, !running, !connecting else { return }
    do { try startBridge() } catch {
      notice = error.localizedDescription
      return
    }
    if !started {
      var options: [String: Any] = [
        "cwd": cwd, "model": modelID, "effort": effort, "permissionMode": mode,
      ]
      if let resumeID { options["resume"] = resumeID }
      request("start", params: options)
      started = true
    }
    let turnID = UUID().uuidString
    request("send", params: ["text": text, "attachments": attachments, "uuid": turnID])
    transcript.appendUser(
      text.isEmpty
        ? attachments.compactMap { $0["name"] as? String }.joined(separator: ", ") : text,
      id: turnID, attachments: attachments)
    running = true
    draft = ""
    attachments = []
  }
  func respond(_ decision: String, always: Bool = false, answers: [String: Any] = [:]) {
    guard let permission, let id = permission["id"] as? String else { return }
    request(
      "permission", params: ["id": id, "decision": decision, "always": always, "answers": answers])
    self.permission = permissionQueue.isEmpty ? nil : permissionQueue.removeFirst()
  }
  func receive(_ data: Data) {
    buffer.append(data)
    while let newline = buffer.firstIndex(of: 10) {
      let line = buffer.prefix(upTo: newline)
      buffer.removeSubrange(...newline)
      guard let item = (try? JSONSerialization.jsonObject(with: Data(line))) as? [String: Any]
      else { continue }
      if let id = item["id"] as? String, let callback = completions.removeValue(forKey: id) {
        if let error = item["error"] as? String {
          callback(
            .failure(
              NSError(domain: "Bridge", code: 1, userInfo: [NSLocalizedDescriptionKey: error])))
        } else {
          callback(.success(item["result"] ?? NSNull()))
        }
      }
      if let id = item["id"] as? String, let method = pending.removeValue(forKey: id),
        let error = item["error"] as? String
      {
        if method == "start" { started = false }
        running = false
        connecting = false
        notice = error
      }
      guard item["tabId"] as? String == tabID, let event = item["event"] as? String else {
        continue
      }
      if event == "permission", let incoming = item["data"] as? [String: Any] {
        if permission == nil { permission = incoming } else { permissionQueue.append(incoming) }
      }
      if event == "permissionCancel", let id = item["data"] as? String {
        permissionQueue.removeAll { string($0["id"]) == id }
        if string(permission?["id"]) == id {
          permission = permissionQueue.isEmpty ? nil : permissionQueue.removeFirst()
        }
      }
      if event == "message", let message = item["data"] as? [String: Any] {
        receiveMessage(message)
      }
      if event == "state", let state = item["data"] as? [String: Any] {
        let incoming = state["revision"] as? Int ?? revision + 1
        if incoming > revision {
          revision = incoming
          if let id = state["sessionId"] as? String, id != resumeID {
            resumeID = id
            persistControls()
          }
          if let value = state["model"] as? String { modelID = value }
          if let value = state["effort"] as? String { effort = value }
          if let value = state["permissionMode"] as? String { mode = value }
          statistics = state["stats"] as? [String: Any] ?? statistics
          context = state["context"] as? [String: Any] ?? context
          running = state["running"] as? Bool ?? false
          connecting = state["connecting"] as? Bool ?? false
          if let error = state["error"] as? String { notice = error }
        }
      }
    }
  }
  func receiveMessage(_ message: [String: Any]) {
    if string(message["type"]) == "result" {
      if let cwd, let resumeID {
        call("sessions:list", ["cwd": cwd]) { result in
          if case .success(let value) = result,
            let session = objects(value).first(where: { string($0["sessionId"]) == resumeID })
          {
            let title =
              string(session["customTitle"]).isEmpty
              ? string(session["summary"]) : string(session["customTitle"])
            if !title.isEmpty { self.customTitle = title }
          }
        }
      }
      var params: [String: Any] = ["base": usage, "models": availableModels]
      if !dictionary(message["model_usage_since_last_result"]).isEmpty {
        params["delta"] = message["model_usage_since_last_result"]
      } else if let total = message["modelUsage"] {
        params["total"] = total
      }
      call("usage:update", params) { result in
        if case .success(let value) = result {
          self.usage = dictionary(dictionary(value)["usage"])
          self.usageSummary = dictionary(dictionary(value)["summary"])
        }
      }
    }
    if string(message["subtype"]).hasPrefix("task_") {
      let id = string(message["task_id"])
      if let index = tasks.firstIndex(where: { string($0["task_id"]) == id }) {
        tasks[index].merge(message) { _, new in new }
      } else {
        tasks.append(message)
      }
    }
    transcript.apply(message)
  }

  func shutdown() {
    input?.closeFile()
    if process?.isRunning == true { process?.terminate() }
    process = nil
  }
}

@MainActor final class WorkspaceTabs: ObservableObject {
  @MainActor struct Tab: Identifiable {
    let id = UUID()
    let model = AppModel()
  }
  @Published var tabs = [Tab()]
  @Published var selected = 0
  private var observations = [AnyCancellable]()
  init() { observeTabs() }
  private func observeTabs() {
    observations = tabs.map { tab in
      tab.model.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }
    }
  }
  func add() {
    let tab = Tab()
    tab.model.cwd = tabs[selected].model.cwd
    tabs.append(tab)
    selected = tabs.count - 1
    observeTabs()
  }
  func close(_ index: Int) {
    let cwd = tabs[index].model.cwd
    tabs[index].model.shutdown()
    tabs.remove(at: index)
    if tabs.isEmpty {
      let tab = Tab()
      tab.model.cwd = cwd
      tabs.append(tab)
    }
    if index < selected { selected -= 1 }
    selected = min(selected, tabs.count - 1)
    observeTabs()
  }
  func shutdown() { for tab in tabs { tab.model.shutdown() } }
}
@main struct DeskNativeApp: App {
  var body: some Scene {
    WindowGroup("3PI Desk for Claude Code") { WorkspaceView() }.defaultSize(
      width: 1280, height: 860
    )
    .commands {
      CommandGroup(replacing: .newItem) {
        Button("New Chat") {
          NotificationCenter.default.post(name: Notification.Name("desk.newChat"), object: nil)
        }.keyboardShortcut("n")
      }
      CommandGroup(replacing: .appSettings) {
        Button("Settings…") {
          NotificationCenter.default.post(name: Notification.Name("desk.settings"), object: nil)
        }.keyboardShortcut(",")
      }
    }
  }
}
