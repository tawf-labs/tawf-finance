# Upgradeable pool stack: Arbitrum Sepolia end-to-end results

Chain 421614. Run date 2026-10-27. Primary RPC https://sepolia-rollup.arbitrum.io/rpc, cross-check RPC https://arbitrum-sepolia-rpc.publicnode.com. Every read below was made on both and matched.

## Read this first

- **USDG was a mock.** Both stacks settle in a freshly deployed 6 decimal MockUSDC-style token. The real Paxos USDG (`0xFFC95faa3d63Cde504a05B567C600B78C0b41892`) is untouched and stays under `usdg` in the deployments file. Moving to real USDG needs faucet funds from faucet.paxos.com and a real or funded swap router, because the MockSwapRouter pays out of its own balance.
- **Live stack investors must be verified by the real operator** `0x1273620bA09fCD788A09B3049666141F28cD313F` through the app KYC flow. The live stack uses the shared ERC-3643 identity registry `0x2aBdc925E9cEAe109D22E4352C8d84e91eB00b00`, and nobody in this run held the key to verify an investor there.
- **The full lifecycle was proven on a separate TEST stack** wired to a minimal allow-list KYC contract (`AllowListRegistry` in `contracts/script/e2e/DeployTestStack.s.sol`). The test stack is not recorded in `tokenization.deployments.json`.
- Admin, upgrader and ops holder on both stacks is the fresh key `0xbE4959A1fA20c70ab24545506E00CE60970b16aC`. The burner `0x6155Aecb5eaB7719804F67De1E4ef878f0226f87` holds no role on either stack. It was used only as a test investor and as the non-upgrader in the access checks. Fee, yield and negligence addresses are throwaway addresses whose keys were discarded.

## Live stack (recorded in tokenization.deployments.json)

| Contract | Address |
|---|---|
| DealRegistry proxy | `0x73E7Fe80e714FDD1eb3447A63c8988A7fd693968` |
| BondReceiptNFT proxy | `0x2c22c7BDdbB0aa5920A2439A44F1dbE10Dc8bf9F` |
| RedemptionVault proxy | `0x330276397651be3CdfEdb61B31efdc9e068ECAa8` |
| DealRegistry implementation | `0x31d5928d3c953998202d2f05a8eec3dd5846618a` |
| BondReceiptNFT implementation | `0x770b224a9d87dcd5de178d3223269a9eca9f6394` |
| RedemptionVault implementation (initial) | `0x715a4f1c4a46df43516e9df4fd43362184e6642f` |
| RedemptionVault implementation (after upgrade) | `0x5AB35AE2f4fae0A40F29ac52fed25C8016490B4e` |
| Mock USDG (settlement) | `0x10962b65Ad725CD7257A1D137eAF555748D92D20` |
| MockSwapRouter | `0x091892374a3C6d620F6175dAB05b06620A229489` |
| Identity registry (shared, real) | `0x2aBdc925E9cEAe109D22E4352C8d84e91eB00b00` |
| mockUsdc, mockUsdt (reused) | `0x6010ee037A7Eb302235383770c0dAB9780C8Fe89`, `0xaB23b6bE9C57C73EFbE4aB4b10Bf0951aF31c5D2` |

Old pool addresses are kept as `legacyPoolDealRegistry`, `legacyPoolBondReceiptNft` and `legacyPoolRedemptionVault`. New keys: `mockUsdg`, `swapRouter`, and `usdg` (real Paxos address, added because the file had no such key).

Deploy: `DeployPool.s.sol` with `MOCK_USDG=1 --broadcast --slow`. It ran in one pass, 39 transactions, all 39 receipts status 1. The batched-broadcast problem from the earlier run did not recur.

### Checks on the live stack

| Check | Result |
|---|---|
| (a) `cast code` non-empty on both RPCs for 3 proxies, 3 implementations, mock USDG, router | Pass |
| (b) settlement token is mock USDG, router set, slippage 50 bps, USDC and USDT accepted, yield and fee recipient set, 3 seeded deals, identity registry is the shared one, admin holds UPGRADER_ROLE on all three proxies, router holds 100000 mock USDG | Pass on both RPCs |
| (b) burner holds no ADMIN, OPS or UPGRADER role | Pass |
| (c) `invest(1, 100 USDG)` from the unverified burner (after faucet and approve, `cast call --from`) | Reverts `NotVerified(0x6155...6f87)` (selector `0xb12c8f91`) on both RPCs |
| (d) `upgradeToAndCall(newImpl, "")` from admin | Success, tx `0x5d404932cf0e354a876ae0a6522d71c2188a56e0eb90da283aabb5eed4027966` |
| (d) state before and after the upgrade (liabilities, settlement token, nisbah of deal 1, router, upgrader role, hash of deal 1) | Identical on both RPCs, only the ERC1967 implementation slot changed (`eval/upgrade-e2e/live_before_upgrade.txt`, `live_after_upgrade.txt`) |
| (d) `cast call --from <burner> upgradeToAndCall(...)` | Reverts `AccessControlUnauthorizedAccount(burner, UPGRADER_ROLE)` on both RPCs |

