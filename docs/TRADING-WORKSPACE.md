# Trading workspace (Gigi's Solana surface)

Status of the Solana trading surface implemented inside Heartflow Aurora. This
mirrors the product plan in `HeartFlowAI/trading-workspace` (snapshot from
`HeartFlowAI/plans`). The harness ships the surface now; the separate workspace
repository remains the long-term home. Facts and limits are separated on
purpose, per the plan.

## What works

- **Remote images.** xStocks logos are loaded from `xstocks-metadata.backed.fi`
  when the xStocks surface is open. This reveals your IP to that host.
- **Data keys (optional).** Helius unlocks parsed transaction descriptions;
  Jupiter raises the price API limit. Both keys are encrypted at rest. Pump.fun
  discovery uses public GeckoTerminal endpoints; live PumpPortal local trades do
  not need an API key.
- **Parsed activity (optional).** A Helius key unlocks transaction descriptions
  and token transfers for followed-wallet scans. Cost basis and PnL are still
  unavailable, so scans never claim them.
- **People.** Dev, KOL, influencer, trader and smart-wallet profiles with
  read-only scans, holding summaries, observed launch history and a shared-
  holding wallet graph.
- **Research graph.** Token holder clusters connect the dev, tracked holders and
  shared holdings without claiming funding or team ownership.
- **Research.** Token intel with dev rap sheet, tracked holders, KOL
  convergence, top-holder labels and saved deep reports.
- **Pump.fun Pulse.** Up to 50 cards per stage, with instant PumpPortal launch
  inserts, live bonding-curve progress and a 30-second stats refresh. A dense card grid with token images, social links,
  sparklines, market stats, bond progress, quick paper buy, Gigi verdicts, a
  full-width Gigi scan action and a Cards/Table toggle. Fresh launches come from
  the PumpPortal stream and are enriched from their metadata URI.
- **Gigi auto scan and auto paper.** Optional periodic scanning of the current
  Pump.fun stage with strict JSON verdicts, plus paper-only autotrade bounded by
  budget, max buys, cooldown, cash and limits. Settings persist and scanning
  resumes when the Pump.fun surface opens. Live auto trading is disabled.
- **Underlying stock history.** xStocks Trade has Stock and On-chain chart modes.
  Stock candles come from Yahoo Finance with range-aware intervals and caching.
  The panel adds previous close, 52-week high and low, and day range.
- **xStocks desk.** A platform mode for tokenized US equities and ETFs. Featured,
  All and ETFs tabs, search and market-status filters, on-chain prices, underlying
  quotes, premium or discount, dividend multipliers, market hours, halts and
  proof of reserves. Assets without a DEX market are marked and cannot open
  Trade. Live orders use the Jupiter path and require a one-time securities
  acknowledgment.
- **Pump.fun desk.** A header platform switch opens a Pump.fun dashboard with
  New, Trending and Graduated stages, live counts, filtering, scan actions and
  bonding progress. New tokens open on 1D and carry their feed row into Trade so
  the pump panel appears before external indexing catches up.
- **PumpPortal live path.** Bonding-curve and PumpSwap trades are built by the
  PumpPortal Local Transaction API, simulated, signed through WalletConnect and
  recorded with venue, pool and fees. Live bonding buys are gated by an explicit
  toggle; sells stay available for exits. The venue charges 0.5%.
- **Market foundation (C04).** Token search (DexScreener), price, liquidity,
  24h volume and market cap, a safety read (mint/freeze authority), and a
  price-history chart built from Aurora's own price samples.
- **Portfolio (C08).** Read-only multi-address holdings with allocation and 24h
  change, a per-wallet breakdown, and paper funds kept separate from real ones.
  Cost basis is disclosed as unavailable rather than estimated silently.
- **Theme audit.** Wallets and Connections were checked in all four themes with
  no layout breaks; stat labels use the muted token for readable contrast.
- **Token metadata.** Long-tail holdings resolve symbols and names from
  DexScreener for the visible top holdings, with a short-lived cache.
- **Scan jobs.** Scan all runs in the background, reports per-wallet progress and
errors, and keeps a live count and progress bar in Wallets.
- **Wallet notifications.** Activity and mirror notifications carry the wallet,
  signature and Solscan link. Watch opens the transaction; native notification
  clicks focus Aurora and select the followed wallet.
- **Auto-mirror to paper.** After the first baseline scan, new followed-wallet
  activity mirrors buys within a per-event budget, max buys, paper cash, daily
  cap and position cap. Sells are mirrored only when parsed Helius transfers
  identify the direction; holdings-only mode never invents sells.
