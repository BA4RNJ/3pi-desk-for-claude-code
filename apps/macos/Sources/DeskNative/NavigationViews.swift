import AppKit
import SwiftUI

@MainActor final class NavigationStore: ObservableObject {
  @Published var booted = false
  @Published var workspaces = false
  @Published var files = false
  @Published var preview = false
  @Published var filePath = ""
  @Published var fileText = ""
  @Published var fileKind = ""
  @Published var fileImage: NSImage?
  @Published var tree: [FileItem] = []
  @Published var recents = [String]()
  @Published var counts: [String: Int] = [:]
  @Published var sessions = [[String: Any]]()
  @Published var pinned = [String]()
  private var hidden = [String]()
  private var searchWork: DispatchWorkItem?
  private var searchQuery = ""
  @Published var message = ""
  @Published var deleting = false
  var selectedSession: [String: Any] = [:]
  @Published var dialog = false
  @Published var dialogTitle = ""
  @Published var dialogText = ""
  var action: ((String) -> Void)?
  func load(_ model: AppModel) {
    model.call("settings:get") {
      self.booted = true
      if case .failure(let error) = $0 { model.notice = error.localizedDescription }
      if case .success(let value) = $0 {
        let prefs = dictionary(dictionary(value)["preferences"])
        self.recents = prefs["recentWorkspaces"] as? [String] ?? []
        self.pinned = prefs["pinnedSessions"] as? [String] ?? []
        self.hidden = prefs["hiddenSessions"] as? [String] ?? []
        self.sessions.removeAll { self.hidden.contains(string($0["sessionId"])) }
        for path in self.recents {
          model.call("sessions:list", ["cwd": path]) {
            if case .success(let value) = $0 { self.counts[path] = objects(value).count }
          }
        }
      }
    }
    if let cwd = model.cwd {
      model.call("sessions:list", ["cwd": cwd]) { result in
        switch result {
        case .success(let value):
          self.sessions = objects(value).filter { !self.hidden.contains(string($0["sessionId"])) }
        case .failure(let error): self.message = error.localizedDescription
        }
      }
    }
  }
  func search(_ query: String, model: AppModel) {
    searchWork?.cancel()
    searchQuery = query
    if query.isEmpty {
      load(model)
      return
    }
    let work = DispatchWorkItem { [weak self, weak model] in
      guard let self, let model, self.searchQuery == query else { return }
      model.call("sessions:all") { result in
        guard self.searchQuery == query else { return }
        if case .success(let value) = result {
          self.sessions = objects(value).filter { session in
            !self.hidden.contains(string(session["sessionId"]))
              && ["summary", "customTitle", "firstPrompt", "cwd", "tag"].contains { key in
                string(session[key]).localizedCaseInsensitiveContains(query)
              }
          }
        }
      }
    }
    searchWork = work
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2, execute: work)
  }
  func pin(_ session: [String: Any], model: AppModel) {
    let id = string(session["sessionId"])
    if pinned.contains(id) { pinned.removeAll { $0 == id } } else { pinned.append(id) }
    model.call("settings:savePreferences", ["patch": ["pinnedSessions": pinned]]) { _ in }
  }
  func loadTree(_ model: AppModel) {
    guard let cwd = model.cwd else {
      message = interfaceText("Choose a workspace first.")
      return
    }
    model.call("files:tree", ["cwd": cwd]) { result in
      guard model.cwd == cwd else { return }
      switch result {
      case .success(let value): self.tree = objects(value).map(FileItem.init)
      case .failure(let error): self.message = error.localizedDescription
      }
    }
  }
  func open(_ path: String, model: AppModel) {
    guard let cwd = model.cwd else { return }
    model.call("files:read", ["cwd": cwd, "path": path]) { result in
      switch result {
      case .success(let value):
        let file = dictionary(value)
        self.filePath = path
        self.fileKind = string(file["kind"])
        self.fileText = string(file["text"])
        self.fileImage = nil
        if let encoded = string(file["dataUrl"]).split(separator: ",").last,
          let bytes = Data(base64Encoded: String(encoded))
        {
          self.fileImage = NSImage(data: bytes)
        }
        self.preview = true
      case .failure(let error): self.message = error.localizedDescription
      }
    }
  }
  func ask(_ title: String, text: String = "", action: @escaping (String) -> Void) {
    dialogTitle = title
    dialogText = text
    self.action = action
    dialog = true
  }
  func export(_ model: AppModel) {
    let panel = NSSavePanel()
    panel.nameFieldStringValue = "chat.md"
    if panel.runModal() == .OK, let url = panel.url {
      do {
        try model.entries.map { "## \($0.role)\n\n\($0.text)" }.joined(separator: "\n\n").write(
          to: url, atomically: true, encoding: .utf8)
      } catch { message = error.localizedDescription }
    }
  }
}
struct FileItem: Identifiable {
  let id: String
  let name: String
  let children: [FileItem]?
  init(_ value: [String: Any]) {
    id = string(value["path"])
    name = string(value["name"])
    children =
      value["type"] as? String == "dir" ? objects(value["children"]).map(FileItem.init) : nil
  }
}
struct NativeFilePanel: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @ObservedObject var store: NavigationStore
  @ObservedObject var model: AppModel
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text(interfaceText("Files")).font(.headline)
        Spacer()
        Button {
          store.loadTree(model)
        } label: {
          Image(systemName: "arrow.clockwise")
        }
        Button {
          store.files = false
        } label: {
          Image(systemName: "xmark")
        }
      }.buttonStyle(.plain)
      Text(model.cwd ?? interfaceText("No workspace")).font(.caption).foregroundColor(Palette.muted)
        .lineLimit(2)
      ScrollView {
        OutlineGroup(store.tree, children: \.children) { item in
          Button {
            if item.children == nil { store.open(item.id, model: model) }
          } label: {
            Label(item.name, systemImage: item.children == nil ? "doc.text" : "folder").lineLimit(1)
              .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 5)
          }.buttonStyle(.plain)
        }
      }
      Text(store.message).font(.caption).foregroundColor(Palette.coral)
    }.padding(16).frame(width: 275).background(Palette.panel).onAppear { store.loadTree(model) }
  }
}
struct NativeFilePreview: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @ObservedObject var store: NavigationStore
  @ObservedObject var model: AppModel
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Text(URL(fileURLWithPath: store.filePath).lastPathComponent).font(.headline)
        Spacer()
        Button {
          store.preview = false
        } label: {
          Image(systemName: "xmark")
        }
      }
      Text(store.filePath).font(.caption).foregroundColor(Palette.muted).textSelection(.enabled)
      if store.fileKind == "image", let image = store.fileImage {
        Image(nsImage: image).resizable().scaledToFit().frame(
          maxWidth: .infinity, maxHeight: .infinity)
      } else if store.fileKind == "text" {
        TextEditor(text: $store.fileText).scrollContentBackground(.hidden).font(
          .system(size: scaled(12), design: .monospaced)
        ).padding(8).modifier(Outline())
      } else {
        Text(interfaceText("Binary file preview is unavailable.")).frame(
          maxWidth: .infinity, maxHeight: .infinity)
      }
      Text(store.message).foregroundColor(Palette.coral).font(.caption)
      HStack {
        Button(interfaceText("Open in default app")) {
          NSWorkspace.shared.open(URL(fileURLWithPath: store.filePath))
        }
        Spacer()
        Button(interfaceText("Cancel")) { store.preview = false }
        if store.fileKind == "text" {
          Button(interfaceText("Save")) {
            model.call(
              "files:write",
              ["cwd": model.cwd ?? "", "path": store.filePath, "text": store.fileText]
            ) { result in
              if case .failure(let error) = result {
                store.message = error.localizedDescription
              } else {
                store.preview = false
              }
            }
          }.buttonStyle(.borderedProminent).tint(Palette.coral)
        }
      }
    }.padding(24).frame(width: 850, height: 620).background(Palette.background)
  }
}
struct NativeWorkspaces: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @ObservedObject var store: NavigationStore
  @ObservedObject var model: AppModel
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack {
        VStack(alignment: .leading) {
          Text(interfaceText("Workspaces")).font(
            .system(size: scaled(24), weight: .semibold, design: .serif))
          Text(interfaceText("Open a project folder and browse its conversations."))
            .foregroundColor(Palette.muted)
        }
        Spacer()
        Button {
          store.workspaces = false
        } label: {
          Image(systemName: "xmark")
        }
      }
      ScrollView {
        VStack(spacing: 12) {
          ForEach(store.recents, id: \.self) { path in
            HStack {
              Image(systemName: "folder").foregroundColor(Palette.coral)
              VStack(alignment: .leading, spacing: 5) {
                Text(URL(fileURLWithPath: path).lastPathComponent).fontWeight(.semibold)
                Text(path).font(.caption).foregroundColor(Palette.muted)
                Text("\(store.counts[path] ?? 0) " + interfaceText("chats")).font(.caption)
                  .foregroundColor(Palette.muted)
              }
              Spacer()
              Button(interfaceText("Open")) {
                model.reset()
                model.cwd = path
                store.workspaces = false
                store.load(model)
              }
              Button {
                store.recents.removeAll { $0 == path }
                model.call(
                  "settings:savePreferences", ["patch": ["recentWorkspaces": store.recents]]
                ) { _ in }
              } label: {
                Image(systemName: "xmark")
              }.help(interfaceText("Remove from recent workspaces; files and chats are kept."))
            }.padding(15).modifier(Outline())
          }
          if store.recents.isEmpty {
            Text(interfaceText("No recent workspaces.")).foregroundColor(Palette.muted).padding(30)
          }
        }
      }
      HStack {
        Button(interfaceText("Open backup folder")) {
          NSWorkspace.shared.open(
            FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(
              "Library/Application Support/claude-desk/session-backups"))
        }
        Spacer()
        Button(interfaceText("Add workspace")) {
          model.chooseWorkspace()
          if let cwd = model.cwd {
            store.recents.removeAll { $0 == cwd }
            store.recents.insert(cwd, at: 0)
            model.call(
              "settings:savePreferences",
              ["patch": ["recentWorkspaces": Array(store.recents.prefix(12))]]
            ) { _ in }
            store.load(model)
            store.workspaces = false
          }
        }.buttonStyle(.borderedProminent).tint(Palette.coral)
      }
    }.padding(28).frame(width: 760, height: 540).background(Palette.background).onAppear {
      store.load(model)
    }
  }
}

extension Dictionary where Key == String, Value == Any {
  var sessionIdentifier: String { string(self["sessionId"]) }
}
