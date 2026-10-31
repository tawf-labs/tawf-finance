// Standard events only. UpgradeableBeacon is OpenZeppelin, the Safe events are from Safe v1.4.1.
export const BeaconAbi = [
  { type: 'event', name: 'Upgraded', inputs: [{ name: 'implementation', type: 'address', indexed: true }], anonymous: false },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'previousOwner', type: 'address', indexed: true },
      { name: 'newOwner', type: 'address', indexed: true },
    ],
    anonymous: false,
  },
] as const

export const SafeAbi = [
  { type: 'event', name: 'ExecutionSuccess', inputs: [{ name: 'txHash', type: 'bytes32', indexed: false }, { name: 'payment', type: 'uint256', indexed: false }], anonymous: false },
  { type: 'event', name: 'ExecutionFailure', inputs: [{ name: 'txHash', type: 'bytes32', indexed: false }, { name: 'payment', type: 'uint256', indexed: false }], anonymous: false },
  { type: 'event', name: 'AddedOwner', inputs: [{ name: 'owner', type: 'address', indexed: true }], anonymous: false },
  { type: 'event', name: 'RemovedOwner', inputs: [{ name: 'owner', type: 'address', indexed: true }], anonymous: false },
  { type: 'event', name: 'ChangedThreshold', inputs: [{ name: 'threshold', type: 'uint256', indexed: false }], anonymous: false },
] as const
