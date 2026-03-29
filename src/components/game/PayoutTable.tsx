import { RiskLevel, BoardSize, PAYOUT_TABLES } from '@/config/gameConfig';

interface PayoutTableProps {
  risk: RiskLevel;
  rows: BoardSize;
}

export default function PayoutTable({ risk, rows }: PayoutTableProps) {
  const config = PAYOUT_TABLES[rows][risk];
  const half = Math.ceil(config.multipliers.length / 2);
  const uniqueMultipliers = config.multipliers.slice(0, half);

  return (
    <div className="glass rounded-xl p-4 animate-fade-in">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
        Payout Table — {risk.charAt(0).toUpperCase() + risk.slice(1)} Risk · {rows} Rows
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {uniqueMultipliers.map((mult, i) => {
          const isHighPayout = mult >= 2;
          const isMidPayout = mult >= 1;
          return (
            <div
              key={i}
              className={`px-2 py-1 rounded-md text-xs font-mono font-medium border ${
                isHighPayout
                  ? 'bg-win/10 text-win border-win/30'
                  : isMidPayout
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-secondary text-muted-foreground border-border'
              }`}
            >
              {mult}x
            </div>
          );
        })}
      </div>
    </div>
  );
}
