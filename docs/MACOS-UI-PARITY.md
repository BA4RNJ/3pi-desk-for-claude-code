# Native frontend parity inventory

The reference is the checked-in Electron source and `docs/screenshots/`, not a redesigned UI.
The native application uses SwiftUI/AppKit and the same icon, color tokens, source translation
dictionary and backend business services. **Full visual and behavioral parity is not yet certified.**

| Electron reference | Native implementation | Current boundary |
| --- | --- | --- |
| App, Sidebar, TabBar, TopBar | WorkspaceView, NavigationStore | Core layout, workspace card, tabs, search, menus, usage and tasks; detailed task nesting differs |
| ChatView, MessageView | NativeChatView, Transcript, NativeMarkdown | Text streaming, history, compact/user filters, thinking and tools; exact Markdown/table/diff rendering still differs |
| Composer, ComposerControls | NativeChatView composer | Multiline input, picker attachments, model/effort/permission controls; slash and file autocomplete, drag/paste parity incomplete |
| PermissionBar, QuestionBar | NativePermissionView | Inline tool/plan/questions and session-scoped allow; real SDK interaction not GUI-tested |
| SettingsDialog General | NativeSettingsView | Theme, language, font scale, accent, preference controls; native tray/global-shortcut lifecycle not implemented |
| SettingsDialog API | NativeSettingsView | Provider cards, profile management, auth, model/test/save/custom-model UI; live provider operations not tested |
| SettingsDialog Permissions | NativeSettingsView | Directory/tool restrictions and three rule editors, shared settings API |
| ExtensionsPanel MCP/Hooks | NativeExtensionsView | Scope/config editors and save; live per-session MCP enable/disable UI incomplete |
| ExtensionsPanel Plugins | NativeExtensionsView | Installed/catalog lists, marketplace actions, cancellable runner; install/update/uninstall not exercised |
| ExtensionsPanel Skills/Agents | NativeExtensionsView | Scope, new/edit/delete editor dialogs; editor opening checked, no real extension mutated |
| BackgroundPanel | NativeSettingsView | Prompt/trust/start/list/log/stop/remove UI; no real background session started |
| UsagePanel, AboutPanel | NativeSettingsView | Usage/context/model and version/update controls; cumulative pricing table differs |
| WorkspaceManager | NativeWorkspaces | Recents/open/add/remove/backup folder; per-workspace count/latest-activity presentation incomplete |
| FilePanel, FilePreviewDialog | NativeFilePanel, NativeFilePreview | Shared file APIs, tree, text editor/image/binary preview; GUI fixture verification pending |
| RenameDialog, TagDialog, ConfirmDialog | NavigationStore dialogs/alerts | Rename/tag/fork/pin/export/delete entry points; confirmations use native layouts |
| Edit/Withdraw | AppModel.editMessage | Fork-and-preserve flow, original hidden rather than deleted; full interaction not tested |
| RewindDialog | NativeRewindView | Preview/apply recorded checkpoint; only real SDK can validate restored files |
| Legacy PermissionDialog/QuestionDialog | Intentionally unused | Agent prompts remain inline per AGENTS.md |

## Validation boundaries

Release builds and Node/TypeScript/Swift checks do not prove pixel parity or real SDK operation.
Track actual GUI checks separately from implementation. Use temporary workspaces for tool actions,
a disposable HOME/CLAUDE_CONFIG_DIR and DESK_NATIVE_DATA_DIR for adapter tests, and never delete
existing user chats. Generated binaries, previews, archives, caches and IDE state remain ignored.
