// Guarded PumpPortal smoke test. Default mode builds and simulates a
// transaction only. Signing and sending require --execute, a Reown project ID,
// a connected funded wallet, and an interactive confirmation.
const readline = require('node:readline/promises');
const pumpPortal = require('../src/wallet/pump-portal');
const swap = require('../src/wallet/swap');
const solana = require('../src/wallet/solana');
const vault = require('../src/wallet/vault');
const { createSolanaConnect } = require('../src/wallet/connect');

const args = process.argv.slice(2);
const value = (name, fallback = '') => { const index = args.indexOf(name); return index >= 0 && args[index + 1] ? args[index + 1] : fallback; };
const execute = args.includes('--execute');
const mint = value('--mint', 't8QthbHq7S5UvjbfV8F5Z9xbHWtvQs4NNyn2iExpump');
const pool = value('--pool', 'pump');
const amount = Number(value('--amount', '0.001'));
const slippage = Number(value('--slippage', '10'));
const priorityFee = Number(value('--priority-fee', '0.0005'));
const rpc = value('--rpc', solana.DEFAULT_RPC);
const projectId = value('--project-id', process.env.REOWN_PROJECT_ID || '');
let publicKey = value('--public-key', '');

async function buildAndSimulate() {
  if (!solana.validateAddress(publicKey)) throw new Error('Provide a valid --public-key.');
  if (!(amount > 0)) throw new Error('Enter a positive --amount.');
  if (amount > 0.01) throw new Error('Smoke amount is capped at 0.01 SOL.');
  const built = await pumpPortal.tradeLocal({ publicKey, action: 'buy', mint, amount, denominatedInSol: true, slippage, priorityFee, pool });
  const simulation = await swap.simulate(rpc, built.transaction, {});
  return { built, simulation };
}

(async () => {
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/pump-live-smoke.js [--mint MINT] [--public-key KEY] [--pool pump|pump-amm] [--amount 0.001]');
    console.log('       Add --execute --project-id REOWN_ID to pair, sign and send a real trade.');
    return;
  }
  if (!execute) {
    if (!publicKey) { const generated = vault.generateKeypair(); publicKey = generated.publicKey; console.log('No public key supplied. Generated a temporary public key:', publicKey); }
    const { built, simulation } = await buildAndSimulate();
    console.log('PumpPortal built a transaction:', { bytes: Buffer.from(built.transaction, 'base64').length, pool: built.request.pool, amount: built.request.amount, slippage: built.request.slippage, priorityFee: built.request.priorityFee });
    console.log('Simulation:', { ok: simulation.ok, error: simulation.error, units: simulation.units });
    console.log('No signature was created and nothing was sent.');
    return;
  }
  if (!projectId) throw new Error('Set --project-id or REOWN_PROJECT_ID for WalletConnect.');
  const memory = {};
  const connect = createSolanaConnect({ getProjectId: () => projectId, getStorage: () => memory, setStorage: value => Object.assign(memory, value) });
  const { uri, approval } = await connect.pair();
  console.log('Approve this WalletConnect URI in your wallet:\n', uri);
  await approval();
  const session = connect.session();
  if (!session?.topic) throw new Error('No WalletConnect session was established.');
  const account = (session.accounts[0] || '').split(':').pop();
  if (!solana.validateAddress(account)) throw new Error('The connected wallet did not return a Solana account.');
  publicKey = account;
  console.log('Connected wallet:', publicKey);
  const { built, simulation } = await buildAndSimulate();
  console.log('Preview:', { pool: built.request.pool, amount: built.request.amount, slippage: built.request.slippage, priorityFee: built.request.priorityFee, feePct: pumpPortal.LOCAL_FEE_PCT, simulation: simulation.ok ? 'ok' : simulation.error });
  if (!simulation.ok) throw new Error('Simulation failed. Nothing was signed.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Type "yes" to sign and send this real PumpPortal buy (${amount} SOL, ${pumpPortal.LOCAL_FEE_PCT}% venue fee): `);
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') { console.log('Cancelled. Nothing was signed.'); return; }
  const result = await connect.signAndSendTransaction(session.topic, built.transaction);
  console.log('Submitted:', result.signature || '(no signature returned)');
  if (result.signature) {
    const outcome = await swap.confirm(rpc, result.signature, {}).catch(() => ({ status: 'pending' }));
    console.log('Confirmation:', outcome);
  }
})().catch(error => { console.error('FAILED:', error.message); process.exitCode = 1; });
