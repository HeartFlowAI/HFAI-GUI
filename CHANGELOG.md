# Changelog

## 0.4.5 - Sidebar actions (2026-10-11)

- Added three-dot menus and right-click actions directly to session and workspace rows.
- Session menus provide rename, pin, duplicate, archive and delete actions.
- Workspace deletion moves its sessions to Default workspace and preserves folders and files.
- Replaced the crowded hover action strip with a compact menu.
- Consolidated the sidebar into one expandable workspace tree and removed duplicate session lists and nested scrolling.

## 0.4.4 — Navigation, Settings and model picker

- Moved Normal/Aurora Code and model selection into the composer, matching DeepSeek Harness’s work-start flow.
- Added a searchable model picker grouped by provider, with current-model state, model discovery and a direct path to Settings → Models.
- Simplified the sidebar order and changed collapse into a compact icon rail; Settings remains pinned at the bottom.
- Tightened the Settings workspace to a focused, bounded panel with section navigation and internal scrolling.
- Fixed a stale renderer reference that prevented the initial workspace session list from rendering.

## 0.4.3 — DeepSeek-inspired workspace shell (unreleased)

- Reworked the composition around a structured workspace sidebar rather than adding more controls to the previous shell.
- Added first-class Plugins and Automation navigation, workspace actions, and clearer session hierarchy.
- Aurora’s companion is collapsed by default so the conversation canvas gets priority; the companion remains available from the header.
- Kept Heartflow’s dark plum, lavender and pink palette while tightening spacing, contrast and panel boundaries.

## 0.4.2 — Workspace-first navigation (unreleased)

- Reorganized the sidebar around Workspaces, Plugins and Automation.
- Added compact workspace actions and a DeepSeek-inspired workspace/session hierarchy.
- Added session rename, pin and archive actions on hover or keyboard focus, while retaining direct delete.
- Added session duplication from the row actions, preserving the conversation while creating a new session.
- Preserved Aurora’s Normal and Aurora Code modes, companion panel, voice controls and existing project data.

## 0.4.1 — Session navigation actions (unreleased)

- Session rows reveal a delete button on hover or keyboard focus in the current project, search results and expanded project groups.
- Delete any listed session without opening it first. Confirmation identifies the selected session; cancelling preserves it and the current conversation.
- Softer sidebar selection and hover surfaces, compact trash icons, and reserved action space keep titles stable while navigating.

## 0.4.0 — Settings and extensions workspace (unreleased)

- Section-based Settings with persistent navigation between Overview, Connections, Voice, Appearance, Plugins & MCP, and Updates. Open with Ctrl+,.
- Provider connection cards distinguish saved credentials, local setup and the active provider without claiming a connection has been tested.
- Expand project groups to browse their sessions without switching the current conversation. Search remains available across all modes and projects.
- Files and Activity tabs beneath Aurora in the side panel. Browse folders and preview UTF-8 text files up to 200 KB inside the selected workspace.
- Built-in tool group switches for files, web research, desktop control and PowerShell. Disabled tools are excluded from requests and rejected if called.
- Optional MCP tools using the official SDK: local executable/stdio or remote Streamable HTTP, encrypted bearer tokens, connection status and discovered tool lists. Connections start disconnected and close with Aurora.
- Every MCP tool call requires approval with the server, endpoint and arguments visible. Results are text-only, bounded and treated as untrusted data.
- Existing companion, voice notch, appearance choices, modes, projects and update controls remain integrated. This is an original implementation inspired by DeepSeek Harness, not compatibility with its plugin runtime.

## 0.3.0 — Workspace UI refresh (unreleased)

- Refreshed navigation, chat, project organization, activity cards and Settings while retaining Aurora's companion, voice notch, modes, appearances and existing tools.
- Compact conversation header, restrained Heartflow accents, wider reading area and a new welcome layout.
- Hide or show either side panel; preferences persist in the current local profile. Collapse projects to give sessions more room.
- Session counts beside projects, Ctrl+K session search, Ctrl+B navigation toggle, and direct model/appearance shortcuts.
- Readable activity names and separate working, done and needs-attention states. Raw tool arguments and results remain available in expandable cards.
- Compact Settings overview and responsive layouts checked down to the supported 950 × 680 window size.
- Original implementation informed by DeepSeek Harness's navigation/conversation/right-panel structure. No upstream code, branding or plugin runtime was imported.

