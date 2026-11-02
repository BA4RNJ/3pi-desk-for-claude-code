import Foundation

@main struct TranscriptCheck {
  static func main() {
    var transcript = Transcript()
    transcript.appendUser("hello")
    transcript.apply([
      "type": "stream_event", "event": ["type": "message_start", "message": ["id": "one"]],
    ])
    for text in ["Hel", "lo"] {
      transcript.apply([
        "type": "stream_event",
        "event": [
          "type": "content_block_delta", "index": 0, "delta": ["type": "text_delta", "text": text],
        ],
      ])
    }
    precondition(transcript.entries.last?.text == "Hello")
    transcript.apply([
      "type": "assistant",
      "message": ["id": "one", "content": [["type": "text", "text": "Hello"]]],
    ])
    transcript.apply([
      "type": "assistant",
      "message": ["id": "one", "content": [["type": "tool_use", "id": "tool"]]],
    ])
    precondition(transcript.entries.count == 2, "full frames must not duplicate streaming rows")
    precondition(transcript.entries.last?.text == "Hello", "tool-only frames must preserve text")
    transcript.apply([
      "type": "assistant",
      "message": ["id": "two", "content": [["type": "text", "text": "Next"]]],
    ])
    precondition(transcript.entries.count == 3)
    transcript.apply([
      "type": "assistant", "uuid": "frame-uuid",
      "message": [
        "id": "tool-frame",
        "content": [
          ["type": "thinking", "thinking": "Reasoning"],
          [
            "type": "tool_use", "id": "read-1", "name": "Read",
            "input": ["file_path": "/tmp/fixture"],
          ],
        ],
      ],
    ])
    transcript.apply([
      "type": "user",
      "message": [
        "content": [["type": "tool_result", "tool_use_id": "read-1", "content": "fixture result"]]
      ],
    ])
    precondition(transcript.entries.last?.thinking[0] == "Reasoning")
    precondition(transcript.entries.last?.tools.first?.result == "fixture result")
    precondition(transcript.entries.last?.transcriptID == "frame-uuid")
    print("Transcript checks passed")
  }
}
