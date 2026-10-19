# Data handling and permissions

Aurora uses credentials supplied by each Windows user. It does not distribute a project-owned provider key.

## Local storage

The app stores chats, projects, selected folders, preferences and encrypted keys in its Electron userData directory. Packaged Windows builds normally use `%APPDATA%\Heartflow Aurora`. Chats, tool outputs and paths in `aurora.json` are plain text. API keys are encrypted through Electron safeStorage using Windows DPAPI for the current account. This does not protect data against malicious processes running as that same user.

Listening starts off on launch. Microphone audio is held in memory and is not saved as a recording by the app. Development tests can produce fixture audio, screenshots and logs under `test-output/`; these are excluded from the source repository.

## What goes to providers

| Service | Data sent when used |
| --- | --- |
| Selected cloud model (OpenAI, Anthropic, OpenRouter or Ollama Cloud) | Submitted prompts, conversation context and tool results, including files read by tools, search metadata and observed application labels. |
| Local Ollama | The same model context is sent to the configured loopback server on this PC. Cloud voice and web search still use their own services. |
| GitHub updates | Installed copies request public release metadata shortly after startup and download release files when requested. GitHub receives normal network request metadata. Aurora sends no chats or provider keys for update checks. |
| Ollama web search | The requested search query. |
| ElevenLabs or Fish Audio cloud recognition | Captured speech for wake detection, requests, answers and controls. Local silence filtering does not make this a local-only wake-word engine. |
| Selected speech provider | Text selected for spoken replies and the configured voice identifier; Fish can also receive delivery cues. |
| Windows recognition | Recognition remains local when the Windows fallback is selected. Request transcripts still go to the model when submitted. |
| People and token intel | Tracked wallet addresses, labels, notes and launch history stay in the local wallet store. Scanning uses the Solana RPC, optional Helius and Jupiter keys, and public token/holder services. KOL roles are user-supplied, not inferred from social identity. |
| Pump.fun discovery | Token and pool queries go to GeckoTerminal and DexScreener. A PumpPortal WebSocket receives new-launch and migration events. Token metadata and images are fetched from the creator's metadata URI and IPFS gateways, so those hosts receive the request. When Gigi auto scan runs, visible token metrics are sent to your selected model provider. |
| PumpPortal live trades | The connected wallet public key, token mint, amount, slippage and priority fee are sent to PumpPortal to build a transaction. Signing happens in your wallet. |
| xStocks | Asset, quote, market-status and reserve queries go to api.xstocks.fi. Token logos load from xstocks-metadata.backed.fi. |
| Yahoo Finance | The underlying stock ticker and range are sent to Yahoo Finance when an underlying stock chart or quote metadata is requested. |

Provider access, billing and retention rules are governed by the service you select. Cloud voice uses API credits. No independent provider-retention guarantee is made by this project.

## Actions and boundaries

Optional MCP server settings and local executable arguments are stored in the profile. Bearer tokens use Windows credential encryption; command arguments are plain text and must not contain credentials. Connecting a local server starts its executable with your Windows permissions and is not a sandbox. Aurora does not automatically install or connect servers. An approved MCP call sends the displayed arguments to that server; returned text becomes conversation context sent to the selected model. Disconnecting closes the client and its managed local server process. Built-in plugin switches control Aurora's tool inventory, not an operating-system security boundary.

Direct workspace file tools validate paths and reject junction escapes. File writes and every PowerShell command require approval. PowerShell itself is not sandboxed and can operate beyond the workspace with your account’s permissions. There is no general undo or automatic rollback.

Computer control targets a supported application allowlist and current observed controls. It checks foreground identity and user pointer movement; it cannot reliably control elevated windows or interfaces that expose no useful controls. Model mistakes and untrusted page content remain risks. Model instructions for confirmation of purchases, messages, deletion and account changes are not an operating-system sandbox.

Filename search is bounded to configured folders and does not automatically scan every drive. Revealing a result selects it in Explorer; the highlight is shown only when a visible row is verified. Screenshot-based unrestricted desktop vision is not implemented.

## Sharing the project or reporting a problem

Do not publish your Aurora data folder, API keys, real conversations, recordings, personal screenshots, private workspace paths, `.env` files, credential-bearing URLs or private signing keys. An encrypted credential is still private data and should not be included in a public repository.

For a public issue, provide a minimal reproduction and a redacted error. Share the app version and the Windows/browser versions, rather than uploading your entire profile. If a credential has been exposed, revoke it at its provider; deleting its latest visible copy does not remove copies in Git history or cached downloads.

The repository is a source project. It does not need personal settings to build or run, and each tester should enter their own credentials through the app.
