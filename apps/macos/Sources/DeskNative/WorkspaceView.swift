import AppKit
import SwiftUI
import UniformTypeIdentifiers

@MainActor private func ui(_ text: String) -> String { interfaceText(text) }
enum Palette {
  private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
    Color(
      nsColor: NSColor(
        name: nil,
        dynamicProvider: { appearance in
          let value = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light
          return NSColor(
            red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255,
            blue: Double(value & 255) / 255, alpha: 1)
        }))
  }
  static let background = adaptive(0xf5f5f7, 0x1c1c1e), sidebar = adaptive(0xf6f6f8, 0x1c1c1e),
    panel = adaptive(0xffffff, 0x2c2c2e)
  static let ink = adaptive(0x1f1e1d, 0xf1eee5), secondary = adaptive(0x585650, 0xb5b0a4),
    muted = adaptive(0x918c80, 0x8a8478)
  static let border = adaptive(0xd1d1d6, 0x48484a)
  static let userBubble = adaptive(0xe5e5ea, 0x3a3a3c)
  static let coralSoft = adaptive(0xffe5dd, 0x4a2d24)
  static let coralStrong = adaptive(0xbf5f3e, 0xee9a78)
  @MainActor static var coral: Color {
    switch NativeAppearance.shared.accent {
    case "blue": return .blue
    case "green": return .green
    case "purple": return .purple
    default: return adaptive(0xd97757, 0xe18867)
    }
  }
}

