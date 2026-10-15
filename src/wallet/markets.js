// A small curated set of major Solana tokens so Gigi's desk has live data the
// moment it opens, even before a wallet is connected. `coingecko` ids let us
// seed chart history for the well-known ones; unknown tokens simply fill in
// from the live poller as Gigi watches them.
const MARKETS = [
  { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', name: 'Solana', coingecko: 'solana', binance: 'SOLUSDT' },
  { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin', coingecko: 'usd-coin', binance: 'USDCUSDT' },
  { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', name: 'Tether', coingecko: 'tether' },
  { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk', coingecko: 'bonk', binance: 'BONKUSDT' },
  { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', name: 'dogwifhat', coingecko: 'dogwifcoin', binance: 'WIFUSDT' },
  { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', name: 'Jupiter', coingecko: 'jupiter-exchange-solana', binance: 'JUPUSDT' },
  { mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', symbol: 'RAY', name: 'Raydium', coingecko: 'raydium', binance: 'RAYUSDT' },
  { mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', symbol: 'PYTH', name: 'Pyth Network', coingecko: 'pyth-network', binance: 'PYTHUSDT' },
  { mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', symbol: 'JTO', name: 'Jito', coingecko: 'jito-governance-token', binance: 'JTOUSDT' },
  { mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', symbol: 'mSOL', name: 'Marinade Staked SOL', coingecko: 'msol' },
  { mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', symbol: 'JitoSOL', name: 'Jito Staked SOL', coingecko: 'jito-staked-sol' },
  { mint: 'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', symbol: 'bSOL', name: 'BlazeStake Staked SOL', coingecko: 'blazestake-staked-sol' }
];

function listMarkets() {
  return MARKETS.map(entry => ({ ...entry }));
}

function mintSet() {
  return new Set(MARKETS.map(entry => entry.mint));
}

function marketFor(mint) {
  return MARKETS.find(entry => entry.mint === mint) || null;
}

module.exports = { MARKETS, listMarkets, mintSet, marketFor };
