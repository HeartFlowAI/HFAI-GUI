# Gigi desk: state, gaps, and work to make every function actually work

## 0. Orientation

- Repo `~/Projects/hfai_harness_app`, branch `main`, `v0.6.0`. Tests: `npm run check` + `node --test test/*.test.js` (183 tests, 182 pass, 1 skipped).
- The desk is `src/workspace.js` (mounts inside `<main>`), styled by `src/workspace.css` + the `src/ui.css` design system. All wallet logic is in `src/wallet/*`. IPC lives in `src/main.js`, exposed by `src/preload.js`.
- Sections are dispatched in `src/workspace.js`: `wallets, portfolio, trade, discover, watch, research, strategies, journal`.
- Settings wallet dialog (`src/index.html:27`, driven by `src/wallet-ui.js`) holds addresses, RPC, WalletConnect project ID + connect, display/execution mode, strategy limits, and the bot vault.

Bottom line: the read/analysis side (portfolio, charts, holders, markets) is now real and working. The **action side** of the desk (live trade buttons, alerts, signal/strategy authoring in the UI, in-vault signing) is where "each function actually works" is not yet true.

---

## 1. What is genuinely still broken or half-wired (prioritized)

### P0. Portfolio performance chart does not equal the portfolio total
- `portfolioHistory` only aggregates up to 8 holdings, markets-first, and only those with price history (`src/wallet/index.js`, around lines 248 to 272). So the chart's last point can be far below `state.total` (a wallet whose value sits in long-tail tokens with no Binance/CoinGecko listing charts almost nothing).
- Fix options: include every priced holding that has history (cap only for cost), or label the chart "priced holdings only", or show both numbers. Right now it silently misleads.

### P0. Price alerts are orphaned
- Backend exists: `state.alerts`, `onAlert` emits `wallet-alert` (`src/main.js:691`), `walletAlertAdd`/`walletAlertRemove` exist in `src/preload.js:21-22`. But there is **no UI anywhere** to create or view alerts (grep of `workspace.js`, `wallet-ui.js`, `renderer.js` finds none). Alerts can only be created by the agent via tools, and are invisible in the desk.
- Fix: an Alerts panel in the desk (Strategies tab next to Signals) with add/remove, and an alert action on the Trade screen.

### P0. Trade has no live buy/sell, and Watch gives no feedback
- Trade is paper-only (`src/workspace.js:168-185`). Live swaps exist only through strategies/live intents and `wallet-swap-preview`/`wallet-swap-execute` in Settings. There is no live buy in the desk's Trade screen even in Live mode.
- The **Watch** button (`src/workspace.js:170`) calls `walletWatchlistAdd` but never toasts, and does not refresh state, so it looks like nothing happened.

### P1. Range granularity is coarse and can mismatch the live price
- For every range except `1D`, history uses the Binance `1d` series (`src/wallet/index.js` around line 215 and in `ensureSeries`). So `7D` on SOL shows 7 points. `1D` correctly uses `1h`. There is no per-range interval (e.g., `7D` = `1h`, `30D` = `4h`, `3M` = `1d`, `1Y/ALL` = `1d`/`1w`).
- The chart "Last" comes from history, while the Trade header price comes from DexScreener (`pair.priceUsd`). They can disagree by up to a day on daily candles. Append the live price as the final point to reconcile.

### P1. Long-tail tokens show "No price history yet." with no explanation
- `drawChart` shows a bare message when `points.length < 2` (`src/workspace.js:56`). CoinGecko is the only fallback for non-Binance tokens and it is throttled/429-prone (`src/wallet/index.js`, `schedule`), so a user watching a small token sees an empty chart and no reason or retry.

### P1. Signals and strategies are agent-only to author
- Signals can be created only via the `signal_create` tool; the desk only lists them (`src/workspace.js:227`). Strategies likewise are listed but not authored in the UI. For "each function works", add forms (name, mint, condition metric/op/value, action notify vs paper-buy, cooldown, research gate).

### P1. WalletConnect and the vault are unverified end to end
- `src/wallet/connect.js:18` requires a Reown project ID. The connect button in Settings copies the URI and waits, but the full handshake, session persistence (`wcSession`, `wcStorage`) and `signTransaction`/`signMessage` round trip have not been validated live.
- `src/wallet/vault.js` handles keygen/import/publicFromSecret, and `src/wallet/tx-sign.js` signs single-signer Jupiter/PumpPortal transactions. Select a bot as the live signing wallet in Settings, Wallet. Multi-signer transactions still use WalletConnect.

### P2. Candle charts absent
- Charts are close-line/area only (`drawChart`). Binance klines already return OHLC; rendering candles is a small extension and a big perceived-quality jump.

### P2. Discover "Popular Solana pairs" is a search, not trending
- `src/workspace.js:188` and the `loadTrending` helper call `walletSearch('SOL')`, which is a DexScreener text search. It is stable but not real trending. DexScreener token-boosts or GeckoTerminal trending are better (GeckoTerminal now needs a key; token-boosts is free).

### P2. Dead code and small inconsistencies
- Unused now: `historyTried` (`src/wallet/index.js:111`), `seedHistory` + `historyQueue` (lines 193-202), and `RANGE_DAYS` no longer used internally (only exported). `drawChart` has a `height` param but CSS forces `.ws-chart svg` to 280px (`src/workspace.css:83`), so the 200px portfolio chart is also 280px.

### P2. Theme parity not audited
- Several styles use `rgba(255,255,255,...)` overlays (e.g., `src/workspace.css` hover chips) which assume a dark surface. Confirm the desk, canvas tiles, thesis cards and holders render correctly on all four themes (Heartflow, Midnight, Ember, Mint), especially if any is light.

### P2. Missing tests
- No test for `providers.binanceHistory`; no test for `portfolioHistory` slicing across ranges beyond the one happy path; no test that a signal with `action: 'paper-buy'` actually places a paper order through `onSignal`; no test for alert firing; no DOM smoke test for desk sections (there is `test/workspace-browser.test.js`, but that is the embedded browser, not the desk).

---

## 2. Missing updates so each function actually works (by section)

### Wallets
- Followed wallets are stored separately from own addresses (`src/wallet/follow.js`, `normalizeConfig` in `src/wallet/index.js`).
- Follow, scan (`fetchPortfolio` + Jupiter prices + `fetchHistory`), read a cached profile, save notes, ask Gigi, and open a token from a wallet holding.
- The Brief button runs a saved research job with `kind: 'wallet'`; token research remains `kind: 'token'`.
- The old Canvas tab is gone. `show_view` now opens a read-only overlay (`#ws-viewer`) instead of switching sections.

### Portfolio
- Reconcile chart vs total (P0 above). Add a total line or a caption "chart covers priced holdings (n of m)".
- Per-wallet breakdown using `holding.address` (already present) when multiple addresses are watched.
- Add realized/unrealized PnL for paper positions and a paper equity curve (samples already recorded every 60s).
- Add "Add address" and "Connect wallet" shortcuts inside the desk, not only in Settings.

### Trade
- Add a **Live** path: when execution mode is Live and a WalletConnect session exists, show Buy/Sell that call `walletSwapPreview` then `walletSwapExecute` with the approval dialog; keep paper as default.
- Toast on Watch success/failure and reflect the new watchlist immediately.
- Add a **Set alert** action (uses `walletAlertAdd`).
- Reconcile chart last point with live price; add candles; add a DexScreener deep link using `window.aurora` external-open if available (otherwise render the URL).
- Surface `safety.flags` (not just "revoked") and RugCheck risk list.

