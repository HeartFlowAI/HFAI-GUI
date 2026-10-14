# Trading workspace (Gigi's Solana surface)

Status of the Solana trading surface implemented inside Heartflow Aurora. This
mirrors the product plan in `HeartFlowAI/trading-workspace` (snapshot from
`HeartFlowAI/plans`). The harness ships the surface now; the separate workspace
repository remains the long-term home. Facts and limits are separated on
purpose, per the plan.

## What works

- **Market foundation (C04).** Token search (DexScreener), price, liquidity,
  24h volume and market cap, a safety read (mint/freeze authority), and a
  price-history chart built from Aurora's own price samples.
- **Portfolio (C08).** Read-only multi-address holdings with allocation and 24h
  change, a per-wallet breakdown, and paper funds kept separate from real ones.
  Cost basis is disclosed as unavailable rather than estimated silently.
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
- Profit and loss and cost basis are unavailable or estimated, and labeled so.
- Charts are line series from local samples; candlesticks need an OHLCV provider.
- Safety covers mint and freeze authority only. Liquidity locks, holder
  clustering and developer history are not implemented.
- Live trades are mainnet and move real funds. Aggregate limits are enforced for
  paper; live entries should use per-trade approval (`each` mode).
- The vault stores keys but does not yet sign transactions; live execution signs
  through the connected external wallet.

## Setup

- **Settings → Wallet:** add one or more Solana addresses, or connect a wallet
  through WalletConnect (add a Reown project ID). Paper is the default; switch to
  Live for real swaps.
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

- `npm run check` (syntax) and `node --test test/*.test.js`: 170 tests, 0 fail,
  1 skipped. Paper accounting, conditional orders, strategy rules and limits,
  live-swap quoting/simulation/confirmation, the pause/exit state machine, and
  vault key generation are unit-tested with fixtures.
- Live signing was not exercised end-to-end here; it needs a connected wallet
  and real funds.