## 0.2.4 — Pointing and animation corrections

- Dedicated sideways pointing artwork for Cyber, Dark and Cozy, replacing the upward-reaching fallback. All outfits align their fingertips to the desktop file-presentation anchor and mirror for left-facing targets.
- Regenerated community activity sheets with complete boots and hands; render-time pose isolation removes neighbouring fragments and stray pixels while retaining substantial props.
- Safe crop margins protect poses that cross an approximate atlas grid boundary. Consistent scale and foot baselines reduce jumps between activity frames.
- Skip the malformed three-arm celebration pose in the original atlas and use its clean alternate.
- Added canvas auditing for every activity frame and both pointing directions, plus multi-DPI alignment and fragment-removal checks.

## 0.2.3 — A calmer workspace

- Removed Mint from the appearance picker. Previously saved Mint selections fall back to Classic.
- Grouped connection, voice, appearance and update settings into one Settings menu; kept listening directly available in the sidebar.
- Moved workspace selection into the session toolbar and session deletion into its options menu.
- Moved the available-update download button beside Settings, freeing the chat header.
- Reduced sidebar clutter, shortened workspace labels with full paths on hover, and made the six appearance cards fit in a compact grid.

## 0.2.2 — Community appearances

- Added Cyber, Dark and Cozy community appearances, with “Created by Jaymie” beneath each name.
- Each outfit has its own transparent pixel-art pose sheet for idle, thinking, waiting, coding, browsing, movement, celebrating and errors. Teleport effects use the selected outfit; pointing uses its reaching pose.
- Selected outfits follow Aurora between the main app, voice notch and desktop companion.

## 0.2.1 — Shutdown and single-instance fix

- Closing the main window shuts down the full app, including hidden action displays, pet/notch windows, speech, native helpers and timers.
- Wait for an interrupted task and queued local saves before exiting. A bounded shutdown fallback prevents a stuck helper from holding the instance indefinitely.
- A second launch restores the existing window. Launches during startup are queued; launches during shutdown request a fresh process after the old one exits.
- Prevent late pointer/overlay callbacks from recreating activity after disposal.
- Verified with real Electron single-instance locks and three repeated close/reopen cycles in an isolated profile, including auxiliary windows and an interrupted model request. No live microphone, cloud requests or physical computer input were used.

## 0.2.0 — Local release preparation

- Separate saved connections for OpenAI, Claude / Anthropic, OpenRouter, Ollama Cloud and local Ollama. Streaming replies and tool results use provider-specific adapters while sharing Aurora's tools and approval flow.
- Preserve legacy Ollama credentials and chats; encrypt each cloud provider key for the Windows account. Local model requests use a loopback server without an API key.
- Web search keeps a separate Ollama Cloud connection. Voice remains independently configured.
- Classic, Moonlight, Sunrise and Mint colour palettes apply to the app, notch and desktop companion, reusing the full animation set.
- Per-user Windows installer and explicit download/restart controls. Installed copies quietly check GitHub Releases shortly after startup; development and portable copies use manual updates.
- Versioned release workflow, fixed build output and guarded cleanup of redundant legacy builds. Packaging never publishes automatically.
- Resolve the previously reported dependency audit issue with a non-forced dependency refresh.

Provider streams and updates are verified with fixtures. Live provider account access and a published installed-version upgrade need separate validation. No GitHub release is implied by this changelog entry.

## 0.1.0 — Prototype baseline

- Windows chat and code modes, projects and session search.
- Optional wake-word voice conversations, minimized notch and desktop companion.
- File search, Explorer presentation, approved workspace writes and PowerShell.
- Supported browser and application interaction through observed controls.
