export const USDC_ABI = [
  {
    "constant": false,
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "recipient", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export const ESCROW_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "seller", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "uint256", "name": "timeLockDuration", "type": "uint256" }
    ],
    "name": "createEscrow",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export const CONTRACT_ADDRESS: `0x${string}` = '0x1df8a5f2484fc168ab6aa5345f8ebda7201106bc';
export const USDC_ADDRESS: `0x${string}` = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
export const TREASURY_ADDRESS: `0x${string}` = '0x6a83a5eb5cf378b65ec20047eac937d5ba09aa5b';
