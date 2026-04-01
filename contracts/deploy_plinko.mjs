/**
 * deploy_plinko.mjs
 * Deploys the VoiPlinko contract to Voi mainnet.
 *
 * Usage:
 *   HOUSE_MNEMONIC="word1 word2 ..." node deploy_plinko.mjs
 *
 * Or set HOUSE_MNEMONIC in .env in this directory.
 *
 * The house address will be set to the deployer's address by default.
 * Override with HOUSE_ADDRESS env var to use a different address.
 */

import algosdk from 'algosdk';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dir = path.dirname(fileURLToPath(import.meta.url));

// Load .env if present
const envPath = path.join(__dir, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const ALGOD_URL = process.env.ALGOD_URL || 'https://mainnet-api.voi.nodely.dev';
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';
const MNEMONIC = process.env.HOUSE_MNEMONIC;

if (!MNEMONIC) {
  console.error('ERROR: Set HOUSE_MNEMONIC env var (the wallet that will own the contract)');
  process.exit(1);
}

const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, '');
const account = algosdk.mnemonicToSecretKey(MNEMONIC);
const houseAddress = process.env.HOUSE_ADDRESS || account.addr;

console.log('Deployer:', account.addr.toString());
console.log('House address:', houseAddress.toString());

// Compile TEAL
async function compile(teal) {
  const res = await algod.compile(teal).do();
  return new Uint8Array(Buffer.from(res.result, 'base64'));
}

const approvalTeal = readFileSync(path.join(__dir, 'plinko_approval.teal'), 'utf8');
const clearTeal    = readFileSync(path.join(__dir, 'plinko_clear.teal'), 'utf8');

console.log('Compiling...');
const [approval, clear] = await Promise.all([compile(approvalTeal), compile(clearTeal)]);
console.log('Compiled OK');

// Build create txn
const sp = await algod.getTransactionParams().do();

// Schema: 6 global bytes (house addr), 5 global ints, 2 local ints
const globalSchema = new algosdk.StateSchema(1, 6); // 1 byteslice (house), 6 ints
const localSchema  = new algosdk.StateSchema(0, 2); // 2 ints (pBets, pWins)

// house address arg
const houseDecoded = algosdk.decodeAddress(houseAddress.toString());

const createTxn = algosdk.makeApplicationCreateTxnFromObject({
  sender: account.addr,
  suggestedParams: sp,
  onComplete: algosdk.OnApplicationComplete.NoOpOC,
  approvalProgram: approval,
  clearProgram: clear,
  numGlobalByteSlices: 1,
  numGlobalInts: 6,
  numLocalByteSlices: 0,
  numLocalInts: 2,
  appArgs: [houseDecoded.publicKey],
  note: new Uint8Array(Buffer.from('VoiPlinko v1')),
});

const signedCreate = createTxn.signTxn(account.sk);
console.log('Submitting create transaction...');
const sendRes = await algod.sendRawTransaction(signedCreate).do();
const txId = sendRes.txid || sendRes.txId;
console.log('TxID:', txId);

// Wait for confirmation
const result = await algosdk.waitForConfirmation(algod, txId, 8);
const appId = result['application-index'] || result.applicationIndex;
console.log('\n✓ Deployed!');
console.log('App ID:', appId);
console.log('App Address:', algosdk.getApplicationAddress(appId).toString());
console.log('\nNext steps:');
console.log('  1. Fund the prize pool: send VOI to', algosdk.getApplicationAddress(appId).toString());
console.log('  2. Players opt in, then call play(riskLevel, boardRows) with a payment txn');
console.log('  3. Set this App ID in the frontend voiBlockchain.ts');