### Discover
- Switch to real trending (DexScreener token-boosts) with the search as fallback. Add filters (min liquidity, min volume) and a "Watch"/"Trade" quick action per card (Trade exists; Watch exists, add feedback).

### Research
- The job pipeline exists; add a visible report viewer (there is `walletResearchReport`), a diff between revisions, and a "use as signal gate" shortcut.
- Show why a signal's `freshResearch` gate is closed (no report, or older than `researchMaxAgeMin`).

### Strategies, Signals, Alerts
- Authoring forms in the desk (see P1). Add enable/disable, run-now (`walletStrategyRun`), and a clear "why didn't it run" panel using `lastDetail`/`lastError`.
- Make the alerts list a first-class panel with create/remove.

### Journal
- Add filters (paper vs live, token), CSV export, and per-order drill-down including `thesisId`/`strategyId` links back to their source.

### Wallet (Settings)
- Validate WalletConnect end to end; persist and restore sessions; implement `signTransaction`/`signMessage` handlers in `wallet/index.js` using the WC client.
- Implement in-vault signing (C17): `src/wallet/vault.js` needs a `signTransaction(secret, tx)` and a hardened key-use path, then wire it into `swap.execute` as an alternative signer.
- Guard rails: confirm each live action, respect `limits` (max position/total/daily) in the desk, and show remaining daily cap.

---

## 3. Optimisations (make it fast and robust)

Data and network
- Persist ranged history to disk with a TTL: `1D` refetch after ~10 min, `1d` series after ~6 to 12 h, `ALL` after ~24 h. First open of any desk would then be instant across restarts.
- Per-range Binance interval map (`1D` = `15m`/`1h`, `7D` = `1h`, `30D` = `4h`, `3M` = `1d`, `6M`/`1Y`/`ALL` = `1d`/`1w`). One request per range bucket, cached.
- Auto-map unknown symbols to `${symbol}USDT` on Binance with a one-time validation, so more tokens get reliable history without CoinGecko.
- Cache negative CoinGecko results for a short TTL so unlisted tokens do not hammer the queue on every draw.
- Keep the global CoinGecko limiter, but make it a proper token bucket with jittered backoff and a hard per-minute cap, and surface a "sources busy, retrying" state to the UI.
- Cache `walletTokenInfo` and `walletHolders` with short TTLs; both are re-fetched on every `draw()`.

Rendering and state
- Append the live Jupiter/DexScreener price as the last series point so charts end "now".
- Dedupe in-flight `walletPortfolioSeries` calls and debounce redraws triggered by `wallet` events (markets update every 60s).
- Virtualize the holdings table (it can be thousands of rows for spam wallets before the price filter).
- Batch `onUpdate` emits; today every `ensureSeries` completion emits a full wallet event.

Cleanup and correctness
- Remove dead code (`historyTried`, `seedHistory`, `historyQueue`, unused `RANGE_DAYS`), make `drawChart` height real or drop the param.
- Currency: `config.currency` exists and is validated but every number is USD. Either implement conversion or remove the setting.
- Add `aria` to charts (role img with `aria-label` summarizing range and change) and to holders bars.

Testing
- Add `test/markets` cases for `binanceHistory` parsing, `portfolioHistory` across ranges and missing-major fallbacks, signal `paper-buy` end to end via a manager with `onSignal`, and alert firing.
- Add a lightweight DOM smoke test for `workspace.js` sections (jsdom + a stubbed `window.aurora`) asserting each tab renders without throwing and shows an empty state or data.

---

## 4. Data sources, limits, and constraints to keep in mind

- Prices: Jupiter `lite-api.jup.ag/price/v3` (batched 50 ids) plus DexScreener for pair metrics and live token price.
- xStocks: public API at `https://api.xstocks.fi/api/v2`, no key. The catalog is 1,460 Solana tokenized equities and ETFs across 15 pages, with 18 featured majors, underlying quotes, market hours, halts, dividend multipliers and proof of reserves. On-chain prices come from DexScreener and charts from GeckoTerminal. Underlying stock history is not included.
- Underlying stock history: Yahoo Finance chart endpoint, keyless, with 1D, 7D, 30D, 3M, 6M, 1Y and ALL ranges, 500 ms request spacing and range-based caches. This is separate from the on-chain xStock chart.
- History: Binance `api.binance.com/api/v3/klines` first (no key, generous, majors only), GeckoTerminal pool OHLCV as the long-tail and pump.fun fallback (bonding curve and migrated pools, throttled and cached), then CoinGecko `coins/solana/contract/{mint}/market_chart` (heavily rate limited, throttled + retried, cached, sliced locally). Pump.fun discovery uses GeckoTerminal new/trending pools plus batch token metadata; PumpPortal Local Transaction API handles live bonding-curve trades with no API key (0.5% fee).
- Holders: RugCheck `api.rugcheck.xyz/v1/tokens/{mint}/report` (count, concentration, risks). Public Solana RPCs are now 403/429 for `getTokenLargestAccounts`, so RugCheck is primary; the RPC path is a last resort.
- WalletConnect requires a Reown project ID (`src/wallet/connect.js:18`); live signing is via the external wallet only.
- Charts are close-line/area; no candles. Shorts/hedges on Solana spot do not exist, so thesis short/hedge legs are notes. Voice/notch remain Windows-only.

---

## 5. Acceptance criteria ("each function actually works")

- Portfolio: performance chart drawn for `30D` and `1Y` on a wallet holding SOL/BONK; the last chart value is within a small tolerance of `state.total`, or the UI explicitly states which holdings are covered.
- Trade: for a Binance-listed token, all five metrics render, the chart draws for `1D`, `7D`, `30D`, and `1Y`, Watch shows a toast and appears in the watchlist, Holders renders count + concentration + risks, and in Live mode Buy/Sell run preview, approval and execute.
- Alerts: create an alert in the desk, price crosses, a toast fires once, it shows in the alerts list and can be removed.
- Signals: create a signal in the desk, it fires as configured (notify or paper buy), respects cooldown and the research gate, and toggling/removing works.
- Strategies: create, enable, run now, and observe executed/blocked reason.
- Wallet: WalletConnect connect persists across restart; a live swap signs and confirms; limits block an over-cap trade.
- No console exceptions across all seven tabs on all four themes.

---

## 6. Prompt for the next chat

