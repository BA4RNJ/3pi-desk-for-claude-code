// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "DeskNative",
  defaultLocalization: "en",
  platforms: [.macOS(.v13)],
  products: [.executable(name: "DeskNative", targets: ["DeskNative"])],
  targets: [
    .executableTarget(name: "DeskNative", resources: [.process("Resources")]),
    .testTarget(name: "DeskNativeTests", dependencies: ["DeskNative"]),
  ]
)
