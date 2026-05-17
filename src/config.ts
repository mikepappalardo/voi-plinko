export const APP_ID = 49251639;
export const APP_ADDRESS = 'FVE2KVUTPZELD2EKM36UALXFCQMSIEQH6QJLYJW7BLNTR5MX2UZIPQ3HIA';
export const HOUSE_ADDRESS = 'FJGK236YTKQ5UZRYJK5HQIKL2PSSFO3TWWVL4XIJDFTH3CBSRGURDUFVRA';
export const ALGOD_URL = 'https://mainnet-api.voi.nodely.dev';
export const ALGOD_TOKEN = '';
export const MIN_BET = 100_000;
export const MAX_BET = 1_000_000_000;
export const HOUSE_FEE_BPS = 300;

// Exact contract multipliers (17 buckets, symmetric)
export const MULTIPLIERS = {
  low:  [1.08, 1.02, 0.98, 0.96, 0.94, 0.92, 0.90, 0.88, 0.88, 0.88, 0.90, 0.92, 0.94, 0.96, 0.98, 1.02, 1.08],
  mid:  [2.55, 1.58, 1.05, 0.78, 0.58, 0.48, 0.38, 0.32, 0.28, 0.32, 0.38, 0.48, 0.58, 0.78, 1.05, 1.58, 2.55],
  high: [4.35, 2.45, 1.05, 0.55, 0.32, 0.18, 0.12, 0.08, 0.05, 0.08, 0.12, 0.18, 0.32, 0.55, 1.05, 2.45, 4.35],
};

export const ROWS = 16;