- **Copy to paper.** Mirror a followed wallet's top priced holdings into the
  paper account with a named budget, proportional or equal weighting, and a top
  token cap. Stablecoins are skipped; the simulated fee is reserved from the
  budget. This is a snapshot copy, not an ongoing mirror.
- **Wallets to follow.** Read-only followed wallets with cached scans of holdings,
  concentration, recent activity and tokens, plus a saved Gigi brief and an Ask
  action. Activity alerts notify when a followed wallet produces a new
  signature. Compare shows tokens shared across wallets. Following never grants
  access to keys or funds.
- **Research (C09/C10).** Deep-research jobs run visibly and can be cancelled;
  reports are saved as revisions per token and ground Gigi's answers.
- **Paper trading (C05/C06).** Manual buy and sell with explicit fee and
  slippage assumptions; limit, stop-loss and take-profit conditions that fill on
  a price cross; pause/resume; every order recorded in the Journal.
- **Strategies (C11-C15).** Typed conditions (price, 24h change, windowed change)
  with AND/OR logic, sizing, cooldown, take-profit/stop-loss exits and aggregate
  limits (max position, max total, daily cap). Active strategies execute in the
  paper account. Gigi can clarify intent and build them; rules are data, not
  code, so nothing arbitrary runs. Cadence comes from Automations.
- **Live (C18/C19).** Preview a real Jupiter swap (quote plus simulation, nothing
  signed), then execute behind a confirmation that shows the decoded amounts,
  minimum out and price impact. Swaps sign through WalletConnect (Aurora never
  holds the signing key), are recorded with signature and status, and are
  reconciled. Live strategies raise intents through the same policy path.
- **Pause/exit (C20).** RUNNING, PAUSED_FLAT and PAUSED_WITH_EXPOSURE, with an
  interrupted exit reconciling on the next launch and asking for confirmation.
- **Vault (C17, partial).** Generate a dedicated ed25519 Solana wallet per bot,
  or import an existing key. Secrets are encrypted with the OS keystore and never
  reach models, build code, logs or the renderer.

## Coverage and limits

- Public Solana RPC, the Jupiter APIs and DexScreener are rate-limited and are
  not an execution-grade feed. A paid RPC tier is expected before live use.
- Token accounts are read from both the classic and Token-2022 programs, but
  metadata and symbol resolution for long-tail tokens remain limited.
- Profit and loss and cost basis are unavailable or estimated, and labeled so.
- Candles use Binance for majors and GeckoTerminal pool OHLCV for long-tail and
  pump.fun tokens (bonding curve and migrated pools). Local samples remain the
  last-resort line series.
- Safety covers mint and freeze authority only. Liquidity locks, holder
  clustering and developer history are not implemented.
- Live trades are mainnet and move real funds. Aggregate limits are enforced for
  paper; live entries should use per-trade approval (`each` mode).
- The vault stores keys but does not yet sign transactions; live execution signs
  through the connected external wallet.

## Setup

- **Settings → Connections:** model, web search, voice and market-data keys in
  one place, with status badges and test buttons.
- **Settings → Wallet:** add one or more Solana addresses, or connect a wallet
  through WalletConnect (add a Reown project ID). Paper is the default; switch to
  Live for real swaps. A custom RPC is set in Connections or Wallet.
- **Strategy limits** (max position, max total, daily cap) live in the same
  screen.
- Providers need outbound network access. The public RPC is the default until a
  private endpoint is added.

## Recovery

- Vault secrets are encrypted with the OS keystore. Export/restore is not built
  yet; until then, keep an independent backup of any funded bot wallet.
- Conversations, research, strategies and executions are stored locally in
  `aurora.json`. Nothing is sent to a server except the model, RPC and data
  providers you configure.

## Unresolved defects and gaps

- Vault signing, export and restore are not implemented (C17 remainder).
- macOS signing and notarization are not configured; builds are unsigned (C21).
- Login and local profiles are not implemented; the harness is a single profile
  (C07).
- Prompt-injection resistance has not been independently audited; treat web,
  filenames and screen labels as untrusted.
- Cost basis, historical PnL and candlestick history depend on paid providers.

## Verification

- `npm run check` (syntax) and `node --test test/*.test.js`: 263 pass, 1 skipped,
  1 skipped. Paper accounting, conditional orders, strategy rules and limits,
  live-swap quoting/simulation/confirmation, the pause/exit state machine, and
  vault key generation are unit-tested with fixtures.
- Live signing was not exercised end-to-end here; it needs a connected wallet
  and real funds.
