// ERC-735 claim events of an OnchainID Identity (IERC735). The token ONCHAINIDs carry the originator, platform,
// tokenization partner and offering document claims, topics 10 to 13.
const claimEvent = (name: 'ClaimAdded' | 'ClaimRemoved' | 'ClaimChanged') =>
  ({
    type: 'event',
    name,
    inputs: [
      { name: 'claimId', type: 'bytes32', indexed: true },
      { name: 'topic', type: 'uint256', indexed: true },
      { name: 'scheme', type: 'uint256', indexed: false },
      { name: 'issuer', type: 'address', indexed: true },
      { name: 'signature', type: 'bytes', indexed: false },
      { name: 'data', type: 'bytes', indexed: false },
      { name: 'uri', type: 'string', indexed: false },
    ],
    anonymous: false,
  }) as const

export const TokenIdentityAbi = [claimEvent('ClaimAdded'), claimEvent('ClaimRemoved'), claimEvent('ClaimChanged')] as const
