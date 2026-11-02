import AppKit
import SwiftUI

struct NativeMarkdown: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  let text: String
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ForEach(Array(text.components(separatedBy: "```").enumerated()), id: \.offset) {
        index, part in
        if index % 2 == 0 {
          MarkdownTextBlocks(text: part).lineSpacing(5).frame(
            maxWidth: .infinity, alignment: .leading)
        } else {
          let lines = part.split(separator: "\n", omittingEmptySubsequences: false)
          let language = String(lines.first ?? "")
          let code = lines.dropFirst().joined(separator: "\n")
          VStack(alignment: .leading, spacing: 0) {
            HStack {
              Text(language)
              Spacer()
              Button(interfaceText("Copy")) {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(code, forType: .string)
              }.buttonStyle(.plain)
            }.font(.system(size: scaled(10))).foregroundColor(Palette.muted).padding(10)
            ScrollView(.horizontal) {
              Text(code).font(.system(size: scaled(12), design: .monospaced)).textSelection(
                .enabled
              ).padding(12)
            }
          }.background(Palette.sidebar).cornerRadius(10)
        }
      }
    }
  }
}
struct NativeToolCard: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  let tool: Transcript.Tool
  var body: some View {
    DisclosureGroup {
      VStack(alignment: .leading, spacing: 10) {
        if let command = tool.input["command"] as? String {
          Text(command).font(.system(size: scaled(12), design: .monospaced)).foregroundColor(
            .white.opacity(0.9)
          ).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading).padding(12)
            .background(Color.black.opacity(0.85)).cornerRadius(8)
        } else if let old = tool.input["old_string"] as? String,
          let new = tool.input["new_string"] as? String
        {
          ScrollView(.horizontal) {
            VStack(alignment: .leading, spacing: 0) {
              ForEach(Array(old.components(separatedBy: "\n").enumerated()), id: \.offset) {
                _, line in
                Text("− " + line).foregroundColor(.red).frame(
                  maxWidth: .infinity, alignment: .leading
                ).padding(.horizontal, 8).background(Color.red.opacity(0.08))
              }
              ForEach(Array(new.components(separatedBy: "\n").enumerated()), id: \.offset) {
                _, line in
                Text("+ " + line).foregroundColor(.green).frame(
                  maxWidth: .infinity, alignment: .leading
                ).padding(.horizontal, 8).background(Color.green.opacity(0.08))
              }
            }.font(.system(size: scaled(11), design: .monospaced)).textSelection(.enabled)
          }
        } else {
          Text(jsonText(tool.input)).font(.system(size: scaled(11), design: .monospaced))
            .textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
        }
        ForEach(Array(tool.images.enumerated()), id: \.offset) { _, data in
          if let image = NSImage(data: data) {
            Image(nsImage: image).resizable().scaledToFit().frame(maxHeight: 300)
          }
        }
        if !tool.result.isEmpty {
          Divider()
          ScrollView {
            Text(tool.result).font(.system(size: scaled(11), design: .monospaced)).foregroundColor(
              tool.failed ? .red : Palette.secondary
            ).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
          }.frame(maxHeight: 250)
        }
      }.padding(.top, 10)
    } label: {
      HStack {
        Image(
          systemName: tool.name == "Bash"
            ? "terminal" : tool.name.contains("Edit") ? "pencil" : "wrench.and.screwdriver"
        ).foregroundColor(Palette.coral)
        Text(tool.name).fontWeight(.medium)
        Text(
          string(tool.input["file_path"]).isEmpty
            ? string(tool.input["command"]) : string(tool.input["file_path"])
        ).lineLimit(1).font(.system(size: scaled(10), design: .monospaced)).foregroundColor(
          Palette.muted)
        Spacer()
        Text(
          tool.failed
            ? interfaceText("Failed")
            : tool.result.isEmpty ? interfaceText("Tool call") : interfaceText("Completed")
        ).font(.caption).foregroundColor(Palette.muted)
      }
    }.padding(12).modifier(Outline())
  }
}

