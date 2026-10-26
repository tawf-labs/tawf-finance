#!/usr/bin/env bash
# Full lifecycle on the TEST stack (mock KYC registry, mock USDG). Keys come from ~/.tawf_sepolia.env, never printed.
set -u
set -a; source ~/.tawf_sepolia.env; set +a
export TESTNET_PRIVATE_KEY=${TESTNET_PRIVATE_KEY/0x0x/0x}
source eval/upgrade-e2e/lib.sh
V=0x24633dbc5a7972913F69b79AF962d27F8BC76A60; REG=0x8CDdbe7e2aDf2db608C18c1b6529aaD5518113f6; NFT=0x21e1842ADad7722e0A4c18D3efA1dd45904aFd81
G=0xd1E5B1dF3071c8e58C7a582b2A8ABABee2198679; UC=0x6010ee037A7Eb302235383770c0dAB9780C8Fe89; UT=0xaB23b6bE9C57C73EFbE4aB4b10Bf0951aF31c5D2
B=0x6155Aecb5eaB7719804F67De1E4ef878f0226f87; A=$POOL_ADMIN_ADDRESS; FEE=$(cat /tmp/claude-1000/fee2.addr)
S=test
send $S createDeal POOL_ADMIN_KEY $REG "createDeal(bytes32,string,string,address,uint96,uint32,uint96,uint96)" $(cast keccak e2e-test-deal) "E2E Supplier" "E2E Buyer" $A 1200 30 10000000 1000000000
send $S approveDeal POOL_ADMIN_KEY $REG "approveDeal(uint256)" 1
send $S setDealNisbah POOL_ADMIN_KEY $V "setDealNisbah(uint256,uint16)" 1 1500
send $S markMintable POOL_ADMIN_KEY $REG "markMintable(uint256)" 1
send $S burner_faucet_usdg TESTNET_PRIVATE_KEY $G "faucet(uint256)" 100000000
send $S burner_faucet_usdc TESTNET_PRIVATE_KEY $UC "faucet(uint256)" 100000000
send $S burner_faucet_usdt TESTNET_PRIVATE_KEY $UT "faucet(uint256)" 100000000
for t in $G $UC $UT; do send $S burner_approve TESTNET_PRIVATE_KEY $t "approve(address,uint256)" $V 100000000; done
send $S invest_usdg TESTNET_PRIVATE_KEY $V "investWithToken(uint256,address,uint96)" 1 $G 100000000
send $S invest_usdc_swap TESTNET_PRIVATE_KEY $V "investWithToken(uint256,address,uint96)" 1 $UC 100000000
send $S invest_usdt_swap TESTNET_PRIVATE_KEY $V "investWithToken(uint256,address,uint96)" 1 $UT 100000000
echo "== after invest"; both $V "liabilities()(uint256)"; both $G "balanceOf(address)(uint256)" $V; both $V "payoutFor(uint256,address)(uint256)" 1 $B
send $S admin_faucet_usdg POOL_ADMIN_KEY $G "faucet(uint256)" 20000000
send $S admin_approve_usdg POOL_ADMIN_KEY $G "approve(address,uint256)" $V 20000000
send $S repay POOL_ADMIN_KEY $V "repay(uint256,uint96)" 1 306000000
echo "== after repay"; both $V "liabilities()(uint256)"; both $G "balanceOf(address)(uint256)" $FEE
both $V "payoutFor(uint256,address)(uint256)" 1 $B
send $S redeem TESTNET_PRIVATE_KEY $V "redeem(uint256)" 1
echo "== after redeem"; both $G "balanceOf(address)(uint256)" $B; both $V "liabilities()(uint256)"; both $V "surplus()(uint256)"
send $S surplus_transfer_to_vault POOL_ADMIN_KEY $G "transfer(address,uint256)" $V 5000000
both $V "surplus()(uint256)"
send $S sweepYield POOL_ADMIN_KEY $V "sweepYield()"
echo "== after sweep"; both $G "balanceOf(address)(uint256)" $FEE; both $V "surplus()(uint256)"; both $G "balanceOf(address)(uint256)" $V