extension Color {
  fileprivate init(hex: UInt32) {
    self.init(
      red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255,
      blue: Double(hex & 255) / 255)
  }
}
struct Outline: ViewModifier {
  var radius: CGFloat = 10
  func body(content: Content) -> some View {
    content.background(.ultraThinMaterial).clipShape(RoundedRectangle(cornerRadius: radius)).overlay(
      RoundedRectangle(cornerRadius: radius).stroke(Palette.border, lineWidth: 1))
  }
}
struct Mark: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  var size: CGFloat = 34
  var body: some View {
    Image(
      nsImage: NSImage(
        contentsOf: Bundle.module.url(forResource: "app-icon", withExtension: "png")!)!
    )
    .resizable().frame(width: size, height: size).clipShape(
      RoundedRectangle(cornerRadius: size * 0.26))
  }
}
@MainActor final class ViewOptions: ObservableObject {
  @Published var search = ""
  @Published var settings = false
  @Published var compact = false
  @Published var userOnly = false
  @Published var modelID = ""
  @Published var editorHeight: CGFloat = 26
  @Published var followTail = true
  @Published var modelPicker = false
  @Published var settingsPage = "general"
  @Published var tasks = false
  @Published var rewind = false
  @Published var rewindID = ""
  @Published var withdraw = false
  var selectedEntry: Transcript.Entry?
}
struct WorkspaceView: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @StateObject private var workspace = WorkspaceTabs()
  @StateObject private var navigation = NavigationStore()
  @StateObject private var options = ViewOptions()
  var body: some View {
    HStack(spacing: 0) {
      sidebar
      Rectangle().fill(Palette.border).frame(width: 1)
      VStack(spacing: 0) {
        header
        tabBar
        NativeChatView(
          model: workspace.tabs[workspace.selected].model,
          onFork: { id, cwd in
            workspace.add()
            workspace.tabs[workspace.selected].model.openHistory(["sessionId": id, "cwd": cwd])
          }
        ).id(workspace.tabs[workspace.selected].id)
      }
      if navigation.files {
        Rectangle().fill(Palette.border).frame(width: 1)
        NativeFilePanel(store: navigation, model: workspace.tabs[workspace.selected].model)
      }
    }
    .background(.regularMaterial).foregroundColor(Palette.ink).tint(Palette.coral).font(
      .system(size: scaled(13))
    )
    .frame(minWidth: 940, minHeight: 640).preferredColorScheme(appearance.scheme)
    .deskModal(isPresented: $options.settings) {
      NativeSettingsView(
        model: workspace.tabs[workspace.selected].model, initialPage: options.settingsPage
      ) { options.settings = false }
    }
    .deskConfirm(
      isPresented: $navigation.deleting, title: "Delete chat",
      message: "A local transcript backup will be saved before deletion.", confirm: "Delete"
    ) { serviceSession("sessions:delete", navigation.selectedSession) }
    .deskModal(isPresented: $navigation.workspaces) {
      NativeWorkspaces(store: navigation, model: workspace.tabs[workspace.selected].model)
    }
    .deskModal(isPresented: $navigation.preview) {
      NativeFilePreview(store: navigation, model: workspace.tabs[workspace.selected].model)
    }
    .deskModal(isPresented: $navigation.dialog) {
      VStack(alignment: .leading, spacing: 18) {
        Text(interfaceText(navigation.dialogTitle)).font(.title2)
        TextField(interfaceText(navigation.dialogTitle), text: $navigation.dialogText)
          .textFieldStyle(.roundedBorder)
        HStack {
          Spacer()
          Button(interfaceText("Cancel")) { navigation.dialog = false }
          Button(interfaceText("Save")) {
            navigation.action?(navigation.dialogText)
            navigation.dialog = false
          }.buttonStyle(.borderedProminent).tint(Palette.coral)
        }
      }.padding(25).frame(width: 450).background(Palette.background)
    }
    .overlay {
      if !navigation.booted {
        ZStack {
          Palette.background
          VStack(spacing: 14) {
            Mark(size: 66)
            ProgressView()
            Text(interfaceText("Preparing 3PI Desk…")).font(.caption).foregroundColor(Palette.muted)
          }
        }
      }
    }
    .onAppear { navigation.load(workspace.tabs[workspace.selected].model) }
    .onChange(of: workspace.tabs[workspace.selected].model.cwd) { _ in
      navigation.load(workspace.tabs[workspace.selected].model)
    }
    .onChange(of: options.search) { query in
      navigation.search(query, model: workspace.tabs[workspace.selected].model)
    }
    .onChange(of: workspace.selected) { _ in
      navigation.load(workspace.tabs[workspace.selected].model)
      if navigation.files { navigation.loadTree(workspace.tabs[workspace.selected].model) }
    }
    .onReceive(NotificationCenter.default.publisher(for: Notification.Name("desk.newChat"))) { _ in
      if !options.settings && !navigation.preview && !navigation.workspaces && !navigation.dialog
        && !navigation.deleting
      {
        workspace.add()
      }
    }
    .onReceive(NotificationCenter.default.publisher(for: Notification.Name("desk.settings"))) { _ in
      options.settingsPage = "general"
      options.settings = true
    }
    .onDisappear { workspace.shutdown() }
    .onReceive(NotificationCenter.default.publisher(for: NSApplication.willTerminateNotification)) {
      _ in workspace.shutdown()
    }
  }
  private var sidebar: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 10) {
        Mark()
        VStack(alignment: .leading, spacing: 2) {
          Text("3PI Desk").font(.system(size: scaled(16), weight: .semibold, design: .serif))
          Text(ui("AI coding workspace")).font(.system(size: scaled(10))).foregroundColor(
            Palette.muted)
        }
      }.padding(.bottom, 10)
      Button {
        workspace.add()
      } label: {
        HStack {
          Image(systemName: "plus").foregroundColor(Palette.coral)
          Text(ui("New chat")).fontWeight(.medium)
          Spacer()
          Text("⌘T").foregroundColor(Palette.muted).font(.system(size: scaled(11)))
        }.padding(11).overlay(RoundedRectangle(cornerRadius: 10).stroke(Palette.border))
      }.buttonStyle(.plain).keyboardShortcut("t")
      Button {
        navigation.workspaces = true
      } label: {
        HStack(alignment: .top, spacing: 10) {
          Image(systemName: "folder").foregroundColor(Palette.coral).padding(8).background(
            Palette.coral.opacity(0.1)
          ).cornerRadius(8)
          VStack(alignment: .leading, spacing: 4) {
            Text(ui("Working directory")).font(.system(size: scaled(10))).foregroundColor(
              Palette.muted)
            Text(folder).fontWeight(.semibold)
            Text(workspace.tabs[workspace.selected].model.cwd ?? ui("Choose a project folder"))
              .font(.system(size: scaled(11))).foregroundColor(Palette.muted).lineLimit(2)
              .truncationMode(.middle)
          }
          Spacer(minLength: 0)
        }.padding(12).modifier(Outline(radius: 13))
      }.buttonStyle(.plain)
      HStack {
        Text(ui(options.search.isEmpty ? "Recent chats" : "Search results"))
        Spacer()
        Button {
          navigation.load(workspace.tabs[workspace.selected].model)
        } label: {
          Image(systemName: "arrow.clockwise")
        }.buttonStyle(.plain)
      }.foregroundColor(Palette.muted).font(.system(size: scaled(11))).padding(.top, 16)
      HStack {
        Image(systemName: "magnifyingglass")
        TextField(interfaceText("Search all chats…"), text: $options.search).textFieldStyle(.plain)
        if !options.search.isEmpty {
          Button {
            options.search = ""
          } label: {
            Image(systemName: "xmark").font(.system(size: scaled(9)))
          }.buttonStyle(.plain)
        }
      }.foregroundColor(Palette.muted).padding(9).modifier(Outline())
      ScrollView {
        VStack(alignment: .leading, spacing: 4) {
          if navigation.sessions.isEmpty {
            Text(
              interfaceText(
                options.search.isEmpty ? "No chats in this workspace yet" : "No matching chats")
            ).font(.system(size: scaled(12))).foregroundColor(Palette.muted).padding(.vertical, 14)
              .frame(maxWidth: .infinity, alignment: .leading)
          }
          ForEach(
            navigation.sessions.sorted {
              navigation.pinned.contains(string($0["sessionId"]))
                && !navigation.pinned.contains(string($1["sessionId"]))
            }, id: \.sessionIdentifier
          ) { session in
            HStack(spacing: 4) {
              Button {
                workspace.tabs[workspace.selected].model.openHistory(session)
              } label: {
                VStack(alignment: .leading, spacing: 5) {
                  HStack(spacing: 5) {
                    if navigation.pinned.contains(string(session["sessionId"])) {
                      Image(systemName: "pin.fill").font(.system(size: scaled(9))).foregroundColor(
                        Palette.coral)
                    }
                    Text(
                      string(session["customTitle"]).isEmpty
                        ? string(session["summary"]) : string(session["customTitle"])
                    ).lineLimit(1)
                  }
                  Text(sessionSubtitle(session)).font(.system(size: scaled(10))).foregroundColor(
                    Palette.muted
                  ).lineLimit(1)
                }.frame(maxWidth: .infinity, alignment: .leading)
              }.buttonStyle(.plain)
              Menu {
                sessionActions(session)
              } label: {
                Image(systemName: "ellipsis").foregroundColor(Palette.muted)
              }.menuStyle(.borderlessButton).menuIndicator(.hidden).frame(width: 20)
            }.padding(10).background(
              string(session["sessionId"]) == workspace.tabs[workspace.selected].model.resumeID
                ? Palette.panel : .clear
            ).cornerRadius(9)
              .contextMenu { sessionActions(session) }

          }
        }
      }
      Rectangle().fill(Palette.border).frame(height: 1)
      HStack {
        Button {
          appearance.theme =
            appearance.theme == "light" ? "dark" : appearance.theme == "dark" ? "system" : "light"
          appearance.save()
        } label: {
          Label(
            ui(
              appearance.theme == "dark"
                ? "Dark theme" : appearance.theme == "system" ? "System" : "Light theme"),
            systemImage: appearance.theme == "dark"
              ? "moon" : appearance.theme == "system" ? "desktopcomputer" : "sun.max"
          ).foregroundColor(Palette.muted)
        }.buttonStyle(.plain)
        Spacer()
        Button {
          options.settingsPage = "general"
          options.settings = true
        } label: {
          Label(ui("Settings"), systemImage: "gearshape")
        }.buttonStyle(.plain)
      }.font(.system(size: scaled(11))).padding(.vertical, 6)
    }.padding(.horizontal, 14).padding(.top, 18).padding(.bottom, 12).frame(width: 276).background(
      Palette.sidebar)
  }
  @ViewBuilder private func sessionActions(_ session: [String: Any]) -> some View {
    Group {

      Button(
        interfaceText(
          navigation.pinned.contains(string(session["sessionId"])) ? "Unpin" : "Pin chat")
      ) { navigation.pin(session, model: workspace.tabs[workspace.selected].model) }
      Button(interfaceText("Export Markdown")) {
        let model = workspace.tabs[workspace.selected].model
        model.call(
          "sessions:messages",
          ["cwd": string(session["cwd"]), "sessionId": string(session["sessionId"])]
        ) { result in
          if case .success(let value) = result {
            var transcript = Transcript()
            transcript.load(objects(value))
            let panel = NSSavePanel()
            panel.nameFieldStringValue = "chat.md"
            if panel.runModal() == .OK, let url = panel.url {
              try? transcript.entries.map { "## \($0.role)\n\n\($0.text)" }.joined(
                separator: "\n\n"
              ).write(to: url, atomically: true, encoding: .utf8)
            }
          }
        }
      }
      Button(interfaceText("Rename chat")) {
        navigation.ask("Rename chat", text: string(session["customTitle"])) { title in
          serviceSession("sessions:rename", session, extra: ["title": title])
        }
      }
      Button(interfaceText("Tag chat")) {
        navigation.ask("Tag chat", text: string(session["tag"])) { tag in
          serviceSession("sessions:tag", session, extra: ["tag": tag])
        }
      }
      Button(interfaceText("Fork chat")) { serviceSession("sessions:fork", session) }
      Button(interfaceText("Delete chat"), role: .destructive) {
        navigation.selectedSession = session
        navigation.deleting = true
      }
    }
  }
  private func sessionSubtitle(_ session: [String: Any]) -> String {
    let stamp = session["lastModified"] as? Double ?? 0
    let age = max(0, Date().timeIntervalSince1970 - stamp / 1000)
    let relative: String
    if age < 60 {
      relative = interfaceText("Just now")
    } else if age < 3600 {
      relative = "\(Int(age / 60))" + (appearance.language == "en" ? "m ago" : " 分钟前")
    } else if age < 86400 {
      relative = "\(Int(age / 3600))" + (appearance.language == "en" ? "h ago" : " 小时前")
    } else {
      relative = "\(Int(age / 86400))" + (appearance.language == "en" ? "d ago" : " 天前")
    }
    return
      ([relative] + [string(session["gitBranch"]), string(session["tag"])].filter { !$0.isEmpty })
      .joined(separator: " · ")
  }
  private func serviceSession(
    _ method: String, _ session: [String: Any], extra: [String: Any] = [:]
  ) {
    var params = extra
    params["sessionId"] = session["sessionId"]
    params["cwd"] = session["cwd"]
    workspace.tabs[workspace.selected].model.call(method, params) { result in
      switch result {
      case .failure(let error):
        navigation.message = error.localizedDescription
        workspace.tabs[workspace.selected].model.notice = error.localizedDescription
      case .success(let value):
        if method == "sessions:rename",
          workspace.tabs[workspace.selected].model.resumeID == string(session["sessionId"])
        {
          workspace.tabs[workspace.selected].model.customTitle = string(extra["title"])
        }
        if method == "sessions:fork" {
          var fork = session
          fork["sessionId"] = dictionary(value)["sessionId"]
          workspace.add()
          workspace.tabs[workspace.selected].model.openHistory(fork)
        }
        if method == "sessions:delete" {
          workspace.tabs[workspace.selected].model.notice =
            interfaceText("Backup saved") + ": " + string(value)
        }
      }
      navigation.load(workspace.tabs[workspace.selected].model)
    }
  }
  private var folder: String {
    workspace.tabs[workspace.selected].model.cwd.map { URL(fileURLWithPath: $0).lastPathComponent }
      ?? ui("No workspace")
  }
  private var header: some View {
    NativeTopBar(
      model: workspace.tabs[workspace.selected].model, options: options, folder: folder,
      files: { navigation.files.toggle() },
      usage: {
        options.settingsPage = "usage"
        options.settings = true
      })
  }
  private var tabBar: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 5) {
        ForEach(Array(workspace.tabs.enumerated()), id: \.element.id) { index, tab in
          HStack(spacing: 10) {
            Button {
              workspace.selected = index
            } label: {
              Text(tab.model.title).lineLimit(1).frame(maxWidth: 150)
            }.buttonStyle(.plain)
            Button {
              workspace.close(index)
            } label: {
              Image(systemName: "xmark").font(.system(size: scaled(9))).foregroundColor(
                Palette.muted)
            }.buttonStyle(.plain).help(ui("Close chat"))
          }.padding(.horizontal, 13).padding(.vertical, 9).background(
            index == workspace.selected ? Palette.panel : .clear
          ).clipShape(RoundedRectangle(cornerRadius: 9)).overlay(
            RoundedRectangle(cornerRadius: 9).stroke(
              index == workspace.selected ? Palette.border : .clear))
        }
        Button {
          workspace.add()
        } label: {
          Image(systemName: "plus").padding(8)
        }.buttonStyle(.plain).foregroundColor(Palette.muted)
      }.padding(.horizontal, 16).padding(.vertical, 6)
    }.frame(height: 43).overlay(alignment: .bottom) {
      Rectangle().fill(Palette.border).frame(height: 1)
    }
  }

}
private struct NativeChatView: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @ObservedObject var model: AppModel
  let onFork: (String, String) -> Void
  @StateObject private var options = ViewOptions()
  @StateObject private var suggestions = ComposerSuggestions()
  var body: some View {
    VStack(spacing: 0) {
      if model.connecting && model.entries.isEmpty {
        VStack(spacing: 12) {
          ProgressView()
          Text(interfaceText("Loading chat history…")).font(.caption).foregroundColor(Palette.muted)
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
      } else if model.entries.isEmpty {
        welcome.frame(maxWidth: .infinity, maxHeight: .infinity)
      } else {
        GeometryReader { viewport in
          ScrollViewReader { proxy in
            ScrollView {
              LazyVStack(alignment: .leading, spacing: 24) {
                ForEach(model.entries.filter { !options.userOnly || $0.role == "You" }) { entry in
                  NativeMessageRow(model: model, options: options, entry: entry, onFork: onFork).id(
                    entry.id
                  )
                  .onTapGesture {
                    if options.userOnly {
                      options.userOnly = false
                      DispatchQueue.main.async { proxy.scrollTo(entry.id, anchor: .top) }
                      options.followTail = false
                    }
                  }
                }
                Color.clear.frame(height: 1).id("conversation-bottom").background(
                  GeometryReader { location in
                    Color.clear.preference(
                      key: ConversationBottom.self,
                      value: location.frame(in: .named("conversation-scroll")).maxY)
                  })
              }.padding(28).frame(maxWidth: 900).frame(maxWidth: .infinity)
            }
            .coordinateSpace(name: "conversation-scroll")
            .onPreferenceChange(ConversationBottom.self) { value in
              options.followTail = value <= viewport.size.height + 55
            }
            .onChange(of: model.entries.last?.text) { _ in
              if options.followTail {
                DispatchQueue.main.async { proxy.scrollTo("conversation-bottom", anchor: .bottom) }
              }
            }
            .onChange(of: model.entries.count) { _ in
              if options.followTail {
                DispatchQueue.main.async { proxy.scrollTo("conversation-bottom", anchor: .bottom) }
              }
            }
            .overlay(alignment: .bottomTrailing) {
              if !options.followTail {
                Button {
                  proxy.scrollTo("conversation-bottom", anchor: .bottom)
                  options.followTail = true
                } label: {
                  Image(systemName: "arrow.down").padding(10).modifier(Outline(radius: 20))
                }.buttonStyle(.plain).padding(15)
              }
            }
          }
        }
      }
      composer
    }.onDrop(of: [UTType.fileURL], isTargeted: nil) { providers in
      for provider in providers {
        _ = provider.loadObject(ofClass: URL.self) { url, _ in
          if let url { DispatchQueue.main.async { model.addAttachmentPaths([url.path]) } }
        }
      }
      return !providers.isEmpty
    }
    .onAppear { options.modelID = model.modelID }
    .deskModal(isPresented: $options.rewind) {
      NativeRewindView(model: model, id: options.rewindID) { options.rewind = false }
    }
    .deskConfirm(
      isPresented: $options.withdraw, title: "Withdraw message",
      message:
        "This removes this message and later replies from this conversation. Files are not restored; the original transcript is preserved.",
      confirm: "Withdraw"
    ) { if let entry = options.selectedEntry { model.editMessage(entry, withdraw: true) } }

  }
  private var welcome: some View {
    ScrollView {
      VStack(spacing: 22) {
        Spacer(minLength: 60)
        Mark(size: 76).shadow(color: .black.opacity(0.06), radius: 12, y: 4)
        Text(
          ui(
            Calendar.current.component(.hour, from: Date()) < 6
              ? "Working late"
              : Calendar.current.component(.hour, from: Date()) < 12
                ? "Good morning"
                : Calendar.current.component(.hour, from: Date()) < 18
                  ? "Good afternoon" : "Good evening") + ui(", what shall we build today?")
        ).font(.system(size: scaled(30), weight: .medium, design: .serif)).multilineTextAlignment(
          .center)
        Text(
          ui(
            "Work with AI in your local project. Every command and file edit asks for your approval first."
          )
        ).foregroundColor(Palette.secondary).multilineTextAlignment(.center).frame(maxWidth: 480)
        Button {
          model.chooseWorkspace()
        } label: {
          Label(
            model.cwd.map { URL(fileURLWithPath: $0).lastPathComponent } ?? ui("Choose workspace"),
            systemImage: "folder"
          ).padding(.horizontal, 16).padding(.vertical, 9).modifier(Outline(radius: 20))
        }.buttonStyle(.plain)
        VStack(spacing: 8) {
          ForEach(["介绍一下这个项目的结构和用途", "帮我找出代码里的一个潜在问题并修复", "为当前项目补充必要的测试"], id: \.self) { prompt in
            Button {
              model.draft = prompt
              if model.cwd == nil { model.chooseWorkspace() }
              if model.cwd != nil { model.send() }
            } label: {
              HStack {
                Text(ui(prompt))
                Spacer()
                Image(systemName: "arrow.up.left").foregroundColor(Palette.muted)
              }.padding(14).modifier(Outline(radius: 13))
            }.buttonStyle(.plain)
          }
        }.frame(maxWidth: 560).padding(.top, 4)
        Spacer(minLength: 20)
      }.padding(.horizontal, 32).frame(maxWidth: .infinity)
    }
  }
  private var composer: some View {
    VStack(alignment: .leading, spacing: 8) {
      if let notice = model.notice {
        Text(notice).foregroundColor(.red).textSelection(.enabled).font(.caption)
      }
      if let permission = model.permission {
        NativePermissionView(model: model, request: permission).id(string(permission["id"]))
      }
      Text(model.cwd.map { URL(fileURLWithPath: $0).lastPathComponent } ?? ui("No workspace")).font(
        .system(size: scaled(11))
      ).foregroundColor(Palette.muted).padding(.leading, 6)
      if !suggestions.items.isEmpty
        && (model.draft.hasPrefix("/")
          || model.draft.split(separator: " ").last?.hasPrefix("@") == true)
      {
        ScrollView {
          VStack(alignment: .leading, spacing: 5) {
            ForEach(Array(suggestions.items.prefix(8).enumerated()), id: \.offset) { _, item in
              Button {
                if model.draft.hasPrefix("/") {
                  model.draft = "/" + string(item["name"]) + " "
                } else {
                  let text = model.draft
                  model.draft =
                    String(text.prefix(upTo: text.lastIndex(of: "@") ?? text.endIndex)) + "@"
                    + (string(item["relativePath"]).isEmpty
                      ? string(item["path"]) : string(item["relativePath"])) + " "
                }
                suggestions.items = []
              } label: {
                HStack {
                  Text(string(item["name"]))
                  Text(string(item["description"])).font(.caption).foregroundColor(Palette.muted)
                  Spacer()
                }.padding(8)
              }.buttonStyle(.plain)
            }
          }
        }.frame(maxHeight: 160).modifier(Outline())
      }
      if !model.attachmentErrors.isEmpty {
        ForEach(Array(model.attachmentErrors.enumerated()), id: \.offset) { index, failure in
          HStack {
            Image(systemName: "exclamationmark.circle")
            Text(string(failure["name"]))
            Text(
              interfaceText(
                [
                  "unsupported": "Unsupported file type", "too-large": "File is too large",
                  "unreadable": "Could not read file", "empty": "Empty file",
                ][string(failure["reason"])] ?? "Could not read file"))
            Spacer()
            Button {
              model.attachmentErrors.remove(at: index)
            } label: {
              Image(systemName: "xmark")
            }
          }.font(.caption).foregroundColor(.red).padding(8).modifier(Outline())
        }
      }
      if !model.attachments.isEmpty {
        ScrollView(.horizontal) {
          HStack {
            ForEach(Array(model.attachments.enumerated()), id: \.offset) { index, attachment in
              HStack {
                Image(systemName: "doc")
                Text(string(attachment["name"]))
                Button {
                  model.attachments.remove(at: index)
                } label: {
                  Image(systemName: "xmark")
                }
              }.font(.caption).padding(8).modifier(Outline())
            }
          }
        }
      }
      VStack(alignment: .leading, spacing: 6) {
        NativeComposerInput(
          text: $model.draft, height: $options.editorHeight, submit: { model.send() },
          files: { model.addAttachmentPaths($0) },
          image: { model.addClipboardImage($0) }
        )
        .frame(height: options.editorHeight)
        .overlay(alignment: .topLeading) {
          if model.draft.isEmpty {
            Text(interfaceText("Message… / for commands · @ to reference files")).foregroundColor(
              Palette.muted
            ).padding(.top, 2).allowsHitTesting(false)
          }
        }
        .onChange(of: model.draft) { _ in suggestions.completions(model) }

        HStack {
          Button {
            model.pickAttachments()
          } label: {
            Image(systemName: "paperclip").foregroundColor(Palette.muted)
          }.buttonStyle(.plain).help(interfaceText("Attach files"))
          Text(interfaceText("Enter to send · Shift+Enter for a new line")).font(
            .system(size: scaled(10))
          ).foregroundColor(Palette.muted)
          Spacer()
          Button {
            if model.running {
              model.request("interrupt")
            } else {
              model.send()
            }
          } label: {
            Image(systemName: model.running ? "stop.fill" : "arrow.up").font(
              .system(size: scaled(17), weight: .medium)
            ).foregroundColor(.white).frame(width: 32, height: 32).background(
              Palette.coral.opacity(model.cwd == nil ? 0.4 : 1)
            ).clipShape(Circle())
          }.buttonStyle(.plain).disabled(
            model.cwd == nil || (model.connecting && !model.running)
              || (!model.running && !model.connecting
                && model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                && model.attachments.isEmpty)
          ).keyboardShortcut(.return, modifiers: .command).help(ui("Send message"))
        }
      }.padding(.horizontal, 12).padding(.top, 10).padding(.bottom, 8).modifier(Outline(radius: 20))
        .shadow(
          color: .black.opacity(0.035), radius: 8, y: 3)
      HStack(spacing: 6) {
        chip(options.compact ? "Detailed" : "Compact", icon: "line.3.horizontal.decrease") {
          options.compact.toggle()
        }
        chip(options.userOnly ? "User only" : "All messages", icon: "bubble.left") {
          options.userOnly.toggle()
        }
        Spacer(minLength: 0)
        Button {
          options.modelPicker.toggle()
        } label: {
          Label(model.modelID, systemImage: "sparkles").lineLimit(1).frame(maxWidth: 180).padding(8)
            .modifier(Outline(radius: 18))
        }.buttonStyle(.plain).popover(isPresented: $options.modelPicker) {
          NativeModelPicker(model: model)
        }

        Menu {
          ForEach(["default", "low", "medium", "high", "xhigh", "max"], id: \.self) { effort in
            Button(effort) { model.changeEffort(effort) }
          }
        } label: {
          Label(model.effort, systemImage: "gauge.medium")
        }.menuStyle(.borderlessButton).padding(8).modifier(Outline(radius: 18)).fixedSize()
        Menu {
          Button(ui("Ask every time")) { model.changeMode("default") }
          Button(ui("Plan mode")) { model.changeMode("plan") }
          Button(ui("Accept edits")) { model.changeMode("acceptEdits") }
          Divider()
          Button(interfaceText("Skip all confirmations")) { model.changeMode("bypassPermissions") }
        } label: {
          Label(
            ui(
              model.mode == "bypassPermissions"
                ? "Skip all confirmations"
                : model.mode == "plan"
                  ? "Plan mode" : model.mode == "acceptEdits" ? "Accept edits" : "Ask every time"),
            systemImage: "shield")
        }.menuStyle(.borderlessButton).padding(8).modifier(Outline(radius: 18)).fixedSize()
      }.font(.system(size: scaled(11))).foregroundColor(Palette.secondary)
      Text(ui("AI can make mistakes. Review important actions and code changes.")).font(
        .system(size: scaled(10))
      ).foregroundColor(Palette.muted).frame(maxWidth: .infinity)
    }.padding(.horizontal, 24).padding(.top, 8).padding(.bottom, 12).frame(maxWidth: 868).frame(
      maxWidth: .infinity)
  }
  private func chip(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Label(ui(title), systemImage: icon).padding(8).modifier(Outline(radius: 18))
    }.buttonStyle(.plain)
  }
}

private struct ConversationBottom: PreferenceKey {
  static let defaultValue: CGFloat = 0
  static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}
