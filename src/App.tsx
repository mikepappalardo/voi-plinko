import { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import PlinkoBoard from './PlinkoBoard';
import { APP_ID, APP_ADDRESS, ALGOD_URL, MIN_BET, MAX_BET, MULTIPLIERS, ROWS } from './config';
import './App.css';
import { WalletConnector } from './WalletConnector';

type RiskLevel = 0 | 1 | 2;
type Phase = 'idle' | 'opting-in' | 'betting' | 'waiting' | 'settling' | 'result';

const client = new algosdk.Algodv2('', ALGOD_URL, '');

const SEL = (sig: string) => algosdk.ABIMethod.fromSignature(sig).getSelector();

export default function App() {
  const { activeAddress, activeWallet, transactionSigner } = useWallet();
  const account = activeAddress ?? null;

  const [betAmount, setBetAmount] = useState(1);
  const [risk, setRisk] = useState<RiskLevel>(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Connect your wallet to play.');
  const [result, setResult] = useState<number | null>(null);
  const [payout, setPayout] = useState<number | null>(null);
  const [isOptedIn, setIsOptedIn] = useState(false);
  const [pendingRound, setPendingRound] = useState(0); void pendingRound;
  const [dropping, setDropping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const riskLabels = ['Low', 'Mid', 'High'];

  // Sign txns via use-wallet
  const sign = async (txns: algosdk.Transaction[]): Promise<Uint8Array[]> => {
    if (!activeWallet) throw new Error('No wallet connected');
    return transactionSigner(txns, txns.map((_, i) => i));
  };

  // Poll opt-in + pending state
  useEffect(() => {
    if (!account) return;
    const poll = async () => {
      try {
        const info = await client.accountApplicationInformation(String(account), APP_ID).do();
        setIsOptedIn(true);
        const ls = info.appLocalState?.keyValue ?? [];
        const state: Record<string, number> = {};
        for (const kv of ls) {
          const key = typeof kv.key === 'string' ? atob(kv.key) : new TextDecoder().decode(kv.key as Uint8Array);
          state[key] = Number(kv.value.uint ?? 0);
        }
        const pr = state['pRound'] ?? 0;
        setPendingRound(pr);

        if (phase === 'waiting' && pr > 0) {
          const status = await client.status().do();
          const cur = Number(status.lastRound);
          if (cur > pr) {
            setPhase('settling');
            setStatus('Block confirmed! Sign to settle...');
          }
        }
      } catch {
        setIsOptedIn(false);
      }
    };
    const t = setInterval(poll, 3000);
    poll();
    return () => clearInterval(t);
  }, [account, phase]);

  useEffect(() => {
    if (account) setStatus('Ready to play!');
    else setStatus('Connect your wallet to play.');
  }, [account]);

  const doOptIn = async () => {
    setError(null);
    setPhase('opting-in');
    setStatus('Opting in...');
    try {
      const sp = await client.getTransactionParams().do();
      const txn = algosdk.makeApplicationOptInTxnFromObject({
        sender: account!,
        suggestedParams: sp,
        appIndex: APP_ID,
        appArgs: [SEL('opt_in()void')],
      });
      const [signed] = await sign([txn]);
      const { txid } = await client.sendRawTransaction(signed).do();
      await algosdk.waitForConfirmation(client, txid, 4);
      setIsOptedIn(true);
      setPhase('idle');
      setStatus('Ready to play!');
    } catch (e: any) {
      setError(e.message);
      setPhase('idle');
    }
  };

  const doBet = async () => {
    setError(null);
    const microVoi = Math.round(betAmount * 1_000_000);
    if (microVoi < MIN_BET || microVoi > MAX_BET) {
      setError(`Bet must be ${MIN_BET / 1e6}–${MAX_BET / 1e6} VOI`);
      return;
    }
    setPhase('betting');
    setResult(null);
    setPayout(null);
    setDropping(false);
    setStatus('Sign to submit bet...');
    try {
      const sp = await client.getTransactionParams().do();

      const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: account!,
        receiver: APP_ADDRESS,
        amount: microVoi,
        suggestedParams: sp,
      });
      const callTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: account!,
        suggestedParams: { ...sp, fee: BigInt(sp.minFee) * 2n, flatFee: true },
        appIndex: APP_ID,
        appArgs: [SEL('submit_bet(pay,uint64,uint64)void'), algosdk.encodeUint64(risk), algosdk.encodeUint64(ROWS)],
      });
      algosdk.assignGroupID([payTxn, callTxn]);
      const signed = await sign([payTxn, callTxn]);
      const { txid } = await client.sendRawTransaction(signed).do();
      await algosdk.waitForConfirmation(client, txid, 4);

      const ls = await client.accountApplicationInformation(String(account!), APP_ID).do();
      const kvs = ls.appLocalState?.keyValue ?? [];
      const state: Record<string, number> = {};
      for (const kv of kvs) { const k = typeof kv.key === 'string' ? atob(kv.key) : new TextDecoder().decode(kv.key as Uint8Array); state[k] = Number(kv.value.uint ?? 0); }
      setPendingRound(state['pRound'] ?? 0);
      setPhase('waiting');
      setStatus(`Bet submitted! Waiting for block ${(state['pRound'] ?? 0) + 1}...`);
    } catch (e: any) {
      setError(e.message);
      setPhase('idle');
    }
  };

  const doSettle = async () => {
    setError(null);
    setPhase('settling');
    setStatus('Sign to settle...');
    try {
      const sp = await client.getTransactionParams().do();
      const txn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: account!,
        suggestedParams: { ...sp, fee: BigInt(sp.minFee) * 3n, flatFee: true },
        appIndex: APP_ID,
        appArgs: [SEL('settle_bet()void')],
      });
      const [signed] = await sign([txn]);
      const { txid } = await client.sendRawTransaction(signed).do();
      const txResult = await algosdk.waitForConfirmation(client, txid, 4);

      // Find user payout from inner transactions
      const innerTxns: any[] = txResult.innerTxns ?? [];
      let userPayout = 0;
      for (const it of innerTxns) {
        const rcv = it?.txn?.txn?.rcv;
        const amt = it?.txn?.txn?.amt;
        if (rcv && amt) {
          const rcvBytes = Uint8Array.from(atob(rcv), ch => ch.charCodeAt(0)); const rcvAddr = algosdk.encodeAddress(rcvBytes);
          if (rcvAddr === account) userPayout = Number(amt);
        }
      }

      const microVoi = Math.round(betAmount * 1_000_000);
      const fee = Math.floor(microVoi * 300 / 10_000);
      const net = microVoi - fee;
      const multActual = net > 0 ? userPayout / net : 0;
      const riskKey = (['low', 'mid', 'high'] as const)[risk];
      const mults = MULTIPLIERS[riskKey];
      let bucketIdx = mults.length - 1;
      for (let i = 0; i < mults.length; i++) {
        if (Math.abs(mults[i] - multActual) < 0.15) { bucketIdx = i; break; }
      }

      setPayout(userPayout / 1e6);
      setResult(bucketIdx);
      setDropping(true);
      setPhase('result');
      const payoutVoi = (userPayout / 1e6).toFixed(3);
      setStatus(userPayout > 0 ? `🎉 Won ${payoutVoi} VOI! (${mults[bucketIdx]}x)` : `No payout. Better luck next time!`);
    } catch (e: any) {
      setError(e.message);
      setPhase('idle');
    }
  };

  const reset = () => {
    setPhase('idle');
    setResult(null);
    setPayout(null);
    setDropping(false);
    setError(null);
    setStatus('Place your next bet!');
  };


  return (
    <div className="app">
      <header className="header">
        <div className="logo">🎰 Plinko <span>on Voi</span></div>
        <div className="header-right">
          <WalletConnector />
        </div>
      </header>

      <main className="main">
        <div className="board-col">
          <PlinkoBoard rows={ROWS} riskLevel={risk} dropping={dropping} result={result} onLand={() => {}} />
        </div>

        <div className="controls-col">
          <div className="card">
            <h2>Place Bet</h2>

            <label>Bet Amount (VOI)</label>
            <div className="bet-row">
              <input
                type="number"
                min={MIN_BET / 1e6} max={MAX_BET / 1e6} step={0.1}
                value={betAmount}
                onChange={e => setBetAmount(Number(e.target.value))}
                disabled={phase !== 'idle'}
              />
              <div className="quick-bets">
                {[0.5, 1, 5, 10].map(v => (
                  <button key={v} className="btn-quick" onClick={() => setBetAmount(v)} disabled={phase !== 'idle'}>{v}</button>
                ))}
              </div>
            </div>

            <label>Risk Level</label>
            <div className="risk-row">
              {riskLabels.map((r, i) => (
                <button key={r} className={`btn-risk ${risk === i ? 'active' : ''}`}
                  onClick={() => setRisk(i as RiskLevel)} disabled={phase !== 'idle'}>{r}</button>
              ))}
            </div>

            <div className="multiplier-preview">
              <div className="mult-title">Payouts — {riskLabels[risk]} Risk</div>
              <div className="mult-grid">
                {MULTIPLIERS[(['low', 'mid', 'high'] as const)[risk]].map((m, i) => (
                  <div key={i} className={`mult-item ${m >= 5 ? 'hot' : m >= 1 ? 'warm' : 'cold'}`}>{m}x</div>
                ))}
              </div>
            </div>

            <div className="status-box">{status}</div>
            {error && <div className="error-box">⚠️ {error}</div>}

            <div className="action-area">
              {!account && <WalletConnector />}
              {account && !isOptedIn && phase === 'idle' && (
                <button className="btn-primary" onClick={doOptIn}>Opt In to Play</button>
              )}
              {account && isOptedIn && phase === 'idle' && (
                <button className="btn-primary" onClick={doBet}>Drop Ball — {betAmount} VOI</button>
              )}
              {phase === 'waiting' && (
                <button className="btn-secondary" onClick={doSettle}>Settle Bet (ready)</button>
              )}
              {phase === 'opting-in' || phase === 'betting' || phase === 'settling' ? (
                <button className="btn-secondary" disabled>Processing...</button>
              ) : null}
              {phase === 'result' && (
                <>
                  <div className={`result-banner ${(payout ?? 0) > 0 ? 'win' : 'loss'}`}>
                    {(payout ?? 0) > 0 ? `🎉 Won ${payout?.toFixed(3)} VOI!` : '😢 No payout this time'}
                  </div>
                  <button className="btn-primary" onClick={reset}>Play Again</button>
                </>
              )}
            </div>

            <div className="info-footer">
              App ID: <a href={`https://voi.observer/explorer/application/${APP_ID}`} target="_blank" rel="noreferrer">{APP_ID}</a>
              <br />House fee: 3% | Min: {MIN_BET / 1e6} VOI | Max: {MAX_BET / 1e6} VOI
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
