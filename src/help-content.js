// Plain-language explainers for the info buttons. Kept short and in the house
// voice: no filler, no em dashes.
(() => {
  const terms = {
    'wallet': { title: 'Wallet', body: 'A wallet holds the keys to your crypto. The keys stay with you; this app only reads your public address, it never holds them.' },
    'address': { title: 'Public address', body: 'Your address is like an account number. It is safe to share and it is what you paste here to let Gigi read your holdings. A seed phrase is different: never share that with anyone.' },
    'seed': { title: 'Seed phrase', body: 'The 12 or 24 words that control your wallet. Anyone with them owns your funds. Never type them into this app, a website or a chat.' },
    'sol': { title: 'SOL', body: 'Solana’s native coin. You pay network fees in it, so it is normal to keep a small amount spare.' },
    'token': { title: 'Token', body: 'Any coin other than SOL that lives on Solana. Most are created by anyone in minutes, so treat unfamiliar tokens with care.' },
    'gas': { title: 'Network fee', body: 'A tiny fee paid to the Solana network to process a transaction, usually a fraction of a cent. A priority fee can be added to jump the queue.' },
    'slippage': { title: 'Slippage', body: 'How much the price is allowed to move between quoting and confirming a trade. Too low and the trade fails on a fast market; too high and you can be filled at a bad price.' },
    'liquidity': { title: 'Liquidity', body: 'How much money is pooled and available to trade against. Thin liquidity means bigger price moves and harder exits.' },
    'marketcap': { title: 'Market cap', body: 'The token price multiplied by how many exist. A rough size, not a guarantee of quality.' },
    'fdv': { title: 'FDV', body: 'Fully diluted value: price multiplied by the total supply, including tokens not yet in circulation.' },
    'holders': { title: 'Holders and top 10', body: 'How many wallets hold the token, and what share the ten biggest control. A very high top-10 share means a few wallets can move the price.' },
    'mint-authority': { title: 'Mint authority', body: 'If active, someone can create more of the token at will, which can dilute your holdings. Revoked is the safer setting.' },
    'freeze-authority': { title: 'Freeze authority', body: 'If active, someone can freeze token accounts and stop you selling. Revoked is the safer setting.' },
    'lp': { title: 'Liquidity pool', body: 'The pot of funds that traders swap against. If it is locked, the creator cannot pull it out; if it is not, the floor can vanish.' },
    'rug': { title: 'Rug pull', body: 'When a creator drains the liquidity or dumps on buyers, leaving the token worthless. It is the most common way to lose money on a new token.' },
    'bonding-curve': { title: 'Bonding curve', body: 'A launch model where price rises automatically as more people buy, before a token graduates to a normal liquidity pool.' },
    'amm': { title: 'AMM', body: 'An automated market maker: a pool that prices trades with a formula instead of an order book. Most Solana swaps run on AMMs.' },
    'dex': { title: 'DEX', body: 'A decentralised exchange that swaps tokens on chain, with no account and no custodian. Jupiter routes across many DEXs to get the best price.' },
    'mev': { title: 'MEV and Jito', body: 'MEV is value bots can extract by reordering your trade in a block. A Jito tip can bundle your transaction to reduce that risk on Solana.' },
    'limit-order': { title: 'Limit order', body: 'An order that only fills at your chosen price or better, so you do not have to watch the chart.' },
    'dca': { title: 'DCA', body: 'Dollar cost averaging: buying a fixed amount on a schedule to smooth out your entry price.' },
    'pnl': { title: 'Profit and loss', body: 'How much your holdings have gained or lost. Here it is an estimate built from prices, not tax advice.' },
    'cost-basis': { title: 'Cost basis', body: 'What you originally paid for what you hold. On chain it is hard to know exactly, so Aurora estimates it and labels it clearly.' },
    'nft': { title: 'NFT', body: 'A unique on-chain item rather than a currency. It appears in your wallet alongside tokens.' }
  };
  if (typeof module !== 'undefined') module.exports = { terms };
  else window.AuroraHelp = { terms };
})();
