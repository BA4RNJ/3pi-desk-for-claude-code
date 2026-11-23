import AppKit
import SwiftUI

struct NativeComposerInput: NSViewRepresentable {
  @ObservedObject private var appearance = NativeAppearance.shared
  @Binding var text: String
  @Binding var height: CGFloat
  let submit: () -> Void
  let files: ([String]) -> Void
  let image: (Data) -> Void
  var navigateMenu: ((Int) -> Bool)? = nil
  var acceptMenu: (() -> Bool)? = nil
  var dismissMenu: (() -> Bool)? = nil
  func makeCoordinator() -> Coordinator { Coordinator(self) }
  func makeNSView(context: Context) -> NSScrollView {
    let scroll = NSScrollView()
    scroll.drawsBackground = false
    scroll.hasVerticalScroller = true
    scroll.autohidesScrollers = true
    let editor = ComposerTextView()
    editor.isRichText = false
    editor.drawsBackground = false
    editor.isVerticallyResizable = true
    editor.isHorizontallyResizable = false
    editor.autoresizingMask = [.width]
    editor.textContainer?.widthTracksTextView = true
    editor.textContainerInset = NSSize(width: 0, height: 2)
    editor.isAutomaticQuoteSubstitutionEnabled = false
    editor.isAutomaticDashSubstitutionEnabled = false
    editor.delegate = context.coordinator
    editor.setAccessibilityLabel(interfaceText("Message…"))
    editor.submit = submit
    editor.files = files
    editor.image = image
    editor.navigateMenu = navigateMenu
    editor.acceptMenu = acceptMenu
    editor.dismissMenu = dismissMenu
    scroll.documentView = editor
    return scroll
  }
  func updateNSView(_ scroll: NSScrollView, context: Context) {
    guard let editor = scroll.documentView as? ComposerTextView else { return }
    context.coordinator.parent = self
    editor.setAccessibilityLabel(interfaceText("Message…"))
    editor.isEditable = context.environment.isEnabled
    editor.isSelectable = context.environment.isEnabled
    if editor.string != text {
      editor.string = text
      editor.setSelectedRange(NSRange(location: (text as NSString).length, length: 0))
    }
    editor.font = NSFont.systemFont(ofSize: scaled(14))
    editor.textColor = NSColor.labelColor
    editor.submit = submit
    editor.files = files
    editor.image = image
    editor.navigateMenu = navigateMenu
    editor.acceptMenu = acceptMenu
    editor.dismissMenu = dismissMenu
    let coordinator = context.coordinator
    DispatchQueue.main.async { coordinator.measure(editor, in: scroll) }
  }
  final class Coordinator: NSObject, NSTextViewDelegate {
    var parent: NativeComposerInput
    init(_ parent: NativeComposerInput) { self.parent = parent }
    func measure(_ editor: NSTextView, in scroll: NSScrollView) {
      guard scroll.contentSize.width > 40, let container = editor.textContainer,
        let layout = editor.layoutManager
      else { return }
      container.containerSize = NSSize(
        width: scroll.contentSize.width, height: CGFloat.greatestFiniteMagnitude)
      layout.ensureLayout(for: container)
      let measured = min(
        220,
        max(26, ceil(layout.usedRect(for: container).height + editor.textContainerInset.height * 2))
      )
      if abs(parent.height - measured) > 0.5 { parent.height = measured }
    }
    func textDidChange(_ notification: Notification) {
      if let editor = notification.object as? NSTextView { parent.text = editor.string }
    }
  }
}
private final class ComposerTextView: NSTextView {
  var submit: (() -> Void)?
  var files: (([String]) -> Void)?
  var image: ((Data) -> Void)?
  var navigateMenu: ((Int) -> Bool)?
  var acceptMenu: (() -> Bool)?
  var dismissMenu: (() -> Bool)?
  override func keyDown(with event: NSEvent) {
    guard isEditable else { return }
    if !hasMarkedText() {
      if event.keyCode == 125, navigateMenu?(1) == true { return }
      if event.keyCode == 126, navigateMenu?(-1) == true { return }
      if event.keyCode == 48, acceptMenu?() == true { return }
      if event.keyCode == 53, dismissMenu?() == true { return }
      if (event.keyCode == 36 || event.keyCode == 76) && !event.modifierFlags.contains(.shift) {
        if acceptMenu?() == true { return }
        submit?()
        return
      }
    }
    super.keyDown(with: event)
  }
  override func paste(_ sender: Any?) {
    let pasteboard = NSPasteboard.general
    if let urls = pasteboard.readObjects(
      forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL], !urls.isEmpty
    {
      files?(urls.map(\.path))
      return
    }
    if let data = pasteboard.data(forType: .png) {
      image?(data)
      return
    }
    if let tiff = pasteboard.data(forType: .tiff), let bitmap = NSBitmapImageRep(data: tiff),
      let data = bitmap.representation(using: .png, properties: [:])
    {
      image?(data)
      return
    }
    super.paste(sender)
  }
}
