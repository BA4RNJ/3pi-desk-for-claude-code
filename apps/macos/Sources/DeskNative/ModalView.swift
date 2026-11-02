import AppKit
import SwiftUI

private struct DeskModal<Modal: View>: ViewModifier {
  @Binding var presented: Bool
  let modal: () -> Modal
  func body(content: Content) -> some View {
    content.disabled(presented).allowsHitTesting(!presented).accessibilityHidden(presented).overlay
    {
      if presented {
        ZStack {
          Color(red: 36.0 / 255, green: 31.0 / 255, blue: 24.0 / 255).opacity(0.45)
          modal().clipShape(RoundedRectangle(cornerRadius: 20)).padding(24).shadow(
            color: .black.opacity(0.16), radius: 30
          ).onAppear { NSApp.keyWindow?.makeFirstResponder(nil) }.onExitCommand {
            presented = false
          }
        }
      }
    }
  }
}
extension View {
  func deskModal<Modal: View>(
    isPresented: Binding<Bool>, @ViewBuilder content: @escaping () -> Modal
  ) -> some View { modifier(DeskModal(presented: isPresented, modal: content)) }
  func deskConfirm(
    isPresented: Binding<Bool>, title: String, message: String, confirm: String,
    action: @escaping () -> Void
  ) -> some View {
    deskModal(isPresented: isPresented) {
      VStack(alignment: .leading, spacing: 18) {
        HStack {
          Text(interfaceText(title)).font(
            .system(size: scaled(22), weight: .semibold, design: .serif))
          Spacer()
          Button {
            isPresented.wrappedValue = false
          } label: {
            Image(systemName: "xmark")
          }.buttonStyle(.plain)
        }
        Text(interfaceText(message)).foregroundColor(Palette.secondary).fixedSize(
          horizontal: false, vertical: true)
        HStack {
          Spacer()
          Button(interfaceText("Cancel")) { isPresented.wrappedValue = false }.keyboardShortcut(
            .cancelAction)
          Button(interfaceText(confirm)) {
            isPresented.wrappedValue = false
            action()
          }.buttonStyle(.borderedProminent).tint(.red)
        }
      }.padding(26).frame(width: 450).background(Palette.panel)
    }
  }
}
