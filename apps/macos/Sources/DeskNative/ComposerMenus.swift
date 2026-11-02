import SwiftUI

@MainActor final class ComposerSuggestions: ObservableObject {
  @Published var query = ""
  @Published var items = [[String: Any]]()
  @Published var error = ""
  @Published var loading = false
  func models(_ model: AppModel) {
    loading = true
    model.call("models:list") { result in
      self.loading = false
      switch result {
      case .success(let value):
        self.items = objects(value)
        model.availableModels = self.items
      case .failure(let error): self.error = error.localizedDescription
      }
    }
  }
  func completions(_ model: AppModel) {
    if model.draft.hasPrefix("/") {
      if model.hasSession {
        model.call("commands") { if case .success(let value) = $0 { self.items = objects(value) } }
      } else {
        model.call("ui:options") {
          if case .success(let value) = $0 { self.items = objects(dictionary(value)["commands"]) }
        }
      }
    } else if let last = model.draft.split(separator: " ").last, last.hasPrefix("@"),
      let cwd = model.cwd
    {
      model.call("files:search", ["cwd": cwd, "query": String(last.dropFirst())]) {
        if case .success(let value) = $0 { self.items = objects(value) }
      }
    } else {
      items = []
    }
  }
}
struct NativeModelPicker: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @ObservedObject var model: AppModel
  @StateObject private var suggestions = ComposerSuggestions()
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text(interfaceText("Models")).font(.headline)
        Spacer()
        if suggestions.loading { ProgressView().controlSize(.small) }
        Button {
          suggestions.models(model)
        } label: {
          Image(systemName: "arrow.clockwise")
        }
      }
      TextField(interfaceText("Search models or enter a model ID"), text: $suggestions.query)
        .textFieldStyle(.roundedBorder)
      ScrollView {
        VStack(alignment: .leading, spacing: 4) {
          ForEach(
            suggestions.items.filter {
              suggestions.query.isEmpty
                || string($0["id"]).localizedCaseInsensitiveContains(suggestions.query)
                || string($0["name"]).localizedCaseInsensitiveContains(suggestions.query)
            }, id: \.identifier
          ) { item in
            Button {
              model.changeModel(string(item["id"]))
            } label: {
              HStack {
                VStack(alignment: .leading, spacing: 3) {
                  Text(string(item["name"]).isEmpty ? string(item["id"]) : string(item["name"]))
                  Text(string(item["id"])).font(.caption).foregroundColor(Palette.muted)
                }
                Spacer()
                if model.modelID == string(item["id"]) {
                  Image(systemName: "checkmark").foregroundColor(Palette.coral)
                }
              }.padding(10)
            }.buttonStyle(.plain)
          }
        }
      }.frame(maxHeight: 280)
      if !suggestions.query.isEmpty {
        Button(interfaceText("Use model") + ": " + suggestions.query) {
          model.changeModel(suggestions.query)
        }
      }
      if !suggestions.error.isEmpty { Text(suggestions.error).font(.caption).foregroundColor(.red) }
    }.padding(16).frame(width: 380).background(Palette.panel).onAppear { suggestions.models(model) }
  }
}
