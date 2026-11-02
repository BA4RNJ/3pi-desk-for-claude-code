import SwiftUI

struct NativeExtensionsView: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @ObservedObject var store: PageStore
  private let tabs = [
    ("mcp", "MCP"), ("plugins", "Plugins"), ("skills", "Skills"), ("hooks", "Hooks"),
    ("agents", "Agents"),
  ]
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack {
        ForEach(tabs, id: \.0) { item in
          Button {
            store.extensionPage = item.0
            store.scope = "user"
            store.readConfig()
          } label: {
            Text(interfaceText(item.1)).padding(.horizontal, 13).padding(.vertical, 8).background(
              store.extensionPage == item.0 ? Palette.panel : .clear
            ).cornerRadius(8)
          }.buttonStyle(.plain)
        }
        Spacer()
        Button {
          store.reloadExtensions()
        } label: {
          Image(systemName: "arrow.clockwise")
        }
      }
      switch store.extensionPage {
      case "plugins": plugins
      case "skills", "agents": definitions
      default: config
      }
    }.deskModal(isPresented: $store.editor) { editor }
  }
  private var config: some View {
    VStack(alignment: .leading, spacing: 16) {
      ForEach(Array(objects(store.extensions[store.extensionPage]).enumerated()), id: \.offset) {
        _, item in
        HStack {
          row(
            string(item["name"]).isEmpty ? string(item["event"]) : string(item["name"]),
            subtitle: string(item["status"]).isEmpty
              ? string(item["command"]) : string(item["status"]))
          if store.extensionPage == "mcp" {
            Button(interfaceText(string(item["status"]) == "disabled" ? "Enable" : "Disable")) {
              store.run(
                "toggleMcp",
                ["name": string(item["name"]), "enabled": string(item["status"]) == "disabled"]
              ) { _ in store.refreshMcp() }
            }.disabled(!store.model.hasSession || string(item["status"]).isEmpty)
          }
        }
      }
      HStack {
        Text(interfaceText(store.extensionPage == "mcp" ? "MCP configuration" : "Hooks JSON"))
          .fontWeight(.semibold)
        Spacer()
        Picker("", selection: $store.scope) {
          Text(interfaceText("User")).tag("user")
          Text(interfaceText("Project")).tag("project")
          if store.extensionPage == "mcp" { Text(interfaceText("Local")).tag("local") }
        }.pickerStyle(.segmented).frame(width: 240).onChange(of: store.scope) { _ in
          store.readConfig()
        }
      }
      Text(store.fields["configPath"] ?? "").font(.caption).foregroundColor(Palette.muted)
        .textSelection(.enabled)
      TextEditor(text: store.text("config")).scrollContentBackground(.hidden).font(
        .system(size: scaled(12), design: .monospaced)
      ).frame(height: 240).padding(10).modifier(Outline())
      HStack {
        Text(interfaceText("Saved configuration applies to new chats.")).font(.caption)
          .foregroundColor(Palette.muted)
        Spacer()
        Button(interfaceText("Save configuration")) { store.saveConfig() }.buttonStyle(
          .borderedProminent
        ).tint(Palette.coral)
      }
    }
  }
  private var plugins: some View {
    VStack(alignment: .leading, spacing: 16) {
      if store.pluginBusy {
        HStack {
          ProgressView().controlSize(.small)
          Text(interfaceText("Running plugin operation…"))
          Spacer()
          Button(interfaceText("Cancel")) {
            store.run("extensions:cancelPluginAction") { _ in store.reloadExtensions() }
          }
        }.padding(10).modifier(Outline())
      }
      HStack {
        TextField(interfaceText("Plugin name or name@marketplace"), text: store.text("pluginName"))
          .textFieldStyle(.roundedBorder)
        Button(interfaceText("Install")) { plugin("install", store.fields["pluginName"] ?? "") }
          .disabled(store.pluginBusy || (store.fields["pluginName"] ?? "").isEmpty)
      }
      if objects(store.extensions["plugins"]).isEmpty {
        Text(interfaceText("No plugins installed. Install from the marketplace below."))
          .foregroundColor(Palette.muted)
      }
      ForEach(objects(store.extensions["plugins"]), id: \.identifier) { item in
        VStack(alignment: .leading) {
          row(string(item["name"]), subtitle: string(item["description"]))
          HStack {
            Button(interfaceText(item["enabled"] as? Bool == true ? "Disable" : "Enable")) {
              store.run(
                "extensions:togglePlugin",
                ["name": string(item["name"]), "enabled": !(item["enabled"] as? Bool ?? false)]
              ) { _ in store.reloadExtensions() }
            }
            Button(interfaceText("Update")) { plugin("update", string(item["name"])) }
            Button(interfaceText("Uninstall")) {
              store.confirm { plugin("uninstall", string(item["name"])) }
            }
          }
        }.disabled(store.pluginBusy)
      }
      Divider()
      HStack {
        Text(interfaceText("Plugin marketplace")).font(.headline)
        Spacer()
        Button(interfaceText("Refresh")) { store.readConfig() }
      }
      HStack {
        TextField(
          interfaceText("Add marketplace: owner/repo or Git URL"),
          text: store.text("marketplaceSource")
        ).textFieldStyle(.roundedBorder)
        Button(interfaceText("Add marketplace")) {
          store.run(
            "extensions:marketplaceAdd",
            ["source": store.fields["marketplaceSource"] ?? "", "cwd": store.cwd]
          ) { self.store.market = dictionary($0) }
        }.disabled(store.pluginBusy)
      }
      Button(interfaceText("Update all")) {
        store.run("extensions:marketplaceUpdate", ["cwd": store.cwd]) {
          store.market = dictionary($0)
        }
      }.disabled(store.pluginBusy)
      ForEach(objects(store.market["marketplaces"]), id: \.identifier) { item in
        HStack {
          VStack(alignment: .leading) {
            Text(string(item["name"]))
            Text(string(item["source"])).font(.caption).foregroundColor(Palette.muted)
          }
          Spacer()
          Button(interfaceText("Update")) {
            store.run(
              "extensions:marketplaceUpdate", ["cwd": store.cwd, "name": string(item["name"])]
            ) { store.market = dictionary($0) }
          }
          if string(item["name"]) != "claude-plugins-official" {
            Button(interfaceText("Remove")) {
              store.confirm {
                store.run(
                  "extensions:marketplaceRemove", ["cwd": store.cwd, "name": string(item["name"])]
                ) { store.market = dictionary($0) }
              }
            }
          }
        }.padding(10).modifier(Outline()).disabled(store.pluginBusy)
      }
      TextField(interfaceText("Search available plugins…"), text: store.text("marketSearch"))
        .textFieldStyle(.roundedBorder)
      ForEach(
        Array(
          objects(store.market["available"]).filter {
            (store.fields["marketSearch"] ?? "").isEmpty
              || string($0["name"]).localizedCaseInsensitiveContains(
                store.fields["marketSearch"] ?? "")
          }.prefix(160)), id: \.identifier
      ) { item in
        HStack {
          row(string(item["name"]), subtitle: string(item["description"]))
          Spacer()
          Button(interfaceText(item["installed"] as? Bool == true ? "Installed" : "Install")) {
            plugin("install", string(item["pluginId"]))
          }.disabled(store.pluginBusy || item["installed"] as? Bool == true)
        }
      }
    }
  }
  private var definitions: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Button(interfaceText(store.extensionPage == "skills" ? "New skill" : "New agent")) {
          store.newEditor()
        }
        Spacer()
        Picker(interfaceText("Scope"), selection: $store.scope) {
          Text(interfaceText("User")).tag("user")
          Text(interfaceText("Project")).tag("project")
        }.frame(width: 200)
      }
      Text(
        interfaceText(
          store.extensionPage == "skills"
            ? "Skills live in ~/.claude/skills or the project .claude/skills directory."
            : "Agents live in ~/.claude/agents or the project .claude/agents directory.")
      ).font(.caption).foregroundColor(Palette.muted)
      ForEach(objects(store.extensions[store.extensionPage]), id: \.identifier) { item in
        HStack {
          row(string(item["name"]), subtitle: string(item["description"]))
          Spacer()
          Text(string(item["scope"])).font(.caption).foregroundColor(Palette.muted)
          if !string(item["path"]).isEmpty {
            Button(interfaceText("Edit")) { store.openEditor(item) }
            Button(interfaceText("Delete")) {
              store.confirm {
                store.run(
                  "extensions:deleteFile", ["cwd": store.cwd, "path": string(item["path"])]
                ) { _ in store.reloadExtensions() }
              }
            }
          }
        }
      }
      if objects(store.extensions[store.extensionPage]).isEmpty {
        Text(interfaceText("No extensions found.")).foregroundColor(Palette.muted).padding(
          .vertical, 20)
      }
    }
  }
  private var editor: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Text(
          interfaceText(
            (store.fields["editorPath"] ?? "").isEmpty ? "New extension" : "Edit extension")
        ).font(.title2)
        Spacer()
        Button {
          store.editor = false
        } label: {
          Image(systemName: "xmark")
        }
      }
      TextField(interfaceText("Name"), text: store.text("editorName")).textFieldStyle(
        .roundedBorder)
      Text(store.fields["editorPath"] ?? "").font(.caption).foregroundColor(Palette.muted)
      TextEditor(text: store.text("editorText")).scrollContentBackground(.hidden).font(
        .system(size: scaled(12), design: .monospaced)
      ).padding(10).modifier(Outline())
      Text(store.message).foregroundColor(Palette.coral).font(.caption)
      HStack {
        Spacer()
        Button(interfaceText("Cancel")) { store.editor = false }
        Button(interfaceText("Save")) { store.saveEditor() }.buttonStyle(.borderedProminent).tint(
          Palette.coral
        ).disabled(
          store.busy
            || ((store.fields["editorPath"] ?? "").isEmpty
              && (store.fields["editorName"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                .isEmpty)
        )
      }
    }.padding(24).frame(width: 700, height: 550).background(Palette.background)
  }
  private func row(_ title: String, subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: 5) {
      Text(title).fontWeight(.medium)
      if !subtitle.isEmpty {
        Text(subtitle).font(.caption).foregroundColor(Palette.muted).lineLimit(3)
      }
    }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
  }
  private func plugin(_ action: String, _ name: String) {
    store.run("extensions:pluginAction", ["action": action, "name": name, "cwd": store.cwd]) { _ in
      store.reloadExtensions()
    }
  }
}
