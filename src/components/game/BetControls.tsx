import { RiskLevel, BoardSize, BET_OPTIONS, BOARD_SIZES } from '@/config/gameConfig';
import { Minus, Plus, Zap, RotateCcw } from 'lucide-react';

interface BetControlsProps {
  balance: number;
  risk: RiskLevel;
  boardRows: BoardSize;
  betAmount: number;
  isDropping: boolean;
  autoMode: boolean;
  tokenMode: boolean;
  onRiskChange: (risk: RiskLevel) => void;
  onBoardRowsChange: (rows: BoardSize) => void;
  onBetChange: (amount: number) => void;
  onDrop: () => void;
  onDropMultiple: (count: number) => void;
  onAutoToggle: () => void;
  onTokenModeToggle: () => void;
  onResetBalance: () => void;
}

const riskOptions: { value: RiskLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
];

const riskStyles: Record<RiskLevel, string> = {
  low: 'bg-primary/20 text-primary border-primary/40',
  medium: 'bg-win/20 text-win border-win/40',
  high: 'bg-destructive/20 text-destructive border-destructive/40',
};

export default function BetControls({
  balance, risk, boardRows, betAmount, isDropping, autoMode, tokenMode,
  onRiskChange, onBoardRowsChange, onBetChange, onDrop, onDropMultiple,
  onAutoToggle, onTokenModeToggle, onResetBalance,
}: BetControlsProps) {
  const canBet = balance >= betAmount && !isDropping;

  const adjustBet = (dir: 'up' | 'down') => {
    const idx = BET_OPTIONS.indexOf(betAmount);
    if (dir === 'up' && idx < BET_OPTIONS.length - 1) onBetChange(BET_OPTIONS[idx + 1]);
    if (dir === 'down' && idx > 0) onBetChange(BET_OPTIONS[idx - 1]);
  };

  return (
    <div className="glass rounded-xl p-4 animate-fade-in space-y-3">
      {/* Row 1: Balance + Token Mode + Reset */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <p className="font-mono text-xl font-bold text-foreground">
            {balance.toFixed(2)}
            <span className="text-xs text-muted-foreground ml-1">VOI</span>
          </p>
          <button
            onClick={onResetBalance}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Reset Balance"
          >
            <RotateCcw size={12} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Token</span>
          <button
            onClick={onTokenModeToggle}
            className={`w-9 h-5 rounded-full relative transition-colors ${
              tokenMode ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${
                tokenMode ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Row 2: Risk + Board Size + Bet Amount — all inline */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Risk */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Risk</p>
          <div className="grid grid-cols-3 gap-1">
            {riskOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => onRiskChange(opt.value)}
                className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  risk === opt.value
                    ? riskStyles[opt.value]
                    : 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Board Size */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Board Size</p>
          <div className="grid grid-cols-3 gap-1">
            {BOARD_SIZES.map(size => (
              <button
                key={size}
                onClick={() => onBoardRowsChange(size)}
                className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  boardRows === size
                    ? 'bg-accent/20 text-accent-foreground border-accent/40'
                    : 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Bet Amount */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Bet Amount</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => adjustBet('down')}
              className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground"
            >
              <Minus size={12} />
            </button>
            <div className="flex-1 text-center font-mono text-sm font-semibold text-foreground">
              {betAmount}
            </div>
            <button
              onClick={() => adjustBet('up')}
              className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground"
            >
              <Plus size={12} />
            </button>
          </div>
          <div className="flex gap-1 mt-1">
            {[0.1, 1, 5, 10, 50].map(v => (
              <button
                key={v}
                onClick={() => onBetChange(v)}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                  betAmount === v
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onDrop}
          disabled={!canBet}
          className={`flex-1 py-2.5 rounded-xl font-heading font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            canBet
              ? 'bg-primary text-primary-foreground hover:brightness-110 glow-primary active:scale-95'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          <Zap size={14} />
          Drop Ball
        </button>
        <button
          onClick={() => onDropMultiple(10)}
          disabled={balance < betAmount * 10}
          className="px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ×10
        </button>
        <button
          onClick={onAutoToggle}
          className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-colors ${
            autoMode
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {autoMode ? 'Stop' : 'Auto'}
        </button>
      </div>
    </div>
  );
}
