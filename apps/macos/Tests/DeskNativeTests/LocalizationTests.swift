import XCTest

@testable import DeskNative

final class LocalizationTests: XCTestCase {
  @MainActor func testEnglishLocalizationExists() {
    XCTAssertNotEqual(localized("chat.send"), "chat.send")
  }
}