```
Work in ~/Projects/hfai_harness_app (Electron app, branch main, at tag v0.6.0).
Read this before touching code: src/workspace.js is Gigi's desk (sections dispatch line ~78),
src/wallet/* is all wallet logic (index.js manager, providers.js data sources, markets.js feed,
solana.js, swap.js, connect.js, vault.js, paper.js, strategy.js, session.js),
src/main.js has IPC + agent tools context, src/preload.js exposes window.aurora.wallet*.
Styling: src/ui.css design system, src/workspace.css desk, src/themes.css, src/wallet.css.

House rules: no em/en dashes in prose, no AI filler, keep the existing code style, add tests
for new logic, and run `npm run check` and `node --test test/*.test.js` before finishing.
To run the app: npm start. To drive it: ./node_modules/.bin/electron . --remote-debugging-port=9333
then hit http://127.0.0.1:9333/json. macOS: no `timeout`, no `rg`.

Goal: make every desk function actually work, in this order.
1. Portfolio perf chart must match the portfolio total, or clearly say which holdings are covered
   (src/wallet/index.js portfolioHistory only uses up to 8 markets-first holdings).
2. Add price-alert UI in the desk (backend already exists: walletAlertAdd/Remove, onAlert emits
   'wallet-alert') with create/remove and an alert action on Trade; toast on fire.
3. Trade: add live Buy/Sell when execution mode is Live and a WalletConnect session exists
   (wallet-swap-preview + wallet-swap-execute with the approval dialog, respecting data.wallet.limits),
   toast on Watch success, add a Set-alert action, reconcile chart last point with the live price.
4. Per-range Binance interval mapping (1D=1h/15m, 7D=1h, 30D=4h, 3M/6M/1Y/ALL=1d/1w) and persist
   ranged history to disk with a TTL so restarts are instant. Auto-map unknown symbols to
   SYMBOLUSDT on Binance with one-time validation before falling back to CoinGecko.
5. Authoring forms in the desk for signals and strategies (name, mint, metric/op/value, action
   notify|paper-buy, cooldown, research gate), plus enable/disable and run-now.
6. Candles option for charts (Binance already returns OHLC), and an explicit "source busy, retry"
   state instead of a bare "No price history yet."
7. Cleanup: remove dead code (historyTried, seedHistory, historyQueue, unused RANGE_DAYS), fix the
   ignored drawChart height, add aria labels to charts and holders bars, and audit all four themes.
8. Tests: binanceHistory parsing, portfolioHistory across ranges and missing-major fallbacks,
   signal paper-buy via onSignal, alert firing, and a jsdom smoke test of the seven desk sections.

Constraints to respect: CoinGecko free tier rate-limits hard (throttle, retry, cache, slice locally);
Binance klines is the primary history source; RugCheck is the holders source; public Solana RPCs are
unreliable; WalletConnect needs a Reown project ID; local vault signing supports single-signer transactions only.

When done, report what renders and what still does not, with file:line references, and do not commit
unless asked.
```

---

## 7. Progress log

### 2026-10-16 (first pass on the plan above)

Landed (all tests green: `npm run check`, 185 pass, 1 skipped):

- **Portfolio coverage (P0, item 1).** `portfolioHistory` now delegates to a new
  `portfolioSeries(range)` (`src/wallet/index.js:256`) that considers every priced
  holding, prefetches the top 20 by value (`PORTFOLIO_SERIES_CAP`), and returns
  `{ points, covered, considered, holdings, total, range }`. The IPC handler
  (`src/main.js:926`) returns that object and the desk renders a caption when the
  chart covers fewer holdings than the wallet holds (`src/workspace.js:131`).
- **Per-range Binance intervals (P1, item 4).** `RANGE_INTERVAL` (`src/wallet/index.js:16`)
  maps `1D`→15m/96, `7D`→1h/168, `30D`→4h/180, `3M`/`6M`/`1Y`→1d, `ALL`→1w. `ensureSeries`
  is range-keyed and an in-memory TTL (`SERIES_TTL`) drops stale series so a range is
  refetched at most once per TTL instead of on every draw.
- **Dead-code cleanup (P2, item 7).** Removed `historyTried`, `seedHistory`, `historyQueue`.
- **Price alerts UI (P0, item 2).** A reusable `alertForm`/`alertsBody` in the desk; a
  `Price alert` panel on Trade and a `Price alerts` panel in Strategies, plus a
  `wallet-alert` toast (`src/workspace.js`). Backend was already wired.
- **Trade (P0/P1, item 3).** Watch now toasts and refreshes; live `Live buy`/`Live sell all`
  appear when execution is live and a WalletConnect session exists, running preview → a
  confirmation showing minimum out and price impact → execute, and respecting
  `maxPositionUsd`. Alert form added in the same right column.
- **Signals authoring (P1, item 5).** A `New signal` form in Strategies creates signals via
  `walletSignalSave` (name, metric, operator, value, action, USD, cooldown, research gate).
- **Charts (P2, item 7).** `drawChart` respects its `height` argument via inline style and
  sets a descriptive `aria-label`; the bare empty state names the sources to try.
- **Tests (item 8, partial).** Added: `binanceHistory` parsing (`test/markets.test.js`),
  `portfolioSeries` coverage + per-range interval (`test/wallet.test.js`), and a paper-buy
  signal firing `onSignal` with the rule and quote (`test/wallet.test.js`).

Still open (from the plan): disk-persisted history with TTL (only in-memory TTL is done),
CoinGecko negative caching, auto `SYMBOLUSDT` symbol mapping, candle charts, real DexScreener
trending, wallet-alert list refresh on fire, journal filters/CSV, holdings virtualization,
batched `onUpdate`, in-vault signing (C17), full WalletConnect handshake validation, jsdom
section smoke tests, and the four-theme audit.

### 2026-10-16 (second pass: candles, trending, journal)

Landed (tests: 186 pass, 1 skipped):

- **Candles.** `providers.binanceHistory` now returns OHLC (`{t,o,h,l,c,p}`, `src/wallet/providers.js:71`);
  the desk draws candles via `candlesSvg` (`src/workspace.js:60`) behind a `Candles` toggle on the
  Trade chart, persisted in `localStorage` under `aurora-desk`. Line/area remains the fallback when a
  series has no OHLC.
- **Real trending.** `providers.trending` reads DexScreener token boosts (Solana only) and enriches each
  with its best pair (`src/wallet/providers.js:88`), exposed as `wallet-trending` (`src/main.js:904`,
  `src/preload.js:18`). Discover now shows "Trending on Solana" with a `walletSearch('SOL')` fallback.
- **Journal.** Rewritten with a token filter, an all/paper/live selector, and an Export CSV button
  (`src/workspace.js:drawJournal`). CSV downloads client-side via a Blob.

Still open: disk-persisted history TTL, CoinGecko negative caching, auto `SYMBOLUSDT` mapping,
wallet-alert list refresh on fire, holdings virtualization, batched `onUpdate`, in-vault signing
(C17), full WalletConnect handshake validation, jsdom section smoke tests, and the four-theme audit.

### 2026-10-16 (third pass: persistence, alias mapping, theme tokens)

Landed (tests: 189 pass, 1 skipped):

- **Disk-persisted history.** Ranged series are stored in `config.historyCache` and sanitized on load
  (`sanitizeHistoryCache`, `src/wallet/index.js`), so a restart opens with charts already drawn. The
  manager reloads them at construction and persists on every successful fetch via `onHistory`
  (`src/main.js:691`).
- **Auto `SYMBOLUSDT` mapping.** `binanceSeriesFor` tries the curated symbol, then a one-time
  `${SYMBOL}USDT` probe for a market token with no mapping, remembering the result so an unknown token
  is not retried on every draw.
- **CoinGecko negative caching.** A failed lookup is remembered for `NEGATIVE_TTL` (5 min) so unlisted
  tokens stop hammering the throttled queue.
- **Batched updates.** Series completions now coalesce their redraw into one `onUpdate` (200 ms debounce)
  instead of emitting once per finished series.
- **Theme tokens.** Added a `--loss` token to all four themes and routed the desk's loss/safety colors
  through it (`ui.css`, `workspace.css`, `wallet.css`). Audit result: all four themes are dark, so the
  existing `rgba(255,255,255,...)` overlays are safe on every palette.
- Tests added for `sanitizeHistoryCache`, the persistence roundtrip, and the `SYMBOLUSDT` probe.

Still open: holdings virtualization (the table already caps at 20 rows, so this is only needed for the
pre-filter list), wallet-alert list refresh (the end-of-refresh `onUpdate` already refreshes it; the toast
was added), in-vault signing (C17, deferred on purpose: signing the wrong transaction bytes is worse than
not signing), full WalletConnect handshake validation (needs a live Reown project), and jsdom section
smoke tests (jsdom is not a dependency and cannot be installed offline).

### 2026-10-16 (fourth pass: TradingView-style candles)

Landed (tests: 189 pass, 1 skipped; smoke-rendered with a DOM shim):

- **Candlesticks.** Replaced the tiny inline candle code with `drawCandles` (`src/workspace.js:69`): a
  measured-width SVG with a right price axis (5 gridlines + monospace labels), a bottom time axis,
  a volume histogram, a dashed last-price line with a filled price tag, and a hover crosshair plus an
  OHLCV tooltip. Candles scale with the container via a `ResizeObserver`; up/down use the theme
  `--live`/`--loss` tokens. Volume is now captured from Binance klines (`v`, `src/wallet/providers.js:74`)
  and kept through the history cache.
- The `Candles` toggle on the Trade price panel switches between this and the line/area chart; the
  line chart is used whenever a series has no OHLC (CoinGecko points).
- Tooltip styling added in `src/workspace.css` (`position:relative` chart, `.ws-candle-tip`, `.ws-tip-grid`).
- Verified by extracting the function and running it against a minimal DOM shim (`/tmp/candle_smoke.js`):
  60 candles render, axis labels/volume/crosshair all present, hover shows the OHLCV readout and hide works.

### 2026-10-16 (fifth pass: Trade terminal redesign, driven against the live app)

Inspected the running app over the Chrome DevTools Protocol (`--remote-debugging-port=9333`, screenshots via
`Page.captureScreenshot`), which exposed bugs that static review missed:

- **Panel actions array bug.** `panel(title, { actions: [a, b] })` stringified the array to
  `[object HTMLDivElement],[object HTMLButtonElement]` in the header. Fixed by spreading
  (`src/workspace.js:43`).
- **`mk()` used as if it took children.** `mk('div','hf-body', chart)` set `textContent` to the node, so the
  chart was never appended (and holders/order bodies were stringified). Fixed by appending children
  explicitly.
- **Invalid tag name.** `mk('small mono', ...)` called `createElement('small mono')`, which throws. This
  crashed the holders list for every token that actually had holder data, so holders always showed
  "not indexed". Fixed to `mk('small', 'mono', ...)`. This is the "no data indexed" bug.
- **Micro prices.** `money()` floored small values to `$0` (BONK at $0.000003). Now uses significant digits.
- **Class collision.** The chart legend reused `.ws-legend`, the donut legend class, so it rendered as a
  vertical column. Renamed to `.ws-ohlc`.

Redesign (TradingView-inspired):
- New header (name, ticker, large price, change badge, mint) with actions on the right.
- Chart card with a control row (ranges + Line/Candles) and an overlaid OHLC legend
  (`SOL 1H O H L C +x%`), a right price axis, time axis, volume histogram and a last-price tag.
- A single-row market stat strip using compact numbers (`$28.79M`, `$1.34B`) via `metric(...)`.
- An order ticket with a PAPER/LIVE mode badge, `You receive …` estimate and full-width actions.
- Holders card with a stat row (holders / top 10 / largest) and clean rows.
- Candles are the default chart; the desk chat now defaults collapsed for a wider terminal, reopenable
  from the top-bar Chat button. Prefs are versioned (`aurora-desk-v2`) so older saved state is ignored.

Status: `npm run check` passes, tests 189 pass / 1 skipped. Verified live: 7D→1h and 30D→4h candles render,
line/candles toggle works, USDT (no OHLC) falls back to a line, and BONK holders now render
(2,093,001 holders, top-10 38.3%).

### 2026-10-16 (sixth pass: Discover trending)

- **Wrong endpoint.** `providers.trending` called `${DEXSCREENER}/token-boosts/top/v1`, but token-boosts
  lives at the API root (`https://api.dexscreener.com/token-boosts/top/v1`), so the request 404'd and
  Discover silently fell back to a `walletSearch('SOL')`, painting 17 identical "SOL" cards. Added a
  `TOKEN_BOOSTS` constant (`src/wallet/providers.js:7`).
- **Quote-side pairs.** `pairForToken` picked the highest-liquidity pair even when the requested token was
  the quote, so symbol/price could belong to the other side. It now prefers pairs whose base token is the
  requested mint (`basePair` for trending, and `pairForToken` prefers base matches too).
- **Card formatting.** Discover cards now show symbol, change, price, dex, `Liq $…`, `MC $…` with compact
  numbers, plus a watch action and toast (`tokenCard`, `src/workspace.js`).
- Verified live: trending returns 14 distinct boosted tokens (NUBI, ROADSTER, XSTOK, …) with correct
  prices and changes; no console exceptions across all seven sections.

Remaining known rough edges: Portfolio empty state is sparse with no wallet; the signal/alert authoring
form grid could be tidied; `Liq —`/`MC —` shown when a boosted token has no measurable liquidity.

### 2026-10-16 (seventh pass: Portfolio + authoring forms)

- **Portfolio.** Added a five-cell stat strip (wallet value, 24h change, holdings, paper equity, paper cash).
  With no wallet it now shows a real call to action: an address input with **Add address** (Enter submits) and
  **Connect wallet**, instead of a bare empty panel. Markets moved into a proper table (Token / Price / 24h)
  with token names, so the section is useful even with no wallet. Holdings table and paper panel only render
  when relevant.
- **Signal authoring.** `signalForm` is now a tidy three-column grid with a **Token mint** field (defaults to
  the current token), a full-width research-gate row, and a right-aligned **Create signal** action; it no
  longer depends on a token already being selected.
- Verified live with CDP screenshots across all seven sections; zero console exceptions; `npm run check`
  passes and tests are 189 pass / 1 skipped.

### 2026-10-16 (eighth pass: Canvas + Research)

- **Canvas.** Empty state is now a four-tile starter (Price chart, Holders, Wallet metrics, Market table)
  that creates real views via `walletViewShow`, plus a **Clear** action when views are pinned. `bar` view
  specs render as an actual bar chart (`drawBars`) instead of a line, and a chart that fails to load shows a
  **Retry** button. Bar/line tiles verified live.
- **Research.** A **New report** card with a token-mint field, **Run research** and **Use current token**.
  Saved reports get Open/Close, Copy and Delete, and the opened report is rendered as sanitized markdown
  through the existing `window.AuroraMarkdown.render` into a scrollable `.ws-report-body` (headings, lists,
  tables, code) rather than a raw `<pre>`. Removed the stale `.ws-report` monospace rule that would have
  overridden the new card styling.
- Verified: markdown renders (`h2`/`ul`/`strong`), the metrics view renders three stats, and the whole desk
  still throws no console exceptions.

Remaining: a real end-to-end research job (needs a configured model) to eyeball the report card with real
content, and the live wallet paths (WalletConnect + a Reown project id).

### 2026-10-16 (audit: bugs found and fixed)

Full pass over the Gigi section: static review of `src/wallet/*`, `tools.js`, `extensions.js`, the wallet
IPC handlers in `main.js`, and `workspace.js`, plus live exercising of every desk flow over CDP (paper
buy/sell/condition, alerts, signals, strategies, theses, session pause/resume/reconcile, reset, views,
watchlist, research cancel, vault import, config) with console-exception capture.

Fixed:
- **`run()` rendered non-snapshots.** Any action returning `{ view }` (Canvas starter tiles, palette
  "show" commands) called `window.render({view})`, which throws, so the user got a bogus error toast even
  though the view worked. Added an `isSnapshot` guard (`src/workspace.js:47`, palette at `:529`).
- **Gigi's `show_view` tool could not pass data.** The tool had no `rows`/`data` args and the context
  dropped `source.rows`/`source.data`, so agent-created table/metrics/note views rendered empty. Added
  `rows`/`data` to the tool definition (`src/tools.js`) and parse them in the context (`src/main.js`).
- **Markets window showed `$0` for sub-cent tokens.** `wallet-window.js` used the old 4-decimal formatter;
  now uses significant digits (BONK shows `$0.00000298`).
- **Agent paper trades lost the symbol.** `paper_buy` / `paper_condition` / `strategy_create` did not set
  `symbol`, so positions/strategies showed a truncated mint. Now resolves from the curated market list.
- **Agent live trades ignored the position cap.** `trade_execute` now enforces `maxPositionUsd` for buys,
  matching the desk.
- **Alerts fired only once per run.** They now re-arm when price crosses back over the threshold.

Found, still open (by design or needing an environment):
- Local vault signing supports single-signer Jupiter and PumpPortal transactions. Multi-signer transactions still require WalletConnect.
- WalletConnect uses the deprecated `requiredNamespaces`; Reown prefers `optionalNamespaces`, so pairing
  with a real project id may fail. Needs a Reown project id to verify.
- Live strategies in `auto` mode execute without a per-trade approval (only `each` asks).
- Discover caches the search fallback once trending fails (`trending.loaded`), so it stays on the fallback
  until reload instead of retrying.
- `token_info` shows the safety value "revoked" for healthy tokens (it means mint/freeze authority revoked),
  which reads oddly.
- `layout: 'third'` collapses to half width; removing a missing view/report silently succeeds (idempotent);
  `views.normalizeView` lets `source.data` be arbitrarily large.

All fixes verified live: Canvas starters no longer toast a bogus error, the Markets window formats BONK
correctly, and no section throws a console exception. `npm run check` passes, tests 189 pass / 1 skipped.

### 2026-10-16 (ninth pass: de-purple + number formatting)

- **Palette.** The default (Heartflow) theme was a neon-magenta/violet scheme (`#ff3fce`/`#8b7bff`) with
  hardcoded purple glows and tints across `styles.css`, `harness-ui.css`, `brick.css`, etc. Repainted to a
  clean slate + signal-blue palette (`#5b8cff` accent, `#38bdf8` secondary, neutral `#0b0d12` surfaces) and
  replaced every hardcoded purple hex / `rgba(255,63,206,…)` / `rgba(123,92,255,…)` tint with neutral tokens
  or blue/cyan. Agent accents (`agents.js`) and the theme swatch/description (`themes.js`) updated to match,
  and the magenta logo PNG is hue-rotated to blue.
- **Number formatting.** Added a grouped formatter (`num` in `src/workspace.js`) for strategy/signal
  condition values and agent canvas table cells; market/portfolio metrics already use compact units
  (`$1.33B`). Gigi's system prompt now asks her to format numbers for humans (thousands separators, 1.2M /
  1.34B, enough decimals for small prices) instead of printing bare long integers.

### 2026-10-16 (tenth pass: Discover 2.0 + order engine)

- **Discover 2.0.** Rebuilt as a screener (`src/workspace.js drawDiscover`): tabs Trending / New pairs /
  Takeovers / Narratives, a sortable table (price, 5m/1h/24h, liquidity, volume, mkt cap, age), a symbol
  filter and a min-liquidity filter. New provider feeds `tokenProfiles`, `takeovers`, `narratives` and an
  enriched `pairSummary` (5m/1h/6h change, 24h buys/sells, createdAt) in `src/wallet/providers.js`, exposed
  as `wallet-discover`.
- **Order engine.** Paper orders now support **market, limit, stop, stop-limit, trailing stop and OCO
  (take-profit/stop-loss)** in `src/wallet/paper.js` (stop-limit arms into a limit; trailing tracks the
  peak; the OCO sibling cancels on fill). Positions expose `avgPrice` and `roe`. The ticket uses an order
  type dropdown with contextual fields (`src/workspace.js orderCard`); Portfolio shows entry, uPnL and ROE.
- Tests: added provider feed tests, a screener DOM test, and paper tests for stop-limit, trailing, OCO and
  ROE. `npm run check` passes, 201 pass / 1 skipped.

### 2026-10-16 (eleventh pass: Watch + notifications + design polish)

- **Watch section** (new desk tab): a watchlist table (price, 24h, sparkline, alert/trade/remove actions),
  the price-alert form + list (moved out of Strategies), and a **notification inbox** with Mark all read /
  Clear. Tab badge shows unread count.
- **Notifications.** `pushNotification` in `main.js` records alerts/signals to `data.notifications` and
  raises a native **Electron OS notification** (click focuses the window); `notifications-read` /
  `notifications-clear` IPC; snapshot exposes `notifications` + `unread`.
- **Design polish** (the "make it feel right" pass): real system font stack (was falling back to Segoe UI on
  macOS), refined button system (primary/ghost/buy/sell/segmented), cleaner inputs and field labels, and a
  tidier chat composer. The OHLC legend moved out of the chart into a static quote row so it no longer
  overlaps the candles when the chat panel is open.
- Tests: added a Watch DOM test; `npm run check` passes, 202 pass / 1 skipped.

Next: Jupiter API key wiring for live Trigger orders (limit/TP-SL/DCA) and Swap v2.



### 2026-10-18 (wallet following + Connections)

Landed:

- **Wallets replaced Canvas** in the desk (`src/workspace.js`). Followed wallets
  have Scan, Brief, Ask Gigi, Solscan, note and remove actions; a detail card
  shows value, SOL, 24h, token count, top 10 concentration, holdings, unpriced
  tokens and recent activity. Holdings link into Trade, token research and the
  watchlist. The tab badge is gone; own addresses stay in Portfolio.
- **Followed-wallet backend** (`src/wallet/follow.js`) validates and dedupes up
  to 50 wallets, caches scans for 5 minutes, and sanitizes persisted scans.
  Config normalization, IPC handlers and preload APIs cover add, remove, update,
  scan, scan all and brief (`src/main.js`, `src/preload.js`).
- **Gigi tools** `wallet_follow`, `wallet_follow_list` and `wallet_scan` let her
  add and read followed wallets in chat. The system prompt lists followed
  wallets and warns that scans contain no parsed swap history, so she must not
  infer exact buys, sells, PnL or win rate.
- **Connections hub** in Settings (`src/harness-ui.js`) shows model, web search,
  voice and market-data cards with status badges. Web search now has its own
  save/test/forget path, so saving an Ollama Cloud search key no longer changes
  the active model provider (`search-settings` and `search-test` in
  `src/main.js`). The market card saves and tests a custom Solana RPC.
- **View overlay.** `show_view` results and the Holders action render in a
  modal overlay; Canvas pinning UI is gone.
- Tests: added followed-wallet normalization, scan valuation and tool routing
  (`test/wallet.test.js`), plus a Wallets DOM smoke test (`test/workspace.test.js`).
  `npm run check` passes and `node --test test/*.test.js` reports 205 pass, 1 skipped.

Still open: parsed swap history and true PnL need a provider such as Helius
enhanced transactions; Token-2022 accounts are not scanned yet; scan all is
sequential in pairs and has no progress bar; wallet activity alerts are not
implemented.


### 2026-10-18 (wallet activity, Helius, Token-2022, compare)

Landed:

- **Activity alerts.** The wallet manager checks followed wallets every five
  minutes using `getSignaturesForAddress`, keeps a persisted baseline, and
  raises a `wallet` notification only when a new signature appears. Each wallet
  has an "Alert me when this wallet moves" toggle in its detail card.
- **Helius parsed activity.** Optional Helius key is encrypted with safeStorage
  and stored as `wallet.heliusEncryptedKey` (removed from the renderer
  snapshot). Connections has a save/test/forget flow. Scans now include parsed
  transaction descriptions, and the Brief prompt receives them. Without a key,
  the wallet detail says how to unlock them.
- **Token-2022.** `fetchPortfolio` reads both the classic token program and
  Token-2022, merging amounts by mint.
- **Compare.** Wallets has a Compare panel listing tokens shared by two or more
  followed wallets, combined value, owners and each wallet's top holdings.
- **Scan all progress.** The Scan all action disables while running and shows
  "Scanning…".
- **Inline model key.** The Connections model card can save and test a key for
  the active provider without opening the full Models dialog.
- Tests: activity alert baseline/re-arm/off, Helius transaction mapping and scan
  inclusion, Token-2022 merge, and the compare DOM. `npm run check` passes and
  `node --test test/*.test.js` reports 225 pass, 1 skipped.

Also landed: optional Jupiter API key support. The key is encrypted, managed in
Connections, and switches price lookups to the pro endpoint with an `x-api-key`
header; the wallet manager and followed-wallet scans both use it.

Also landed: **copy to paper**. A followed wallet can be mirrored into the paper
account with a USD budget, proportional or equal weighting, and a top-N cap.
Stablecoins are skipped unless the wallet is all stablecoins. The plan is pure
and unit-tested (`src/wallet/copy.js`), the IPC/tool path is
`wallet-follow-copy` / `wallet_copy`, and the Wallets detail has a Copy form.
Fees are reserved so the total simulated cost stays inside the budget.

Also landed: **auto-mirror**. A followed wallet can mirror new activity into the
paper account on each activity check. It uses holdings increases for buys, and
parsed Helius transfers for sells when a key is present. Each event is capped by
`mirrorBudgetUsd`, max buys, paper cash, the daily cap and the position cap.
The first check records a baseline and never trades. The detail card has on/off,
budget and max-buy controls; `wallet_auto_mirror` lets Gigi toggle it. The pure
plan lives in `src/wallet/mirror.js`, with fallback behavior that never invents
sells from top-25 list changes.

Wallet activity and mirror notifications now carry the wallet, signature and a
Solscan URL. The Watch inbox has an Open transaction action, and clicking a
native notification focuses Aurora and selects the followed wallet.

Scan all now runs as an in-process background job. It emits `wallet-scan-progress`
per wallet, supports `wallet-follow-scan-status`, shows a live count and progress
bar in Wallets, and emits `wallet-scan-complete` with error counts.

Long-tail token symbols and names are now enriched from DexScreener for the top
six priced and top six unpriced holdings in a scan, with a six-hour metadata
cache. Holdings show the resolved name instead of a short mint when available.

Theme audit: Wallets and Connections were exercised in Heartflow, Midnight, Ember
and Mint. All four are dark, surfaces use theme tokens, and no console errors or
layout breaks appeared. Stat labels were the only weak point (about 4.15:1 in
Heartflow and Midnight), so they now use `--muted` instead of `--faint`.

Pump.fun support landed: GeckoTerminal OHLCV fills charts for pumpfun and pumpswap pools, token info carries graduation/migration metadata, Trade shows a Pump.fun badge and defaults new tokens to 1D, and Discover has a Pump.fun DEX filter plus Pump.fun labels. Trade now uses a container query so the chart stays readable when the chat panel is open.

Still open: parsed-flow PnL (requires cost basis beyond enhanced transactions).


### 2026-10-18 (Pump.fun platform, feed, and live path)

Landed:

- **Platform switch.** Desk header now has `Solana | Pump.fun`. Pump.fun mode
  opens Discover and persists in `aurora-desk-v2`. The Discover tab label becomes
  `Pump.fun`.
- **Pump.fun dashboard.** `New`, `Trending`, `Graduated` tabs, stage counts,
  search, sort, min-volume filter, refresh, stale marker, 45 second auto refresh,
  and row actions for Trade, Scan with Gigi, Watch and Solscan.
- **Feed layer.** GeckoTerminal new and trending pools are normalized, enriched
  with one batch `tokens/multi` request, classified in `src/wallet/pump.js`, and
  cached for 45 seconds. Requests fail fast on 429 with a stale fallback instead
  of sitting in long retries.
- **Stages.** New is pump-fun pools created in the last six hours. Trending is
  still on the bonding curve, with exact graduation when Gecko metadata is
  available and a `bonding` label when it is not. Graduated is completed or
  PumpSwap, ranked by strength.
- **Trade panel.** Pump tokens show a Pump.fun card with bond progress, stage,
  age, market cap, volume, liquidity, live bonding-curve toggle, slippage and
  priority fee. Feed rows are carried into Trade as hints so very new tokens
  still get the pump panel before DexScreener or Gecko indexes them.
- **PumpPortal live path.** `src/wallet/pump-portal.js` builds local transactions
  for `pump` and `pump-amm`, simulates them, signs through WalletConnect, records
  venue/pool/fee/slippage/priority fee, and confirms the signature. Live bonding
  curve buys require an explicit toggle; sells remain available so the user can
  exit. Position, total and daily caps are enforced before signing.
- **Gigi.** Added `pump_discover`, `pump_scan`, `pump_watch`,
  `pump_trade_preview` and `pump_trade_execute`, plus prompt context for stages,
  PumpPortal fees and the no-invented-dev-data rule. `Scan page` sends the
  visible stage to Gigi.
- Tests: provider normalization, token batch metadata, stage classification,
  graduation scoring, PumpPortal body/error handling, pump limits, tool routing,
  platform switch, feed DOM and the fresh-row Trade fallback. `npm run check`
  passes and `node --test test/*.test.js` reports 236 pass, 1 skipped.

Verification: the real PumpPortal preview path was exercised through the app with
a temporary WalletConnect session and a public key. It built a bonding-curve
transaction and simulated successfully (136k compute units). PumpSwap transaction
building was also verified. Signing and sending were not exercised because that
needs a funded wallet. A guarded repeatable smoke script is available:
`node scripts/pump-live-smoke.js --mint MINT --public-key KEY` builds and
simulates only; add `--execute --project-id REOWN_ID` to pair, sign and send a
real trade after an interactive `yes` confirmation. The smoke amount is capped at
0.01 SOL. GeckoTerminal remains rate-limited, so the feed can show
stale data, and exact graduation is only available when Gecko token metadata
returns.


### 2026-10-18 (xStocks platform)

Landed:

- **Platform switch.** Desk header is now `Solana | Pump.fun | xStocks`. xStocks
  mode opens the tokenized-equities dashboard and persists across restarts.
- **Dashboard.** Featured, All and ETFs tabs, 20 rows per page, search by ticker,
  company or underlying, market-status filter, counts, pagination and a
  tokenized-securities disclaimer. Featured is the default and loads 18 majors.
- **Catalog.** The full xStocks catalog is 1,460 assets across 15 pages, cached
  for 15 minutes. Visible pages are enriched with one DexScreener batch, per-asset
  underlying quotes and Solana multipliers. Assets without a DEX pool are marked
  `no DEX` and do not open Trade.
- **Trade panel.** xStocks shows on-chain price, underlying quote, premium or
  discount, dividend multiplier, market status, halts, proof of reserves and the
  company/exchange. The chart is the on-chain xStock chart.
- **Live trading.** Existing Jupiter path. Live xStocks require a one-time
  tokenized-securities acknowledgment, plus an extra confirmation when the
  underlying market is closed or halted. Paper remains the default.
- **Holdings and watchlist.** Once the catalog is loaded, xStock rows use the
  ticker instead of a short mint and show an `xStock` badge.
- **Gigi.** Added `xstocks_list`, `xstocks_asset` and `xstocks_scan`, plus prompt
  context for underlying quotes, multipliers, premium/discount, market hours,
  reserves and the no-investment-advice rule.
- **Images.** The renderer CSP now allows HTTPS images for xStocks logos. This is
  documented in the privacy notes.
- Tests: xStocks normalization, catalog pagination, featured ordering, ETF and
  status filters, premium math, DexScreener batching, tool routing, platform DOM,
  Trade panel and premium rendering. `npm run check` passes and
  `node --test test/*.test.js` reports 245 pass, 1 skipped.

Live smoke: 18 featured rows with logos, on-chain prices, underlying quotes and
premiums; All showed 1,460 assets and ETFs 53; Trade rendered the xStocks panel;
the one-time acknowledgment opened; no console errors.

Known limits: no underlying stock chart history. Some catalog assets have no DEX
market and are marked accordingly. xStocks live execution still needs a funded
WalletConnect wallet for the first real order.


### 2026-10-18 (underlying stock history)

Landed:

- **Stock candles.** `xstocks.stockHistory` maps Yahoo Finance OHLCV into the same
  candle shape used by the desk. `1D` uses 5-minute candles with pre/post data,
  `7D` uses 1-hour candles sliced to seven days, `30D` uses daily candles, and
  `3M`/`6M`/`1Y`/`ALL` use daily or weekly candles. Requests are spaced and cached.
- **Trade toggle.** xStocks Trade now has `Stock` and `On-chain` chart modes.
  Stock is the default for xStocks. The legend shows the underlying ticker and
  interval; the on-chain mode keeps the existing GeckoTerminal chart.
- **Quote metadata.** The xStocks panel shows previous close, 52-week high and
  low, and the day range from Yahoo when available.
- **Gigi.** Added `xstocks_history` for underlying stock candles and included
  stock history in `xstocks_scan`. Prompt context distinguishes stock history
  from the on-chain xStock price.
- Tests: Yahoo candle mapping and range selection, chart toggle and on-chain
  fallback. `npm run check` passes and `node --test test/*.test.js` reports 247
  pass, 1 skipped.

Live smoke: Apple xStock opened on the Stock chart, legend showed `AAPL STOCK ·
1h`, the Stock/On-chain toggles rendered, and no console errors appeared.

Limits: Yahoo is an unofficial keyless endpoint and can rate-limit. Underlying
history is cached, not persisted, and some symbols may be unavailable.


### 2026-10-18 (Pump.fun Pulse + Gigi auto scan)

Landed:

- **Pulse interface.** Pump.fun now defaults to a dense card grid with logos,
  price, 1h change, mini sparkline, market cap, 1h volume, liquidity, buys/sells,
  bonding progress, stage badges, Gigi verdict and AUTO badges. A Cards/Table
  toggle keeps the old dense table available.
- **Sparklines.** Cards show an immediate trend spark derived from 5m/1h/24h
  changes. If GeckoTerminal returns candles, the real series replaces it.
- **Quick paper buy.** Each card has `Buy $25` in the paper account, using the
  feed price, plus Trade, Ask Gigi and Watch.
- **Gigi auto scan.** Turning it on scans the top 8 tokens in the current stage
  with the selected model once per interval (60s to 5m). It returns strict JSON
  verdicts (`buy`, `watch`, `avoid`, score 0-10, one-sentence reason), shown on
  cards and in the table with a reason line.
- **Auto paper.** Optional paper-only autotrade with budget, max buys per cycle,
  a 30 minute per-token cooldown, paper cash, the position cap and the daily cap.
  Live strategy auto is off by default and requires an explicit switch plus a live signer.
- **Auto bar.** Shows running state, last scan, last auto buys, errors and model
  cost warning. Settings persist in local storage. Auto scan resumes when the
  Pump.fun surface opens again and stops on shutdown.
- Tests: verdict parsing with unknown mints and fenced JSON, auto-buy selection,
  Pulse cards, sparklines, auto toggle and table fallback. `npm run check` passes
  and `node --test test/*.test.js` reports 250 pass, 1 skipped.

Live smoke: 25 Pulse cards and 25 sparklines rendered, a real Gigi auto scan
produced 8 verdicts and reasons, no console errors.

Limits: auto scan settings persist, and scanning resumes when Pump.fun opens. It
uses one model call per interval and can cost credits. Sparklines fall back to an approximate trend until
Gecko candles load. Live strategy auto remains off until explicitly enabled.


### 2026-10-18 (Pulse card polish, images and socials)

Landed:

- **PumpPortal launch stream.** The main process now subscribes to the free
  `subscribeNewToken` and `subscribeMigration` WebSocket streams when the Pump.fun
  feed is used. Recent launches and their metadata URIs are kept in memory.
- **Token images and socials.** Metadata JSON is fetched from HTTP or IPFS with
  multiple gateway fallbacks (`gateway.pinata.cloud`, `filebase`, `4everland`,
  `pump.mypinata`). Images, X, Telegram, website, Pump.fun and DexScreener links
  are attached to feed rows. Every card has a permanent Pump.fun link and a
  DexScreener link when a pair exists.
- **Fresh New feed.** Recent PumpPortal launches are merged into the New stage so
  brand-new tokens appear before GeckoTerminal indexes them. Estimated price,
  market cap and curve liquidity come from the launch event and SOL price until
  DexScreener returns a pair.
- **Card redesign.** Cleaner cards with a 36px image, polished monogram fallback,
  symbol/name, age, buy/sell count, social chips, price, sparkline, three stats,
  bond bar, verdict and full-width actions.
- **Gigi scan button.** Replaced the compass icon with a sparkle `gigi` icon and
  a full-width `Gigi scan` action. The header `Scan page` and auto-scan controls
  use the same icon.
- **Table parity.** The table view now shows token logos, social chips and the
  Gigi scan icon.
- Tests: metadata normalization and gateway fallback, social URL handling, and
  card image/social/Gigi-button assertions. `npm run check` passes and
  `node --test test/*.test.js` reports 263 pass, 1 skipped.

Live smoke: 50 cards, 36 images, 8 monograms, varying bonding-curve percentages,
50 Gigi scan buttons, `Live · 30s` refresh label, zero `$0` card prices, no
console errors.
GeckoTerminal was rate-limited during the smoke, so the New feed ran from the
PumpPortal stream plus DexScreener profiles and showed `stale` while Trending
and Graduated stayed empty.

Limits: the stream only knows launches that happen while Aurora is open. Older
tokens depend on DexScreener/Gecko images or the monogram fallback. IPFS gateway
availability can vary.


### 2026-10-19 (50-token Pulse and live launch inserts)

- Pulse now asks the backend for 50 rows per stage instead of 25. The feed reads
  up to 80 candidate mints and PumpPortal recent launches are merged into New at
  a 50-row cap.
- New PumpPortal launches are pushed to the renderer as `pump-launch` events,
  batched every 700ms. They prepend immediately without waiting for the next
  GeckoTerminal refresh, and the grid keeps the newest 50.
- Market stats and pair data refresh every 30 seconds while Pump.fun Discover is
  visible. The update label shows `Live · 30s · HH:MM:SS`.
- If GeckoTerminal rate-limits a cold start, the backend falls back to recent
  PumpPortal stream rows and marks the feed stale instead of showing an empty
  Pulse.
- `pump_discover` can now return up to 50 rows.
- Tests: 254 pass, 1 skipped.


### 2026-10-19 (live bonding-curve progress)

- Added a pure `curveProgress` helper. Pump.fun starts at 30 virtual SOL and
  graduates at 115 virtual SOL (85 SOL raised), with 1.073B initial virtual
  tokens and 1B supply.
- Streamed launches now show a real bonding percentage instead of the old
  `bonding` placeholder. Progress comes from PumpPortal virtual reserves when
  available, current pair market cap once DexScreener indexes it, or exact
  Pump.fun launchpad data from GeckoTerminal.
- Current pair market cap takes priority over the launch snapshot, so the bar
  moves as a streamed token trades. Market-cap-only estimates invert the curve
  formula to recover implied virtual SOL.
- Table and card bars share the same values and carry a tooltip describing the
  source (`PumpPortal reserves`, `current market cap` or `Pump.fun data`).
- Gigi scan prompts, auto-scan payloads and the Trade panel now receive the
  computed bond percentage.
- Tests: 255 pass, 1 skipped. Includes initial/half/full reserve cases, migrated
  tokens, exact launchpad data and market-cap fallback.


### 2026-10-19 (People, dev rap sheets and token intel)

- Added a persistent `People` layer for devs, KOLs, influencers, traders and
  smart wallets. Each person has a label, role, tags, note, latest read-only
  scan, holdings and observed dev launches.
- Added the `People` workspace tab with role filters, add-and-scan, individual
  scans, scan-all progress and Solscan links. People are separate from followed
  wallets, so research labels do not automatically enable copy or activity
  alerts.
- PumpPortal create events now keep `traderPublicKey` as the token creator.
  Tracks from the stream also keep the virtual reserves and market cap needed
  for launch metrics.
- Tracked dev launches update when the dev launches again or migrates. Launch
  history is labeled as observed, not complete on-chain history.
- Added `wallet-token-intel`. It returns the token summary, metrics, curve,
  dev rap sheet, observed launches, tracked holders, followed holders, KOL
  convergence, top holders and wallet labels.
- Research now has a token intel panel above saved reports: dev stats and
  observed launches, track-dev action, tracked people and KOL convergence, and a
  labeled top-holder table. Price, market cap and liquidity fall back to the
  PumpPortal launch snapshot until DexScreener indexes a pair.
- KOL convergence is based on the latest tracked-wallet scans. No KOL labels are
  shipped or guessed; the user adds the wallets they trust.
- Gigi tools: `wallet_people`, `wallet_people_add` and `wallet_token_intel`.
- Tests: 262 pass, 1 skipped. New coverage for people normalization, role/tag
  handling, scan preservation, launch merging, observed launch stats and tool
  routing.
- Live smoke: People kept a tracked dev with 22 observed launches and 2 current
  holdings. Research intel resolved a fresh Pump.fun creator, its 4.91% holding,
  observed launch, `$0.0000032` price, `$3.20k` market cap, `$3.27k` liquidity
  and 2% bond progress. KOL convergence correctly stayed empty because no KOL
  wallets were tracked yet.


### 2026-10-19 (wallet cluster graph)

- Added a local wallet graph built from the latest tracked-person and followed-
  wallet scans. Two wallets are linked when they hold the same non-SOL,
  non-stable token.
- People shows a shared-holding graph with node color by role, edge thickness by
  shared-token count, cluster count, and a short list of the strongest shared
  holdings. Nodes open Solscan on click.
- Research shows a holder cluster around the token: the token center, its
  tracked holders and the dev. Creator and holding edges are distinct from
  shared-holding edges.
- The graph deliberately does not claim funding or team links. It labels
  co-holding as a scan-based relationship and states that it is not proof of
  common ownership.
- The graph is local: it uses stored scans first, with no extra provider calls.
  Wallets need to be scanned for the graph to include them.
- Tests: 263 pass, 1 skipped. New coverage for a shared-holding edge between two
  tracked wallets and for the token holder graph.


### 2026-10-20 (vault signing and Pump cache)

- Added `src/wallet/tx-sign.js` for Solana wire-format transaction signing with
  ed25519. It supports legacy and versioned single-signer transactions and
  rejects multi-signer transactions instead of sending incomplete ones.
- Added a live signing wallet selector in Settings, Wallet. A selected bot wallet
  signs Jupiter and PumpPortal live transactions locally through the OS-encrypted
  vault; WalletConnect remains the fallback.
- The crypto desk connection label now shows `Bot · <label>` when a bot signer is
  selected.
- Live confirmations now show signer type, SOL balance and RPC health alongside
  route, minimum out, price impact and simulation.
- Pump.fun feeds are persisted to a local pump cache for 24 hours. A Gecko 429
  now triggers a two-minute circuit breaker while cached/stream data stays
  visible, so Trending and Graduated do not go blank on every refresh.
- Tests: transaction signing, versioned transactions, wrong-wallet rejection,
  compact-u16 parsing and the existing full suite.


### 2026-10-20 (live auto policy)

- Added a persistent `liveAutoEnabled` flag, default off.
- Added a `Live auto off / on` control in Strategies. Enabling requires Live
  execution, a selected WalletConnect or bot signer, and an explicit confirmation.
- Automatic live strategy intents now fail closed unless `liveAutoEnabled` is
  true. Manual `Run once` remains available as an explicit action.
- Pump auto scan remains paper-only and separate from strategy live auto.
