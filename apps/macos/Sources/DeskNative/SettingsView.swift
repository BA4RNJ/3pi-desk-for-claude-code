import AppKit
import SwiftUI

struct NativeSettingsView: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @StateObject private var store: PageStore
  let close: () -> Void
  init(model: AppModel, initialPage: String = "general", close: @escaping () -> Void) {
    let store = PageStore(model: model)
    store.page = initialPage
    _store = StateObject(wrappedValue: store)
    self.close = close
  }
  private let pages = [
    ("general", "General", "slider.horizontal.3"), ("api", "API", "key"),
    ("permissions", "Permissions", "shield"), ("extensions", "Extensions", "square.stack.3d.up"),
    ("background", "Background", "terminal"), ("usage", "Usage", "gauge.medium"),
    ("about", "About", "info.circle"),
  ]
  var body: some View {
    HStack(spacing: 0) {
      VStack(alignment: .leading, spacing: 3) {
        HStack {
          Mark(size: 40)
          VStack(alignment: .leading) {
            Text("3PI Desk").font(.system(size: scaled(17), weight: .semibold, design: .serif))
            Text(interfaceText("AI coding workspace") + " · v0.4.1").font(.caption).foregroundColor(
              Palette.muted)
          }
        }.padding(.horizontal, 6).padding(.bottom, 20)
        ForEach(pages, id: \.0) { item in
          Button {
            store.page = item.0
            store.loadPage()
          } label: {
            Label(interfaceText(item.1), systemImage: item.2).frame(
              maxWidth: .infinity, alignment: .leading
            ).padding(.horizontal, 10).padding(.vertical, 8).font(.system(size: scaled(12.5)))
              .background(store.page == item.0 ? Palette.panel : .clear).cornerRadius(9)
          }.buttonStyle(.plain)
        }
        Spacer()
        Text(store.fields["providerId"] ?? "").foregroundColor(Palette.muted)
        Text(store.fields["model"] ?? "").font(.caption).lineLimit(2)
      }.padding(.horizontal, 13).padding(.top, 22).padding(.bottom, 14).frame(width: 208)
        .background(Palette.sidebar)
      Rectangle().fill(Palette.border).frame(width: 1)
      VStack(spacing: 0) {
        ScrollView {
          VStack(alignment: .leading, spacing: 8) {
            Text(
              interfaceText(
                store.page == "api"
                  ? "API configuration"
                  : pages.first(where: { $0.0 == store.page })?.1 ?? "Settings")
            ).font(.system(size: scaled(23), weight: .semibold, design: .serif))
            if !store.message.isEmpty {
              Text(store.message).font(.caption).foregroundColor(Palette.coral).textSelection(
                .enabled
              ).padding(10).frame(maxWidth: .infinity, alignment: .leading).modifier(Outline())
            }
            switch store.page {
            case "api": apiPage
            case "permissions": permissionsPage
            case "extensions": NativeExtensionsView(store: store)
            case "background": backgroundPage
            case "usage": usagePage
            case "about": aboutPage
            default: generalPage
            }
          }.padding(.horizontal, 30).padding(.top, 26).padding(.bottom, 30).frame(
            maxWidth: .infinity, alignment: .leading)
        }
      }.overlay(alignment: .topTrailing) {
        HStack {
          if store.busy { ProgressView().controlSize(.small) }
          Button(action: close) { Image(systemName: "xmark") }.buttonStyle(.plain).keyboardShortcut(
            .cancelAction)
        }.padding(16)
      }
    }.frame(
      minWidth: 700, idealWidth: 940, maxWidth: 940, minHeight: 440, idealHeight: 730,
      maxHeight: 730
    ).background(Palette.panel).foregroundColor(Palette.ink).font(
      .system(size: scaled(13))
    )
    .onAppear {
      store.load()
      store.loadPage()
    }
    .onChange(of: store.fields["theme"]) { value in
      if let value {
        appearance.theme = value
        appearance.save()
      }
    }
    .onChange(of: store.fields["language"]) { value in
      if let value {
        appearance.language = value
        appearance.save()
      }
    }
    .onChange(of: store.fields["fontScale"]) { value in
      if let value, let scale = Double(value), (0.8...1.4).contains(scale) {
        appearance.fontScale = scale
        appearance.save()
      }
    }
    .onChange(of: store.fields["accent"]) { value in
      if let value {
        appearance.accent = value
        appearance.save()
      }
    }
    .preferredColorScheme(appearance.scheme)
    .deskConfirm(
      isPresented: $store.confirmation, title: "Confirm action",
      message: "This changes the selected local configuration. Continue?", confirm: "Confirm"
    ) {
      store.pendingAction?()
      store.pendingAction = nil
    }

  }
  private var generalPage: some View {
    VStack(alignment: .leading, spacing: 20) {
      note("Appearance, integrations and session budget.")
      group("Appearance") {
        NativeSegments(
          selection: store.text("theme"),
          items: [("light", "Light"), ("dark", "Dark"), ("system", "System")])
      }
      group("Language") {
        NativeSegments(
          selection: store.text("language"), items: [("en", "English"), ("zh-Hans", "中文")])
      }
      group("Font size") {
        NativeSegments(
          selection: store.text("fontScale"),
          items: [("0.9", "Small"), ("1", "Standard"), ("1.1", "Large"), ("1.2", "Extra large")])
      }
      group("Accent color") {
        HStack(spacing: 12) {
          ForEach(["coral", "blue", "green", "purple"], id: \.self) { accent in
            Button {
              store.fields["accent"] = accent
            } label: {
              Circle().fill(
                accent == "blue"
                  ? Color.blue
                  : accent == "green"
                    ? .green
                    : accent == "purple" ? .purple : Color(red: 0.85, green: 0.47, blue: 0.34)
              ).frame(width: 24, height: 24).padding(4).overlay(
                Circle().stroke(store.fields["accent"] == accent ? Palette.ink : .clear))
            }.buttonStyle(.plain).help(interfaceText(accent))
          }
        }
      }
      Toggle(interfaceText("Compact spacing"), isOn: store.toggle("compactMode"))
      Divider()
      Toggle(interfaceText("IDE integration"), isOn: store.toggle("ideIntegration"))
      Toggle(interfaceText("Chrome integration"), isOn: store.toggle("chromeIntegration"))
      Toggle(interfaceText("Close to tray"), isOn: store.toggle("closeToTray"))
      Toggle(interfaceText("Global shortcut"), isOn: store.toggle("globalShortcut"))
      field("Session budget limit (USD)", key: "maxBudgetUsd")
      note("Integration and budget preferences apply to new chats.")
      primary("Save preferences") { store.savePreferences() }
    }
  }
  private var apiPage: some View {
    VStack(alignment: .leading, spacing: 18) {
      note("Configure an Anthropic Messages compatible provider.")
      group("Provider") {
        LazyVGrid(
          columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8
        ) {
          ForEach(store.providers, id: \.identifier) { provider in
            Button {
              store.fields["providerId"] = string(provider["id"])
              store.fields["baseUrl"] = string(provider["baseUrl"])
              store.fields["model"] = string(provider["defaultModel"])
              store.fields["authMode"] = string(provider["id"]) == "anthropic" ? "apiKey" : "bearer"
            } label: {
              VStack(alignment: .leading, spacing: 7) {
                Text(string(provider["name"])).font(.system(size: scaled(12), weight: .semibold))
                Text(interfaceText(string(provider["description"]))).font(.system(size: scaled(10)))
                  .foregroundColor(Palette.muted).lineLimit(3)
              }.frame(maxWidth: .infinity, minHeight: 60, alignment: .topLeading).padding(10)
                .modifier(Outline()).overlay(
                  RoundedRectangle(cornerRadius: 10).stroke(
                    store.fields["providerId"] == string(provider["id"]) ? Palette.coral : .clear,
                    lineWidth: 1.5))
            }.buttonStyle(.plain)
          }
        }
      }
      profilesSection
      field("Base URL", key: "baseUrl")
      group("Authentication") {
        NativeSegments(
          selection: store.text("authMode"), items: [("bearer", "Bearer"), ("apiKey", "x-api-key")])
      }
      group("Token") {
        SecureField(
          store.fields["tokenMasked"].flatMap { $0.isEmpty ? nil : $0 }
            ?? interfaceText("Enter token"), text: store.text("token")
        ).textFieldStyle(.plain).padding(12).modifier(Outline())
        note("Leave blank to keep the saved token.")
      }
      field("Model", key: "model")
      HStack {
        Button(interfaceText("Test & fetch models")) { store.testAPI() }.disabled(store.busy)
        primary("Save API") { store.saveAPI() }.disabled(store.needsToken || store.busy)
      }
      ForEach(objects(store.snapshot["discoveredModels"]), id: \.identifier) { model in
        Button(string(model["name"]).isEmpty ? string(model["id"]) : string(model["name"])) {
          store.fields["model"] = string(model["id"])
        }
      }
      Divider()
      Text(interfaceText("Custom models")).font(.headline)
      HStack {
        TextField(interfaceText("Model ID"), text: store.text("customID"))
        TextField(interfaceText("Display name"), text: store.text("customName"))
        TextField(interfaceText("Context window"), text: store.text("customContext"))
      }.textFieldStyle(.roundedBorder)
      Button(interfaceText("Add model")) {
        var model: [String: Any] = [
          "id": store.fields["customID"] ?? "", "name": store.fields["customName"] ?? "",
          "providerId": store.fields["providerId"] ?? "custom",
        ]
        if let context = Int(store.fields["customContext"] ?? "") {
          model["contextWindow"] = context
        }
        store.run("settings:saveCustomModel", ["model": model]) {
          store.snapshot["customModels"] = $0
        }
      }.disabled((store.fields["customID"] ?? "").isEmpty)
      ForEach(
        objects(store.snapshot["customModels"]).filter {
          string($0["providerId"]).isEmpty || string($0["providerId"]) == store.fields["providerId"]
        }, id: \.identifier
      ) { model in
        HStack {
          Text(string(model["name"]))
          Spacer()
          Text(string(model["id"])).foregroundColor(Palette.muted)
          Button(interfaceText("Delete")) {
            store.confirm {
              store.run(
                "settings:deleteCustomModel",
                ["id": string(model["id"]), "providerId": string(model["providerId"])]
              ) { store.snapshot["customModels"] = $0 }
            }
          }
        }
      }

    }
  }
  private var profilesSection: some View {
    VStack(alignment: .leading, spacing: 12) {
      Divider()
      Text(interfaceText("API profiles")).font(.headline)
      HStack {
        TextField(interfaceText("Profile name"), text: store.text("profileName")).textFieldStyle(
          .roundedBorder)
        Button(interfaceText("Save profile")) {
          var profile = store.apiPatch()
          profile["name"] = store.fields["profileName"] ?? ""
          store.run("settings:saveApiProfile", ["profile": profile]) {
            store.snapshot["profiles"] = $0
          }
        }
      }
      ForEach(objects(store.snapshot["profiles"]), id: \.identifier) { profile in
        HStack {
          Text(string(profile["name"]))
          Spacer()
          Button(interfaceText("Apply")) {
            store.run("settings:applyApiProfile", ["id": string(profile["id"])]) { _ in store.load()
            }
          }
          Button(interfaceText("Delete")) {
            store.confirm {
              store.run("settings:deleteApiProfile", ["id": string(profile["id"])]) {
                store.snapshot["profiles"] = $0
              }
            }
          }
        }
      }
    }
  }
  private var permissionsPage: some View {
    VStack(alignment: .leading, spacing: 18) {
      note("Control tool access and additional directories. One rule per line.")
      group("Additional directories") {
        editor("additionalDirectories", height: 65)
        Button(interfaceText("Add directory")) { store.directory() }
      }
      group("Allowed tools") { editor("allowedTools", height: 60) }
      group("Disallowed tools") { editor("disallowedTools", height: 60) }
      ForEach(["allow", "ask", "deny"], id: \.self) { key in
        group(key.capitalized) { editor(key, height: 85) }
      }
      primary("Save permissions") {
        store.savePreferences()
        store.saveRules()
      }
    }
  }
  private var backgroundPage: some View {
    VStack(alignment: .leading, spacing: 16) {
      note("Local background sessions continue running when this panel closes.")
      field("Working directory", key: "backgroundCwd")
      group("Task prompt") { editor("backgroundPrompt", height: 90) }
      Toggle(interfaceText("Trust this directory"), isOn: store.toggle("trust"))
      HStack {
        primary("Start background session") {
          store.run(
            "background:start",
            [
              "cwd": store.fields["backgroundCwd"].flatMap { $0.isEmpty ? nil : $0 } ?? store.cwd,
              "prompt": store.fields["backgroundPrompt"] ?? "",
              "trust": store.flags["trust"] ?? false,
            ]
          ) { _ in store.loadPage() }
        }.disabled(
          store.busy
            || (store.fields["backgroundPrompt"] ?? "").trimmingCharacters(
              in: .whitespacesAndNewlines
            ).isEmpty)
        Button(interfaceText("Refresh")) { store.loadPage() }
      }
      if store.background.isEmpty { note("No background sessions.") }
      ForEach(store.background, id: \.identifier) { item in
        VStack(alignment: .leading, spacing: 10) {
          Text(
            string(item["title"]).isEmpty
              ? string(item["id"] ?? item["sessionId"]) : string(item["title"])
          ).fontWeight(.semibold)
          Text(string(item["status"])).foregroundColor(Palette.muted)
          HStack {
            Button(interfaceText("Logs")) {
              store.run("background:logs", ["id": string(item["id"] ?? item["sessionId"])]) {
                store.fields["logs"] = string($0)
              }
            }
            Button(interfaceText("Stop")) {
              store.run("background:stop", ["id": string(item["id"] ?? item["sessionId"])]) { _ in
                store.loadPage()
              }
            }
            Button(interfaceText("Remove")) {
              store.confirm {
                store.run("background:remove", ["id": string(item["id"] ?? item["sessionId"])]) {
                  _ in store.loadPage()
                }
              }
            }
          }
        }.padding(14).modifier(Outline())
      }
      if !(store.fields["logs"] ?? "").isEmpty {
        group("Logs") {
          Text(store.fields["logs"] ?? "").font(.system(.caption, design: .monospaced))
            .textSelection(.enabled)
        }
      }
      note(
        "Cloud sessions require an Anthropic account and may be unavailable with third-party providers."
      )
    }
  }
  private var usagePage: some View {
    VStack(alignment: .leading, spacing: 20) {
      HStack {
        metric(
          "Estimated session cost",
          value: String(
            format: "$%.4f",
            store.model.usageSummary["costUsd"] as? Double ?? store.model.statistics["costUsd"]
              as? Double ?? 0))
        metric("Token usage", value: String(store.model.usageSummary["totalTokens"] as? Int ?? 0))
      }
      group("Context") {
        ProgressView(
          value: min(100, max(0, store.model.context["percentage"] as? Double ?? 0)), total: 100
        ).tint(Palette.coral)
        Text(
          "\(store.model.context["used"] as? Int ?? 0) / \(store.model.context["max"] as? Int ?? 0)"
        )
      }
      detail("Current model", store.model.modelID)
      detail("Unit price", store.fields["pricing"] ?? interfaceText("Unknown"))
      detail("Context window", String(store.model.context["max"] as? Int ?? 0))
      detail(
        "Maximum output",
        store.model.availableModels.first(where: { string($0["id"]) == store.model.modelID })?[
          "maxOutput"
        ].map { String(describing: $0) } ?? interfaceText("Unknown"))
      detail("Effort", store.model.effort)
      detail("Session budget limit (USD)", store.fields["maxBudgetUsd"] ?? "—")
      note(
        "Actual limits and billing are determined by your provider. Local estimates are for reference."
      )
      Button(interfaceText("Open provider console")) {
        if let provider = store.providers.first(where: {
          string($0["id"]) == store.fields["providerId"]
        }), let url = URL(string: string(provider["consoleUrl"])) {
          NSWorkspace.shared.open(url)
        }
      }
    }
  }
  private var aboutPage: some View {
    VStack(alignment: .leading, spacing: 18) {
      Mark(size: 64)
      Text("3PI Desk").font(.title)
      note("Local AI coding interface powered by Claude Agent SDK.")
      ForEach(
        [
          ("Application version", "app"), ("Agent SDK", "sdk"), ("Built-in engine", "claudeCode"),
          ("Node", "node"), ("Latest SDK", "latestSdk"),
        ], id: \.0
      ) { detail($0.0, string(store.versions[$0.1]).isEmpty ? "—" : string(store.versions[$0.1])) }
      HStack {
        Button(interfaceText("Check for updates")) {
          store.run("app:versionInfo") { store.versions = dictionary($0) }
        }
        Button(interfaceText("Copy update command")) {
          NSPasteboard.general.clearContents()
          NSPasteboard.general.setString(
            "npm install @anthropic-ai/claude-agent-sdk@latest && scripts/native/package-standalone.sh",
            forType: .string)
        }
      }
      note(
        "This is a local build without an automatic update feed. Rebuild after updating the SDK.")
    }
  }
  func field(_ title: String, key: String) -> some View {
    group(title) {
      TextField(interfaceText(title), text: store.text(key)).textFieldStyle(.plain).padding(12)
        .modifier(Outline())
    }
  }
  func editor(_ key: String, height: CGFloat) -> some View {
    TextEditor(text: store.text(key)).scrollContentBackground(.hidden).font(
      .system(size: scaled(12), design: .monospaced)
    ).frame(height: height).padding(8).modifier(Outline())
  }
  func group<C: View>(_ title: String, @ViewBuilder content: () -> C) -> some View {
    VStack(alignment: .leading, spacing: 9) {
      Text(interfaceText(title)).font(.system(size: scaled(12), weight: .semibold)).foregroundColor(
        Palette.secondary)
      content()
    }.frame(maxWidth: .infinity, alignment: .leading)
  }
  func note(_ text: String) -> some View {
    Text(interfaceText(text)).font(.system(size: scaled(12))).foregroundColor(Palette.muted)
      .fixedSize(horizontal: false, vertical: true)
  }
  func detail(_ title: String, _ value: String) -> some View {
    HStack {
      Text(interfaceText(title)).foregroundColor(Palette.secondary)
      Spacer()
      Text(value).fontWeight(.medium).textSelection(.enabled)
    }.padding(.vertical, 10).overlay(alignment: .bottom) {
      Rectangle().fill(Palette.border).frame(height: 1)
    }
  }
  func metric(_ title: String, value: String) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(interfaceText(title)).foregroundColor(Palette.muted)
      Text(value).font(.system(size: scaled(27), weight: .semibold, design: .serif))
    }.frame(maxWidth: .infinity, alignment: .leading).padding(20).modifier(Outline(radius: 14))
  }
  func primary(_ title: String, action: @escaping () -> Void) -> some View {
    Button(interfaceText(title), action: action).buttonStyle(.borderedProminent).tint(Palette.coral)
  }
}
extension Dictionary where Key == String, Value == Any {
  var identifier: String {
    for key in ["id", "pluginId", "sessionId", "path"] {
      let value = string(self[key])
      if !value.isEmpty { return value }
    }
    if !string(self["event"]).isEmpty {
      return ["event", "matcher", "command", "source"].map { string(self[$0]) }.joined(
        separator: "|")
    }
    return ["name", "scope", "marketplaceName"].map { string(self[$0]) }.joined(separator: "|")
  }
}

struct NativeSegments: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @Binding var selection: String
  let items: [(String, String)]
  var body: some View {
    HStack(spacing: 4) {
      ForEach(items, id: \.0) { item in
        Button {
          selection = item.0
        } label: {
          Text(interfaceText(item.1)).frame(maxWidth: .infinity).padding(.horizontal, 12).padding(
            .vertical, 9
          ).background(selection == item.0 ? Palette.panel : .clear).cornerRadius(8)
        }.buttonStyle(.plain)
      }
    }.padding(4).background(Palette.background).cornerRadius(11).overlay(
      RoundedRectangle(cornerRadius: 11).stroke(Palette.border))
  }
}
