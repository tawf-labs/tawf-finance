// Standard events only. UpgradeableBeacon and TimelockController are OpenZeppelin, the Safe events are from Safe v1.4.1.
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

export const TimelockAbi = [
  {
    type: 'event',
    name: 'CallScheduled',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'index', type: 'uint256', indexed: true },
      { name: 'target', type: 'address', indexed: false },
      { name: 'value', type: 'uint256', indexed: false },
      { name: 'data', type: 'bytes', indexed: false },
      { name: 'predecessor', type: 'bytes32', indexed: false },
      { name: 'delay', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CallExecuted',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'index', type: 'uint256', indexed: true },
      { name: 'target', type: 'address', indexed: false },
      { name: 'value', type: 'uint256', indexed: false },
      { name: 'data', type: 'bytes', indexed: false },
    ],
    anonymous: false,
  },
  { type: 'event', name: 'Cancelled', inputs: [{ name: 'id', type: 'bytes32', indexed: true }], anonymous: false },
] as const
