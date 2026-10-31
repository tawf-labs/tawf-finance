import { parseAbi } from 'viem'

// The first SCF offering (single coin). Kept so its history still reads. Copied from api/_tokenization/_lib/activity-core.ts.
export const SukukDistributorV1Abi = parseAbi([
  'event Subscribed(address indexed investor, uint256 amount)',
  'event Refunded(address indexed investor, uint256 amount)',
  'event ProfitDistributed(uint16 indexed period, uint256 amount)',
  'event ProfitClaimed(address indexed investor, uint256 amount)',
  'event MaturitySettled(uint256 amount)',
  'event Redeemed(address indexed investor, uint256 units, uint256 principalPaid, uint256 profitPaid)',
])
