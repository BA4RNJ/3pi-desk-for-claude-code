import SwiftUI

struct NativeRewindView: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @StateObject private var store: PageStore
  let id: String
  let close: () -> Void
  init(model: AppModel, id: String, close: @escaping () -> Void) {
    _store = StateObject(wrappedValue: PageStore(model: model))
    self.id = id
    self.close = close
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack {
        Image(systemName: "arrow.uturn.backward").foregroundColor(Palette.coral)
        Text(interfaceText("Restore files to this message")).font(.title2)
        Spacer()
        Button(action: close) { Image(systemName: "xmark") }
      }
      Text(interfaceText("Restore recorded file edits made after this message.")).foregroundColor(
        Palette.secondary)
      if store.busy { ProgressView(interfaceText("Checking file checkpoints…")) }
      Text(store.message).foregroundColor(.red)
      if !store.snapshot.isEmpty {
        Text(
          "\((store.snapshot["filesChanged"] as? [String] ?? []).count) "
            + interfaceText("files to restore")
        ).font(.headline)
        Text(
          "+\(store.snapshot["insertions"] as? Int ?? 0) / −\(store.snapshot["deletions"] as? Int ?? 0)"
        ).foregroundColor(Palette.muted)
        ScrollView {
          VStack(alignment: .leading) {
            ForEach(store.snapshot["filesChanged"] as? [String] ?? [], id: \.self) {
              Text($0).font(.system(.caption, design: .monospaced)).textSelection(.enabled)
            }
          }
        }.frame(maxHeight: 220)
      }
      Text(
        interfaceText(
          "Only recorded file edits are restored. Bash, git, installations and other external side effects are not undone."
        )
      ).font(.caption).foregroundColor(Palette.muted)
      HStack {
        Spacer()
        Button(interfaceText("Cancel"), action: close)
        Button(interfaceText("Restore files")) {
          store.run("rewind", ["id": id, "dryRun": false]) { value in
            let result = dictionary(value)
            if result["canRewind"] as? Bool == true {
              close()
            } else {
              store.message = string(result["error"])
            }
          }
        }.buttonStyle(.borderedProminent).tint(Palette.coral).disabled(
          store.snapshot["canRewind"] as? Bool != true || store.busy)
      }
    }.padding(26).frame(width: 650).background(Palette.background)
      .onAppear {
        store.run("rewind", ["id": id, "dryRun": true]) {
          store.snapshot = dictionary($0)
          store.message = string(store.snapshot["error"])
        }
      }
  }
}
