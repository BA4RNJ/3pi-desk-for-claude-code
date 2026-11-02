import Foundation

let root = URL(fileURLWithPath: CommandLine.arguments[1])
guard let chinese = Bundle(path: root.appendingPathComponent("zh-hans.lproj").path),
  let english = Bundle(path: root.appendingPathComponent("en.lproj").path)
else { fatalError("Localization bundles are missing") }
precondition(chinese.localizedString(forKey: "General", value: nil, table: nil) == "常规")
precondition(english.localizedString(forKey: "General", value: nil, table: nil) == "General")
print("Localization bundle checks passed")
