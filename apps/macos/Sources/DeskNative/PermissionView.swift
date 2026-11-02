import SwiftUI

@MainActor private final class PermissionAnswers: ObservableObject {
  @Published var answers: [String: String] = [:]
  @Published var selections: [String: Set<String>] = [:]
}
struct NativePermissionView: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @ObservedObject var model: AppModel
  let request: [String: Any]
  @StateObject private var state = PermissionAnswers()
  private var complete: Bool {
    let questions = objects(dictionary(request["input"])["questions"])
    return !questions.isEmpty
      && questions.allSatisfy { question in
        let key = string(question["question"])
        return !(state.answers[key] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
          || !(state.selections[key] ?? []).isEmpty
      }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Image(
          systemName: request["kind"] as? String == "question"
            ? "questionmark.bubble" : "hand.raised"
        ).foregroundColor(Palette.coral)
        Text(
          interfaceText(
            request["kind"] as? String == "question"
              ? "Your input is needed"
              : request["kind"] as? String == "plan" ? "Plan is ready" : "Permission requested")
        ).fontWeight(.semibold)
        Spacer()
        Text(model.title).font(.caption).foregroundColor(Palette.muted)
      }
      if request["kind"] as? String == "question" {
        ForEach(objects(dictionary(request["input"])["questions"]), id: \.questionIdentifier) {
          question in
          let title = string(question["question"])
          VStack(alignment: .leading, spacing: 8) {
            Text(title).fontWeight(.medium)
            ForEach(objects(question["options"]), id: \.optionIdentifier) { option in
              let label = string(option["label"])
              Button {
                if question["multiSelect"] as? Bool == true {
                  var selected = state.selections[title] ?? []
                  if selected.contains(label) {
                    selected.remove(label)
                  } else {
                    selected.insert(label)
                  }
                  state.selections[title] = selected
                } else {
                  state.answers[title] = label
                }
              } label: {
                HStack(alignment: .top) {
                  Image(
                    systemName: (state.answers[title] == label
                      || state.selections[title]?.contains(label) == true)
                      ? "checkmark.circle.fill" : "circle"
                  ).foregroundColor(Palette.coral)
                  VStack(alignment: .leading) {
                    Text(label)
                    Text(string(option["description"])).font(.caption).foregroundColor(
                      Palette.muted)
                  }
                  Spacer()
                }.padding(8).modifier(Outline())
              }.buttonStyle(.plain)
            }
            TextField(
              interfaceText("Other answer…"),
              text: Binding(get: { state.answers[title] ?? "" }, set: { state.answers[title] = $0 })
            ).textFieldStyle(.roundedBorder)
          }
        }
        HStack {
          Button(interfaceText("Skip")) { model.respond("deny") }
          Spacer()
          Button(interfaceText("Send answer")) {
            var answers: [String: Any] = state.answers
            for (key, values) in state.selections where !values.isEmpty {
              var labels = Array(values).sorted()
              if let custom = state.answers[key],
                !custom.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
              {
                labels.append(custom)
              }
              answers[key] = labels
            }
            model.respond("allow", answers: answers)
          }.buttonStyle(.borderedProminent).tint(Palette.coral).disabled(!complete)
        }
      } else {
        if request["kind"] as? String == "plan" {
          DisclosureGroup(interfaceText("Review plan")) {
            ScrollView {
              Text(
                model.entries.reversed().filter { $0.role == "Assistant" }.map(\.text).filter {
                  !$0.isEmpty
                }.joined(separator: "\n\n")
              ).textSelection(.enabled)
            }.frame(maxHeight: 180)
          }
        } else {
          Text(
            string(request["displayName"]).isEmpty
              ? string(request["toolName"]) : string(request["displayName"])
          ).fontWeight(.medium)
          ScrollView {
            Text(jsonText(request["input"])).font(.system(size: scaled(11), design: .monospaced))
              .textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
          }.frame(maxHeight: 100)
        }
        if let description = request["description"] as? String {
          Text(description).font(.caption).foregroundColor(Palette.muted)
        }
        HStack {
          Button(interfaceText(request["kind"] as? String == "plan" ? "Keep planning" : "Deny")) {
            model.respond("deny")
          }
          Spacer()
          if request["allowAlways"] as? Bool == true {
            Button(interfaceText("Allow for this chat")) { model.respond("allow", always: true) }
          }
          Button(
            interfaceText(request["kind"] as? String == "plan" ? "Approve and run" : "Allow once")
          ) { model.respond("allow") }.buttonStyle(.borderedProminent).tint(Palette.coral)
        }
      }
    }.padding(15).modifier(Outline(radius: 14))
  }
}
extension Dictionary where Key == String, Value == Any {
  var questionIdentifier: String { string(self["question"]) }
  var optionIdentifier: String { string(self["label"]) }
}
