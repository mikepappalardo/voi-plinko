/**
 * Voi Blockchain service — VoiPlinko contract integration
 * App ID: 49028406 on Voi mainnet
 * House: JV7URAS6XGXG7ZH44CWABWZYRIIJPXOWUVNFIJKLKJ3FRTADX2YWEJNO3A
 */

import algosdk from 'algosdk';

const PLINKO_APP_ID = 49028406;
const ALGOD_URL = 'https://mainnet-api.voi.nodely.dev';
const ALGOD_TOKEN = '';
const MIN_BET_MICROALGOS = 100_000;
const MAX_BET_MICROALGOS = 100_000_000;

const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, '');

export interface WalletState {
  connected: boolean;
  address: string | null;
  balance: number;
}

export interface BetResult {
  txHash: string;
  bucketIndex: number;
  multiplierBps: number;
  multiplier: number;
  payout: number;
  timestamp: number;
}

let _walletState: WalletState = { connected: false, address: null, balance: 0 };

export function setWalletState(state: WalletState) { _walletState = { ...state }; }
export function getWalletState(): WalletState { return { ..._walletState }; }

async function getBalanceForAddress(address: string): Promise<number> {
  try {
    const info = await algod.accountInformation(address).do();
    return Number(info.amount ?? 0n) / 1_000_000;
  } catch { return 0; }
}

export async function connectWallet(): Promise<WalletState> {
  const win = window as any;
  if (!win.algorand) throw new Error('No Voi wallet found. Install Kibisis or Defly.');
  const result = await win.algorand.enable({ genesisHash: 'r20fSQI8gWe/V6Vl1lQpSXKoulG5zB6Z28JzEPmxOqg=' });
  const address = result.accounts[0].address;
  const balance = await getBalanceForAddress(address);
  _walletState = { connected: true, address, balance };
  return { ..._walletState };
}

export async function disconnectWallet(): Promise<void> {
  _walletState = { connected: false, address: null, balance: 0 };
}

export async function getWalletBalance(): Promise<number> {
  if (!_walletState.address) return 0;
  const bal = await getBalanceForAddress(_walletState.address);
  _walletState.balance = bal;
  return bal;
}

export async function ensureOptedIn(): Promise<boolean> {
  if (!_walletState.address) throw new Error('Wallet not connected');
  const info = await algod.accountInformation(_walletState.address).do();
  const apps: any[] = info['apps-local-state'] ?? info.appsLocalState ?? [];
  const already = apps.some((a: any) => Number(a.id ?? a['id']) === PLINKO_APP_ID);
  if (already) return true;
  const sp = await algod.getTransactionParams().do();
  const optInTxn = algosdk.makeApplicationOptInTxnFromObject({
    sender: _walletState.address,
    suggestedParams: sp,
    appIndex: PLINKO_APP_ID,
  });
  const signed = await signTxn(optInTxn);
  const res = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, res.txid ?? res.txId, 8);
  return true;
}

export async function submitPlinkoBet(
  amountVoi: number,
  riskLevel: 'low' | 'medium' | 'high' | string,
  boardRows: number = 16
): Promise<{ txHash: string }> {
  if (!_walletState.address) throw new Error('Wallet not connected');
  const microVoi = Math.round(amountVoi * 1_000_000);
  if (microVoi < MIN_BET_MICROALGOS) throw new Error('Min bet is 0.1 VOI');
  if (microVoi > MAX_BET_MICROALGOS) throw new Error('Max bet is 100 VOI');
  const riskMap: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const riskNum = riskMap[riskLevel.toLowerCase()] ?? 1;
  const validRows = [8, 12, 16].includes(boardRows) ? boardRows : 16;

  await ensureOptedIn();

  const sp = await algod.getTransactionParams().do();
  const spCall = { ...sp, fee: 3000n, flatFee: true };
  const spPay  = { ...sp, fee: 0n,    flatFee: true };

  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: _walletState.address,
    receiver: algosdk.getApplicationAddress(PLINKO_APP_ID).toString(),
    amount: BigInt(microVoi),
    suggestedParams: spPay,
  });

  const callTxn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: _walletState.address,
    suggestedParams: spCall,
    appIndex: PLINKO_APP_ID,
    appArgs: [
      new Uint8Array(Buffer.from('play')),
      algosdk.encodeUint64(riskNum),
      algosdk.encodeUint64(validRows),
    ],
  });

  algosdk.assignGroupID([payTxn, callTxn]);
  const signedGroup = await signTxns([payTxn, callTxn]);
  const res = await algod.sendRawTransaction(signedGroup).do();
  return { txHash: res.txid ?? res.txId };
}

export async function awaitGameResult(txHash: string): Promise<BetResult> {
  const result = await algosdk.waitForConfirmation(algod, txHash, 8);
  let bucketIndex = 0, multiplierBps = 100, payoutMicro = 0;
  try {
    const logs: string[] = result.logs ?? result['logs'] ?? [];
    if (logs.length > 0) {
      const logBytes = Buffer.from(logs[0], 'base64');
      if (logBytes.length >= 24) {
        bucketIndex   = Number(logBytes.readBigUInt64BE(0));
        multiplierBps = Number(logBytes.readBigUInt64BE(8));
        payoutMicro   = Number(logBytes.readBigUInt64BE(16));
      }
    }
  } catch {}
  if (_walletState.address) _walletState.balance = await getBalanceForAddress(_walletState.address);
  return { txHash, bucketIndex, multiplierBps, multiplier: multiplierBps / 100, payout: payoutMicro / 1_000_000, timestamp: Date.now() };
}

export async function claimWinnings(_txHash: string): Promise<boolean> { return true; }

async function signTxn(txn: algosdk.Transaction): Promise<Uint8Array> {
  const [s] = await signTxns([txn]);
  return s;
}

async function signTxns(txns: algosdk.Transaction[]): Promise<Uint8Array[]> {
  const win = window as any;
  if (!win.algorand) throw new Error('No Voi wallet found');
  const toSign = txns.map(t => ({ txn: Buffer.from(algosdk.encodeUnsignedTransaction(t)).toString('base64') }));
  const result = await win.algorand.signTxns(toSign);
  return result.stxns.map((s: string) => new Uint8Array(Buffer.from(s, 'base64')));
}

export async function getContractInfo() {
  const info = await algod.getApplicationByID(PLINKO_APP_ID).do();
  const gs: any[] = info.params?.globalState ?? info['params']?.['global-state'] ?? [];
  const get = (key: string) => {
    const e = gs.find(e => Buffer.from(e.key, 'base64').toString() === key);
    return e ? Number(e.value.uint ?? 0n) : 0;
  };
  const appAddress = algosdk.getApplicationAddress(PLINKO_APP_ID).toString();
  const acc = await algod.accountInformation(appAddress).do();
  return {
    appId: PLINKO_APP_ID, appAddress,
    totalBets: get('totalBets'), totalPayout: get('totalPayout'),
    poolBalance: Number(acc.amount ?? 0n) / 1_000_000,
    minBet: get('minBet') / 1_000_000, maxBet: get('maxBet') / 1_000_000,
  };
}