private struct MarkdownTextBlocks: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  let text: String
  private var groups: [[String]] {
    var result = [[String]]()
    var table = [String]()
    for line in text.components(separatedBy: "\n") {
      if line.trimmingCharacters(in: .whitespaces).hasPrefix("|") {
        table.append(line)
      } else {
        if !table.isEmpty {
          result.append(table)
          table = []
        }
        result.append([line])
      }
    }
    if !table.isEmpty { result.append(table) }
    return result
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      ForEach(Array(groups.enumerated()), id: \.offset) { _, lines in
        if lines.count > 1
          && lines.first?.trimmingCharacters(in: .whitespaces).hasPrefix("|") == true
        {
          ScrollView(.horizontal) {
            Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
              ForEach(
                Array(
                  lines.filter {
                    !$0.replacingOccurrences(of: "|", with: "").replacingOccurrences(
                      of: "-", with: ""
                    ).replacingOccurrences(of: ":", with: "").trimmingCharacters(in: .whitespaces)
                      .isEmpty
                  }.enumerated()), id: \.offset
              ) { row, line in
                GridRow {
                  ForEach(Array(line.split(separator: "|").enumerated()), id: \.offset) { _, cell in
                    Text(.init(cell.trimmingCharacters(in: .whitespaces))).fontWeight(
                      row == 0 ? .semibold : .regular
                    ).padding(9).frame(maxWidth: .infinity, alignment: .leading).background(
                      row == 0 ? Palette.sidebar : Palette.panel
                    ).border(Palette.border, width: 0.5)
                  }
                }
              }
            }
          }
        } else if let line = lines.first {
          let heading = line.prefix(while: { $0 == "#" }).count
          if (1...6).contains(heading) && line.dropFirst(heading).hasPrefix(" ") {
            Text(String(line.dropFirst(heading + 1))).font(
              .system(size: scaled(CGFloat(26 - heading * 2)), weight: .semibold, design: .serif)
            ).padding(.top, 8)
          } else if line.hasPrefix("> ") {
            HStack(alignment: .top, spacing: 10) {
              Rectangle().fill(Palette.border).frame(width: 3)
              Text(.init(String(line.dropFirst(2)))).foregroundColor(Palette.secondary)
            }.fixedSize(horizontal: false, vertical: true)
          } else if line.hasPrefix("- ") || line.hasPrefix("* ") {
            HStack(alignment: .top, spacing: 8) {
              Text("•").foregroundColor(Palette.coral)
              Text(.init(String(line.dropFirst(2))))
            }
          } else if line.isEmpty {
            Color.clear.frame(height: 5)
          } else {
            Text(.init(line)).frame(maxWidth: .infinity, alignment: .leading)
          }
        }
      }
    }.textSelection(.enabled)
  }
}

struct NativeMessageRow: View {
  @ObservedObject private var appearance = NativeAppearance.shared
  @ObservedObject var model: AppModel
  @ObservedObject var options: ViewOptions
  let entry: Transcript.Entry
  let onFork: (String, String) -> Void
  private var user: Bool { entry.role == "You" }
  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      if user {
        Spacer(minLength: 64)
      } else {
        ZStack {
          Circle().fill(Palette.coralSoft)
          ForEach(0..<12) { ray in
            Capsule().fill(Palette.coralStrong).frame(width: 1.5, height: 5).offset(y: -6)
              .rotationEffect(
                .degrees(Double(ray) * 30))
          }
        }.frame(width: 30, height: 30)
      }
      VStack(alignment: user ? .trailing : .leading, spacing: 8) {
        VStack(alignment: .leading, spacing: 10) {
          if !options.compact {
            ForEach(entry.thinking.keys.sorted(), id: \.self) { index in
              DisclosureGroup(interfaceText("Thinking")) {
                Text(entry.thinking[index] ?? "").font(.caption).foregroundColor(Palette.muted)
                  .textSelection(.enabled)
              }
            }
          }
          ForEach(Array(entry.attachments.enumerated()), id: \.offset) { _, attachment in
            if string(attachment["kind"]) == "image",
              let bytes = Data(base64Encoded: string(attachment["data"])),
              let image = NSImage(data: bytes)
            {
              Image(nsImage: image).resizable().scaledToFit().frame(maxHeight: 260)
            } else {
              Label(string(attachment["name"]), systemImage: "doc.text").font(.caption).padding(8)
                .modifier(Outline())
            }
          }
          if user {
            Text(entry.text).font(.system(size: scaled(14))).lineSpacing(5).textSelection(.enabled)
              .lineLimit(options.userOnly ? 3 : nil)
          } else {
            NativeMarkdown(text: entry.text).font(.system(size: scaled(14.2)))
          }
          if !options.compact { ForEach(entry.tools) { NativeToolCard(tool: $0) } }
        }.padding(user ? 15 : 0).background(user ? Palette.userBubble : .clear).cornerRadius(14)
        if !options.userOnly {
          HStack(spacing: 13) {
            Button {
              NSPasteboard.general.clearContents()
              NSPasteboard.general.setString(entry.text, forType: .string)
            } label: {
              Label(interfaceText("Copy"), systemImage: "doc.on.doc")
            }
            if user {
              Button {
                model.editMessage(entry)
              } label: {
                Label(interfaceText("Edit"), systemImage: "pencil")
              }.disabled(model.running)
              Button {
                options.selectedEntry = entry
                options.withdraw = true
              } label: {
                Label(interfaceText("Withdraw"), systemImage: "arrow.uturn.backward")
              }.disabled(model.running)
              Button {
                options.rewindID = entry.id
                options.rewind = true
              } label: {
                Label(interfaceText("Restore files"), systemImage: "arrow.counterclockwise")
              }.disabled(model.running)
            } else {
              Button {
                model.regenerate(entry)
              } label: {
                Label(interfaceText("Regenerate"), systemImage: "arrow.clockwise")
              }.disabled(model.running)
            }
            if entry.transcriptID != nil {
              Button {
                model.branch(entry, completion: onFork)
              } label: {
                Label(interfaceText("Branch"), systemImage: "arrow.triangle.branch")
              }.disabled(model.running)
            }
          }.buttonStyle(.plain).font(.system(size: scaled(10))).foregroundColor(Palette.muted)
        }
      }
    }.frame(maxWidth: .infinity, alignment: user ? .trailing : .leading)
  }
}