Not proven on the live stack: any successful invest, repay, redeem or sweep, because no verified investor exists there.

## Test stack (not in the deployments file)

| Contract | Address |
|---|---|
| AllowListRegistry (mock KYC, owner is admin, burner verified at deploy) | `0x7d839B49411470609CA168b4A97b62840358Fc40` |
| Mock USDG | `0xd1E5B1dF3071c8e58C7a582b2A8ABABee2198679` |
| MockSwapRouter (100000 mock USDG) | `0x645B010Ba587a06d6159F75aFb5a766909824915` |
| DealRegistry proxy | `0x8CDdbe7e2aDf2db608C18c1b6529aaD5518113f6` |
| BondReceiptNFT proxy | `0x21e1842ADad7722e0A4c18D3efA1dd45904aFd81` |
| RedemptionVault proxy | `0x24633dbc5a7972913F69b79AF962d27F8BC76A60` |
| RedemptionVault implementation (initial, after upgrade) | `0xe8530689f9872fc6f72751f749183b4d7494cc4c`, `0x6fAA706183c6bE217fbbBbF9b021aC47E9325a73` |

Deploy: `script/e2e/DeployTestStack.s.sol`, 29 transactions, all status 1, code present on both RPCs.

### Lifecycle (deal 1, target 1000, nisbah 15 percent, burner as investor)

| Step | Result |
|---|---|
| createDeal, approveDeal, setDealNisbah, markMintable | Pass |
| invest 100 mock USDG with `investWithToken` | Pass, tx `0x6c691121c9c79bb98d3bbbb6f7883ae06dda17e17587edefd29bcf196bd3f252` |
| invest 100 USDC, swapped to USDG | Pass, tx `0x34598e45611c6557e195d74c84043481c3580f08fbe34f48dc9bb103bedf1513` |
| invest 100 USDT, swapped to USDG | Pass, tx `0x969f6590495320fa58c159d85e47052d499ca9202b6e7b22d327a3c41844f5d7` |
| After the three invests | liabilities 300000000, vault USDG balance 300000000, burner payout preview 300000000, same on both RPCs |
| repay 306 (6 profit) | Pass, tx `0x575b1625e4728956cb8176025fa6e97c520dee0f25c463c09ae3d8c8ae13d1bd`. Tawf share 0.9 sent to the fee recipient, liabilities 305100000 |
| redeem | Pass, tx `0xd277869e4ac9519f0d105f90a98bb820df463bfde3439971930cd755cb01e0b7`. Burner received 305100000, liabilities 0, surplus 0 |
| send 5 USDG surplus to the vault, then `sweepYield` | Pass, tx `0x0734e2b39200fd65c94229f270f0929fe4656b4c3c1accfb571cb70e10d18f1d`. Yield recipient balance 5900000 (0.9 share plus 5 swept), vault balance 0, surplus 0 |
| Upgrade RedemptionVault with `upgradeToAndCall` from admin | Pass, tx `0x188793b66b098e1ecd19c35d383fce1b2d7f6847ccced57523441bc0c02cc916` |
| State after upgrade (liabilities, nisbah, recipients, router, input tokens, roles, deal 1 data and status) | Identical on both RPCs, only the implementation slot changed (`test_before_upgrade.txt`, `test_after_upgrade.txt`) |
| `cast call --from <burner> upgradeToAndCall(...)` | Reverts `AccessControlUnauthorizedAccount(burner, UPGRADER_ROLE)` on both RPCs |

The post-upgrade state check covers reads only. No invest or redeem was run after the upgrade.

## Failures and notes

- One `forge create` attempt printed a parse error and sent nothing. It was a stderr noise problem in my parsing, not a chain failure. The retry deployed the implementation.
- `invest` on deal id 0 reverts with a deal-not-found style error because ids start at 1. The NotVerified check used deal 1.
- `forge build` was slow (several minutes) because other agents were building in the same tree.
- No transaction reverted on chain. All 93 recorded transactions have status 1.
- Both new implementations are byte identical to the old one in source terms, so the upgrade shows the mechanism and state survival, not new behavior.

## Files

- Changed: `contracts/script/DeployPool.s.sol` (a mock settlement token now goes under `mockUsdg`, `usdg` is reserved for the real token), `tawf-finance/src/web3/tokenization.deployments.json`, `tawf-finance/src/web3/abis/{RedemptionVault,DealRegistry,BondReceiptNFT}.json`.
- New: `contracts/script/e2e/DeployTestStack.s.sol`, everything in `eval/upgrade-e2e/`.
- `txs.csv` lists every transaction with stack, label, sender, target, hash, status and gas used. Gas is the L2 gas figure from the receipt.
