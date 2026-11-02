import AppKit
import SwiftUI

struct NativeTopBar: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @ObservedObject var model: AppModel
  @ObservedObject var options: ViewOptions
  let folder: String
  let files: () -> Void
  let usage: () -> Void
  private var todos: [[String: Any]] {
    for entry in model.entries.reversed() {
      if let tool = entry.tools.last(where: { $0.name == "TodoWrite" }) {
        return objects(tool.input["todos"])
      }
    }
    return []
  }
  private var statsText: String {
    var parts = [String]()
    let summary = model.usageSummary
    let input = summary["inputTokens"] as? Double ?? model.statistics["inputTokens"] as? Double ?? 0
    let output =
      summary["outputTokens"] as? Double ?? model.statistics["outputTokens"] as? Double ?? 0
    if input + output > 0 { parts.append("↑\(tokens(input)) ↓\(tokens(output))") }
    let cost = summary["costUsd"] as? Double ?? model.statistics["costUsd"] as? Double ?? 0
    if cost > 0 { parts.append(String(format: cost < 0.01 ? "$%.4f" : "$%.2f", cost)) }
    if let percent = model.context["percentage"] as? Double {
      parts.append("\(Int(percent.rounded()))%")
    }
    if let ms = model.statistics["durationMs"] as? Double {
      parts.append("\(Int((ms / 1000).rounded()))s")
    }
    return parts.joined(separator: "   ·   ")
  }
  var body: some View {
    HStack(spacing: 12) {
      Text(model.title).font(.system(size: scaled(15), weight: .semibold, design: .serif))
        .lineLimit(1)
      Text("·").foregroundColor(Palette.muted)
      Text(folder).foregroundColor(Palette.muted).lineLimit(1)
      Spacer()
      Button(action: files) { Image(systemName: "sidebar.right") }.buttonStyle(.plain).help(
        interfaceText("Files"))
      if !statsText.isEmpty {
        Button(action: usage) { Text(statsText) }.buttonStyle(.plain).font(
          .system(size: scaled(11))
        ).foregroundColor(Palette.muted)
      }
      if !model.tasks.isEmpty || !todos.isEmpty {
        Button {
          options.tasks.toggle()
        } label: {
          Label(
            interfaceText("Tasks")
              + " \(todos.isEmpty ? model.tasks.count : todos.filter { string($0["status"]) == "completed" }.count)/\(todos.isEmpty ? model.tasks.count : todos.count)",
            systemImage: "checklist")
        }.buttonStyle(.plain).font(.system(size: scaled(11)))
          .popover(isPresented: $options.tasks) { taskPanel }
      }
      if model.running {
        HStack(spacing: 5) {
          Circle().fill(Palette.coral).frame(width: 5, height: 5)
          Text(interfaceText("Working"))
        }.font(.system(size: scaled(10))).foregroundColor(Palette.coral).padding(.horizontal, 9)
          .padding(.vertical, 5).background(Palette.coral.opacity(0.1)).cornerRadius(12)
      }
    }.padding(.horizontal, 24).frame(height: 56).background(.bar).overlay(alignment: .bottom) {
      Rectangle().fill(Palette.border).frame(height: 1)
    }
  }
  private var taskPanel: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        if !todos.isEmpty { Text(interfaceText("Task list")).font(.headline) }
        ForEach(Array(todos.enumerated()), id: \.offset) { _, todo in
          HStack(alignment: .top) {
            Image(
              systemName: string(todo["status"]) == "completed" ? "checkmark.circle.fill" : "circle"
            ).foregroundColor(string(todo["status"]) == "completed" ? .green : Palette.coral)
            VStack(alignment: .leading, spacing: 4) {
              Text(string(todo["content"]))
              Text(
                interfaceText(
                  string(todo["status"]) == "completed"
                    ? "Completed"
                    : string(todo["status"]) == "in_progress" ? "In progress" : "Pending")
              ).font(.caption).foregroundColor(Palette.muted)
            }
          }
        }
        if !model.tasks.isEmpty {
          Divider()
          Text(interfaceText("Background / subagents")).font(.headline)
        }
        ForEach(Array(model.tasks.enumerated()), id: \.offset) { _, task in
          HStack(alignment: .top) {
            Circle().fill(string(task["status"]) == "completed" ? .green : Palette.coral).frame(
              width: 6, height: 6
            ).padding(.top, 5)
            VStack(alignment: .leading, spacing: 4) {
              Text(
                string(task["description"]).isEmpty
                  ? string(task["task_id"]) : string(task["description"]))
              Text(
                string(task["status"]).isEmpty ? string(task["subtype"]) : string(task["status"])
              ).font(.caption).foregroundColor(Palette.muted)
              if let summary = task["summary"] as? String {
                Text(summary).font(.caption).foregroundColor(Palette.muted)
              }
            }
            if let path = task["output_file"] as? String {
              Button(interfaceText("Logs")) { NSWorkspace.shared.open(URL(fileURLWithPath: path)) }
            }
          }.padding(.leading, depth(task) * 14)
        }
      }.padding(18)
    }.frame(width: 400).frame(maxHeight: 450).background(Palette.panel)
  }
  private func depth(_ task: [String: Any]) -> CGFloat {
    var id = string(task["parent_task_id"])
    var visited = Set<String>()
    var level = 0
    while !id.isEmpty && !visited.contains(id) && level < 8 {
      visited.insert(id)
      level += 1
      id =
        model.tasks.first(where: { string($0["task_id"]) == id }).map {
          string($0["parent_task_id"])
        } ?? ""
    }
    return CGFloat(level)
  }
  private func tokens(_ value: Double) -> String {
    value < 1000
      ? String(Int(value))
      : value < 1_000_000
        ? String(format: "%.1fk", value / 1000) : String(format: "%.1fM", value / 1_000_000)
  }
}
