export const APP_ID = 49244777;
export const APP_ADDRESS = 'SMKJ3FDQGCSBWGHBGLS2REFEET5OARP32WLVHU3G2KHJ5OTKJFDLHZHL7Q';
export const HOUSE_ADDRESS = '6VUNCQFJRBVIEVHUSNXELX7NJPYTQJ2FUAYXD6DSPX3BK2A57X4JCYXEH4';
export const ALGOD_URL = 'https://mainnet-api.voi.nodely.dev';
export const ALGOD_TOKEN = '';
export const MIN_BET = 100_000; // 0.1 VOI in microVOI
export const MAX_BET = 100_000_000; // 100 VOI in microVOI
export const HOUSE_FEE_BPS = 300; // 3%

export const MULTIPLIERS = {
  low:  [5.6, 2.1, 1.1, 1.0, 0.7, 0.5, 0.4, 0.3, 0.4, 0.5, 0.7, 1.0, 1.1, 2.1, 5.6],
  mid:  [13.0, 3.0, 1.3, 0.7, 0.4, 0.3, 0.2, 0.2, 0.2, 0.3, 0.4, 0.7, 1.3, 3.0, 13.0],
  high: [29.0, 4.0, 1.5, 0.3, 0.2, 0.1, 0.05, 0.05, 0.05, 0.1, 0.2, 0.3, 1.5, 4.0, 29.0],
};

export const ROWS = 16; // 16-row board per Tycots contract
