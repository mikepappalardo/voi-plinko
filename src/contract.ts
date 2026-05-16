import algosdk from 'algosdk';
import { APP_ID, APP_ADDRESS, ALGOD_URL, ALGOD_TOKEN } from './config';

export const client = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, '');

const SEL = (sig: string) => {
  const h = algosdk.ABIMethod.fromSignature(sig).getSelector();
  return h;
};

export async function optIn(signer: (txns: Uint8Array[]) => Promise<Uint8Array[]>, sender: string) {
  const sp = await client.getTransactionParams().do();
  const txn = algosdk.makeApplicationOptInTxnFromObject({
    sender,
    suggestedParams: sp,
    appIndex: APP_ID,
    appArgs: [SEL('opt_in()void')],
  });
  const [signed] = await signer([txn.toByte()]);
  const { txid } = await client.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(client, txid, 4);
  return txid;
}

export async function submitBet(
  signer: (txns: Uint8Array[]) => Promise<Uint8Array[]>,
  sender: string,
  amountMicroVoi: number,
  riskLevel: number, // 0=low, 1=mid, 2=high
) {
  const sp = await client.getTransactionParams().do();
  const sp2 = { ...sp, fee: BigInt(sp.minFee) * 2n, flatFee: true };

  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: APP_ADDRESS,
    amount: amountMicroVoi,
    suggestedParams: sp,
  });

  const callTxn = algosdk.makeApplicationNoOpTxnFromObject({
    sender,
    suggestedParams: sp2,
    appIndex: APP_ID,
    appArgs: [
      SEL('submit_bet(pay,uint64)void'),
      algosdk.encodeUint64(riskLevel),
    ],
  });

  algosdk.assignGroupID([payTxn, callTxn]);
  const [sp1, sc1] = await signer([payTxn.toByte(), callTxn.toByte()]);
  const { txid } = await client.sendRawTransaction([sp1, sc1]).do();
  await algosdk.waitForConfirmation(client, txid, 4);
  return txid;
}

export async function settleBet(
  signer: (txns: Uint8Array[]) => Promise<Uint8Array[]>,
  sender: string
) {
  const sp = await client.getTransactionParams().do();
  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender,
    suggestedParams: { ...sp, fee: BigInt(sp.minFee) * 3n, flatFee: true },
    appIndex: APP_ID,
    appArgs: [SEL('settle_bet()void')],
  });
  const [signed] = await signer([txn.toByte()]);
  const { txid } = await client.sendRawTransaction(signed).do();
  const result = await algosdk.waitForConfirmation(client, txid, 4);
  return { txid, result };
}

export async function getLocalState(address: string) {
  try {
    const info = await client.accountApplicationInformation(address, APP_ID).do();
    const ls = info.appLocalState?.keyValue ?? [];
    const state: Record<string, number> = {};
    for (const kv of ls) {
      const key = typeof kv.key === 'string' ? atob(kv.key) : new TextDecoder().decode(kv.key);
      state[key] = Number(kv.value.uint ?? 0);
    }
    return {
      pendingRound: state['pRound'] ?? 0,
      pendingAmount: state['pAmt'] ?? 0,
      pendingRisk: state['pRisk'] ?? 0,
      isOptedIn: true,
    };
  } catch {
    return { pendingRound: 0, pendingAmount: 0, pendingRisk: 0, isOptedIn: false };
  }
}

export async function getCurrentRound() {
  const status = await client.status().do();
  return Number(status.lastRound);
}
