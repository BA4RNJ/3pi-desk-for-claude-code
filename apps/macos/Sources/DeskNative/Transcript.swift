import Foundation

/// Preserves API message identity across partial and complete assistant frames.
struct Transcript {
  struct Tool: Identifiable {
    let id: String
    var name: String
    var input: [String: Any]
    var result: String = ""
    var failed = false
    var images: [Data] = []
  }
  struct Entry: Identifiable {
    let id: String
    let role: String
    var blocks: [Int: String] = [:]
    var thinking: [Int: String] = [:]
    var tools: [Tool] = []
    var transcriptID: String?
    var attachments: [[String: Any]] = []
    var text: String { blocks.keys.sorted().compactMap { blocks[$0] }.joined(separator: "\n") }
  }
  private(set) var entries: [Entry] = []
  private var streamingID: String?
  mutating func truncate(before index: Int) {
    entries = Array(entries.prefix(index))
    streamingID = nil
  }
  mutating func load(_ messages: [[String: Any]]) {
    self = Transcript()
    for entry in messages {
      if entry["type"] as? String == "assistant" {
        apply(entry)
      } else if entry["type"] as? String == "user", let body = entry["message"] as? [String: Any] {
        if let text = body["content"] as? String {
          appendUser(text, id: entry["uuid"] as? String ?? UUID().uuidString)
        } else if let blocks = body["content"] as? [[String: Any]] {
          let text = blocks.compactMap { $0["text"] as? String }.joined(separator: "\n")
          let attachments: [[String: Any]] = blocks.compactMap { block in
            guard let type = block["type"] as? String, ["image", "document"].contains(type),
              let source = block["source"] as? [String: Any], let data = source["data"] as? String
            else { return nil }
            return [
              "kind": type, "name": type.capitalized, "data": data,
              "mediaType": source["media_type"] as? String ?? "",
            ]
          }
          if !text.isEmpty || !attachments.isEmpty {
            appendUser(
              text, id: entry["uuid"] as? String ?? UUID().uuidString, attachments: attachments)
          }
          apply(entry)
        }
      }
    }
  }

  mutating func appendUser(
    _ text: String, id: String = UUID().uuidString, attachments: [[String: Any]] = []
  ) {
    entries.append(
      Entry(id: id, role: "You", blocks: [0: text], transcriptID: id, attachments: attachments))
  }
  mutating func apply(_ message: [String: Any]) {
    if message["type"] as? String == "user", let body = message["message"] as? [String: Any],
      let blocks = body["content"] as? [[String: Any]]
    {
      for block in blocks where block["type"] as? String == "tool_result" {
        guard let id = block["tool_use_id"] as? String else { continue }
        for row in entries.indices {
          if let index = entries[row].tools.firstIndex(where: { $0.id == id }) {
            let value = block["content"]
            entries[row].tools[index].result =
              value as? String ?? (value as? [[String: Any]])?.compactMap { $0["text"] as? String }
              .joined(separator: "\n") ?? ""
            entries[row].tools[index].failed = block["is_error"] as? Bool ?? false
            if let content = value as? [[String: Any]] {
              entries[row].tools[index].images = content.compactMap { item in
                guard item["type"] as? String == "image",
                  let source = item["source"] as? [String: Any],
                  let encoded = source["data"] as? String
                else { return nil }
                return Data(base64Encoded: encoded)
              }
            }
          }
        }
      }
    }
    if message["type"] as? String == "stream_event", let event = message["event"] as? [String: Any]
    {
      switch event["type"] as? String {
      case "message_start":
        if let body = event["message"] as? [String: Any], let id = body["id"] as? String {
          streamingID = id
          ensure(id)
        }
      case "content_block_start":
        if let id = streamingID, let index = event["index"] as? Int,
          let block = event["content_block"] as? [String: Any], block["type"] as? String == "text"
        {
          let row = ensure(id)
          entries[row].blocks[index] = block["text"] as? String ?? ""
        }
      case "content_block_delta":
        if let id = streamingID, let index = event["index"] as? Int,
          let delta = event["delta"] as? [String: Any], delta["type"] as? String == "text_delta",
          let text = delta["text"] as? String
        {
          let row = ensure(id)
          entries[row].blocks[index, default: ""] += text
        } else if let id = streamingID, let index = event["index"] as? Int,
          let delta = event["delta"] as? [String: Any], let thinking = delta["thinking"] as? String
        {
          let row = ensure(id)
          entries[row].thinking[index, default: ""] += thinking
        }
      case "message_stop": streamingID = nil
      default: break
      }
    }
    if message["type"] as? String == "assistant", let body = message["message"] as? [String: Any],
      let id = body["id"] as? String, let content = body["content"] as? [[String: Any]]
    {
      let row = ensure(id)
      entries[row].transcriptID = message["uuid"] as? String ?? entries[row].transcriptID
      for (index, block) in content.enumerated() {
        if block["type"] as? String == "thinking", let text = block["thinking"] as? String {
          entries[row].thinking[index] = text
        }
        if block["type"] as? String == "tool_use", let toolID = block["id"] as? String {
          if let existing = entries[row].tools.firstIndex(where: { $0.id == toolID }) {
            entries[row].tools[existing].input = block["input"] as? [String: Any] ?? [:]
          } else {
            entries[row].tools.append(
              Tool(
                id: toolID, name: block["name"] as? String ?? "Tool",
                input: block["input"] as? [String: Any] ?? [:]))
          }
        }
      }
      // Full text frames replace their text blocks, never append a duplicate message.
      for (index, block) in content.enumerated() where block["type"] as? String == "text" {
        entries[row].blocks[index] = block["text"] as? String ?? ""
      }
    }
  }
  @discardableResult private mutating func ensure(_ id: String) -> Int {
    if let index = entries.firstIndex(where: { $0.id == id }) { return index }
    entries.append(Entry(id: id, role: "Assistant"))
    return entries.count - 1
  }
}
