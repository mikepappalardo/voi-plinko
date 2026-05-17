/**
 * VOI PLINKO v2
 * Single-signature UX: player signs once (bet), house auto-settles.
 * Frontend polls for pRound → 0 to detect settlement and show result.
 */
import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useWallet } from '@txnlab/use-wallet-react';
import IntroVideo from './IntroVideo';
import algosdk from 'algosdk';
import PlinkoBoard from './PlinkoBoard';
import { APP_ID, APP_ADDRESS, ALGOD_URL, MIN_BET, MAX_BET, MULTIPLIERS, ROWS } from './config';
import './App.css';
import { WalletButton } from './WalletConnector';

type RiskLevel = 0 | 1 | 2;
type Phase = 'idle' | 'opting-in' | 'betting' | 'waiting' | 'result';

interface BetRecord {
  time: string; bet: number; payout: number; net: number; mult: string; risk: string;
}

const client = new algosdk.Algodv2('', ALGOD_URL, '');
const SEL = (sig: string) => algosdk.ABIMethod.fromSignature(sig).getSelector();

export default function App() {
  const { activeAddress, activeWallet, transactionSigner } = useWallet();
  const account = activeAddress ?? null;

  const [betAmount, setBetAmount] = useState(10);
  const [risk, setRisk] = useState<RiskLevel>(0);
  const [riskSnapshot, setRiskSnapshot] = useState<RiskLevel>(0);
  const [betAmountSnapshot, setBetAmountSnapshot] = useState(10);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Connect your wallet to play.');
  const [result, setResult] = useState<number | null>(null);
  const [payout, setPayout] = useState<number | null>(null);
  const [isOptedIn, setIsOptedIn] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BetRecord[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [introDone, setIntroDone] = useState(() => sessionStorage.getItem('plinko-intro') === '1');

  const handleIntroDone = () => {
    sessionStorage.setItem('plinko-intro', '1');
    setIntroDone(true);
  };

  const prevPRound = useRef(0);
  const prevBalance = useRef(0);
  const riskLabels = ['Low', 'Mid', 'High'];

  const sign = async (txns: algosdk.Transaction[]): Promise<Uint8Array[]> => {
    if (!activeWallet) throw new Error('No wallet connected');
    return transactionSigner(txns, txns.map((_, i) => i));
  };

  // Balance poller
  useEffect(() => {
    if (!account) { setBalance(null); return; }
    const fetch = async () => {
      try {
        const info = await client.accountInformation(String(account)).do();
        setBalance(Number(info.amount) / 1e6);
      } catch {}
    };
    fetch();
    const t = setInterval(fetch, 6000);
    return () => clearInterval(t);
  }, [account]);

  // Main state poller — detects settlement (pRound → 0)
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

        if (phase === 'waiting') {
          if (pr > 0) {
            prevPRound.current = pr;
            const s = await client.status().do();
            const cur = Number(s.lastRound);
            const blocksLeft = pr - cur + 1;
            if (blocksLeft > 0) {
              setStatus(`Dropping ball… (${blocksLeft} block${blocksLeft !== 1 ? 's' : ''})`);
            } else {
              setStatus('Settling… ⏳');
            }
          } else if (prevPRound.current > 0 && pr === 0) {
            // House settled — compute result from balance diff
            await resolveResult();
          }
        } else if (phase === 'idle' && pr > 0) {
          prevPRound.current = pr;
          setPhase('waiting');
          setStatus('Pending bet found — house settling…');
        }
      } catch { setIsOptedIn(false); }
    };
    const t = setInterval(poll, 2000);
    poll();
    return () => clearInterval(t);
  }, [account, phase]);

  useEffect(() => {
    if (account) setStatus('Ready to play!');
    else setStatus('Connect your wallet to play.');
  }, [account]);

  const resolveResult = async () => {
    const afterInfo = await client.accountInformation(String(account!)).do();
    const balAfter = Number(afterInfo.amount);
    const microVoiBet = Math.round(betAmountSnapshot * 1_000_000);
    // In v2 house calls settle — player balance: before = after bet, after = after house settles
    // payout = balAfter - prevBalance + settleFee (house paid the fee, not player)
    const userPayout = Math.max(0, balAfter - prevBalance.current);

    const houseFee = Math.floor(microVoiBet * 300 / 10000);
    const netBet = microVoiBet - houseFee;
    const trueMult = netBet > 0 ? userPayout / netBet : 0;
    const trueMultLabel = `${trueMult.toFixed(2)}x`;

    const riskKey = (['low', 'mid', 'high'] as const)[riskSnapshot];
    const mults = MULTIPLIERS[riskKey];
    let bucketIdx = Math.floor(mults.length / 2);
    let bestDiff = Infinity;
    for (let i = 0; i < mults.length; i++) {
      const diff = Math.abs(mults[i] - trueMult);
      if (diff < bestDiff) { bestDiff = diff; bucketIdx = i; }
    }

    prevPRound.current = 0;
    setPayout(userPayout / 1e6);
    setResult(bucketIdx);
    setDropping(true);
    setPhase('result');

    const net = userPayout - microVoiBet;
    setStatus(net > 0
      ? `🎉 +${(net / 1e6).toFixed(3)} VOI win (${trueMultLabel})`
      : `😢 ${(net / 1e6).toFixed(3)} VOI (${trueMultLabel})`);

    setHistory(prev => [{
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      bet: microVoiBet / 1e6,
      payout: userPayout / 1e6,
      net: net / 1e6,
      mult: trueMultLabel,
      risk: (['Low', 'Mid', 'High'])[riskSnapshot],
    }, ...prev].slice(0, 50));

    if (net > 0) {
      const colors = ['#00a39e', '#f0b800', '#ffffff', '#bbf7d0'];
      if (mults[bucketIdx] >= 2) {
        confetti({ particleCount: 2000, spread: 120, origin: { y: 0.5 }, colors });
        setTimeout(() => confetti({ particleCount: 1500, angle: 60, spread: 100, origin: { x: 0, y: 0.6 }, colors }), 150);
        setTimeout(() => confetti({ particleCount: 1500, angle: 120, spread: 100, origin: { x: 1, y: 0.6 }, colors }), 300);
      } else {
        confetti({ particleCount: 600, spread: 80, origin: { y: 0.6 }, colors });
      }
    }
  };

  const doOptIn = async () => {
    setError(null); setPhase('opting-in'); setStatus('Opting in…');
    try {
      const sp = await client.getTransactionParams().do();
      const txn = algosdk.makeApplicationOptInTxnFromObject({
        sender: account!, suggestedParams: sp, appIndex: APP_ID,
        appArgs: [SEL('opt_in()void')],
      });
      const [signed] = await sign([txn]);
      const { txid } = await client.sendRawTransaction(signed).do();
      await algosdk.waitForConfirmation(client, txid, 4);
      setIsOptedIn(true); setPhase('idle'); setStatus('Ready to play!');
    } catch (e: any) { setError(e.message); setPhase('idle'); }
  };

  const doBet = async () => {
    setError(null);
    const microVoi = Math.round(betAmount * 1_000_000);
    if (microVoi < MIN_BET || microVoi > MAX_BET) {
      setError(`Bet must be ${MIN_BET / 1e6}–${MAX_BET / 1e6} VOI`); return;
    }
    setBetAmountSnapshot(betAmount);
    setRiskSnapshot(risk);
    setPhase('betting');
    setResult(null); setPayout(null); setDropping(false);
    setStatus('Sign to drop the ball…');
    try {
      // Snapshot balance before bet goes out
      const beforeInfo = await client.accountInformation(String(account!)).do();
      prevBalance.current = Number(beforeInfo.amount) - microVoi - 2000; // subtract bet + tx fee

      const sp = await client.getTransactionParams().do();
      const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: account!, receiver: APP_ADDRESS, amount: microVoi, suggestedParams: sp,
      });
      const callTxn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: account!,
        suggestedParams: { ...sp, fee: BigInt(sp.minFee) * 2n, flatFee: true },
        appIndex: APP_ID,
        appArgs: [SEL('submit_bet(pay,uint64)void'), algosdk.encodeUint64(risk)],
      });
      algosdk.assignGroupID([payTxn, callTxn]);
      const signed = await sign([payTxn, callTxn]);
      const { txid } = await client.sendRawTransaction(signed).do();
      await algosdk.waitForConfirmation(client, txid, 4);

      const ls = await client.accountApplicationInformation(String(account!), APP_ID).do();
      const kvs = ls.appLocalState?.keyValue ?? [];
      const state: Record<string, number> = {};
      for (const kv of kvs) {
        const k = typeof kv.key === 'string' ? atob(kv.key) : new TextDecoder().decode(kv.key as Uint8Array);
        state[k] = Number(kv.value.uint ?? 0);
      }
      prevPRound.current = state['pRound'] ?? 0;
      setPhase('waiting');
      setStatus('Ball dropped! House settling automatically…');
    } catch (e: any) { setError(e.message?.slice(0, 120)); setPhase('idle'); }
  };

  const reset = () => {
    setPhase('idle'); setResult(null); setPayout(null); setDropping(false);
    setError(null); prevPRound.current = 0; setStatus('Place your next bet!');
  };

  return (
    <div className="app">
      {!introDone && <IntroVideo onDone={handleIntroDone} />}
      <header className="header">
        <div className="logo">
          {introDone ? (
            <video
              src="/voi-plinko-intro.mp4"
              muted playsInline autoPlay loop
              className="logo-img"
            />
          ) : (
            <div style={{ width: 120, height: 80 }} />
          )}
        </div>
        <div className="header-right">
          {balance !== null && (
            <div className="balance-chip">
              <span className="balance-label">Balance</span>
              <span className="balance-value">{balance.toFixed(2)} VOI</span>
            </div>
          )}
          <WalletButton />
        </div>
      </header>

      <main className="main">
        <div className="game-container">
          <div className="board-wrap">
            <PlinkoBoard rows={ROWS} riskLevel={riskSnapshot} dropping={dropping} result={result} onLand={() => {}} />
          </div>

          <div className="side-panel">
            <div className="panel-section">
              <div className="section-title">Bet Amount</div>
              <div className="bet-input-row">
                <input type="number" min={MIN_BET / 1e6} max={MAX_BET / 1e6} step={1}
                  value={betAmount} onChange={e => setBetAmount(Number(e.target.value))}
                  disabled={phase !== 'idle'} />
                <span style={{ color: '#4a6080', fontSize: '0.85rem', fontWeight: 600 }}>VOI</span>
              </div>
              <div className="quick-bets">
                {[10, 50, 100, 500, 1000].map(v => (
                  <button key={v} className="btn-quick" onClick={() => setBetAmount(v)} disabled={phase !== 'idle'}>{v}</button>
                ))}
              </div>
            </div>

            <div className="panel-section">
              <div className="section-title">Risk Level</div>
              <div className="risk-row">
                {riskLabels.map((r, i) => (
                  <button key={r} className={`btn-risk ${risk === i ? 'active' : ''}`}
                    onClick={() => setRisk(i as RiskLevel)} disabled={phase !== 'idle'}>{r}</button>
                ))}
              </div>
              <div className="mult-grid">
                {MULTIPLIERS[(['low', 'mid', 'high'] as const)[risk]].map((m, i) => (
                  <div key={i} className={`mult-item ${m >= 2 ? 'hot' : m >= 1 ? 'warm' : 'cold'}`}>{m}x</div>
                ))}
              </div>
            </div>

            <div className="panel-section">
              {phase === 'result' && (
                <div className={`result-banner ${(payout ?? 0) - betAmountSnapshot > 0 ? 'win' : 'loss'}`}>
                  {(payout ?? 0) - betAmountSnapshot > 0
                    ? `🎉 +${((payout ?? 0) - betAmountSnapshot).toFixed(3)} VOI win!`
                    : `😢 ${((payout ?? 0) - betAmountSnapshot).toFixed(3)} VOI`}
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 4 }}>
                    Payout: {(payout ?? 0).toFixed(3)} VOI
                  </div>
                </div>
              )}

              {!account && <WalletButton />}
              {account && !isOptedIn && phase === 'idle' && (
                <button className="btn-optin" onClick={doOptIn}>Opt In to Play</button>
              )}
              {account && isOptedIn && phase === 'idle' && (
                <button className="btn-drop" onClick={doBet}>Drop Ball — {betAmount} VOI</button>
              )}
              {(phase === 'opting-in' || phase === 'betting') && (
                <div className="btn-secondary-full">Waiting for signature…</div>
              )}
              {phase === 'waiting' && (
                <div className="confirm-prompt">
                  <span className="confirm-pulse">●</span>
                  {status}
                </div>
              )}
              {phase === 'result' && (
                <button className="btn-drop" onClick={reset}>Play Again</button>
              )}

              <div className="status-text">{phase !== 'waiting' ? status : ''}</div>
              {error && <div className="error-box">⚠️ {error}</div>}
              <div className="info-footer">
                App: <a href={`https://voi.observer/explorer/application/${APP_ID}`} target="_blank" rel="noreferrer">{APP_ID}</a>
                &nbsp;·&nbsp;3% fee&nbsp;·&nbsp;House auto-settles ✨
              </div>
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="history-wrap">
            <div className="history-header">
              <span className="section-title">Bet History</span>
              <span className="history-pnl" style={{ color: history.reduce((s, r) => s + r.net, 0) >= 0 ? '#00a39e' : '#ef4444' }}>
                Net: {history.reduce((s, r) => s + r.net, 0) >= 0 ? '+' : ''}{history.reduce((s, r) => s + r.net, 0).toFixed(3)} VOI
              </span>
            </div>
            <div className="history-table-wrap">
              <table className="history-table">
                <thead><tr><th>Time</th><th>Risk</th><th>Bet</th><th>Mult</th><th>Payout</th><th>Net</th></tr></thead>
                <tbody>
                  {history.map((r, i) => (
                    <tr key={i} className={r.net >= 0 ? 'row-win' : 'row-loss'}>
                      <td>{r.time}</td><td>{r.risk}</td><td>{r.bet.toFixed(1)}</td>
                      <td>{r.mult}</td><td>{r.payout.toFixed(3)}</td>
                      <td className={r.net >= 0 ? 'cell-win' : 'cell-loss'}>{r.net >= 0 ? '+' : ''}{r.net.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
