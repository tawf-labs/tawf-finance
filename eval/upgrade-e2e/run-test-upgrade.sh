#!/usr/bin/env bash
# Upgrade of the TEST stack RedemptionVault with state checks on both RPCs.
set -u
set -a; source ~/.tawf_sepolia.env; set +a
source eval/upgrade-e2e/lib.sh
V=0x24633dbc5a7972913F69b79AF962d27F8BC76A60; REG=0x8CDdbe7e2aDf2db608C18c1b6529aaD5518113f6
A=$POOL_ADMIN_ADDRESS; B=0x6155Aecb5eaB7719804F67De1E4ef878f0226f87
SLOT=0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
snap() { for r in $R1 $R2; do echo "[$r]"; cast storage $V $SLOT --rpc-url $r
  for c in "liabilities()(uint256)" "settlementToken()(address)" "dealNisbahBps(uint256) 1" "feeRecipient()(address)" "yieldRecipient()(address)" "swapRouter()(address)" "disbursedPrincipal(uint256)(uint96) 1"; do
    echo "$c => $(cast call $V $c --rpc-url $r)"; done
  echo "UPGRADER(admin) => $(cast call $V 'hasRole(bytes32,address)(bool)' $(cast keccak UPGRADER_ROLE) $A --rpc-url $r)"
  echo "OPS(admin) => $(cast call $V 'hasRole(bytes32,address)(bool)' $(cast keccak OPS_ROLE) $A --rpc-url $r)"
  echo "acceptedInput(usdc) => $(cast call $V 'acceptedInput(address)(bool)' 0x6010ee037A7Eb302235383770c0dAB9780C8Fe89 --rpc-url $r)"
  echo "acceptedInput(usdt) => $(cast call $V 'acceptedInput(address)(bool)' 0xaB23b6bE9C57C73EFbE4aB4b10Bf0951aF31c5D2 --rpc-url $r)"
  echo "deal1 => $(cast call $REG 'getDeal(uint256)' 1 --rpc-url $r | md5sum)"
  echo "deal1 status/funded => $(cast call $REG 'getDeal(uint256)((uint256,bytes32,string,string,address,uint96,uint32,uint96,uint96,uint96,uint32,uint8,uint256,uint256))' 1 --rpc-url $r 2>&1 | tr '\n' ' ' | head -c 300)"
done; }
snap > eval/upgrade-e2e/test_before_upgrade.txt
cd contracts
OUT=$(forge create src/RedemptionVault.sol:RedemptionVault --rpc-url $R1 --private-key "$POOL_ADMIN_KEY" --broadcast --json 2>/dev/null | grep -A5 '^{' | tr -d '\n')
cd ..
N=$(jq -r .deployedTo <<<"$OUT"); H=$(jq -r .transactionHash <<<"$OUT"); echo "new impl $N tx $H"
G=$(cast receipt $H gasUsed --rpc-url $R1); echo "test,deploy_new_vault_impl,$A,,$H,0x1,$G" >> $CSV
for r in $R1 $R2; do echo "burner upgrade sim on $r: $(cast call --rpc-url $r --from $B $V 'upgradeToAndCall(address,bytes)' $N 0x 2>&1 | tail -1)"; done
send test upgradeToAndCall_admin POOL_ADMIN_KEY $V "upgradeToAndCall(address,bytes)" $N 0x
snap > eval/upgrade-e2e/test_after_upgrade.txt
diff eval/upgrade-e2e/test_before_upgrade.txt eval/upgrade-e2e/test_after_upgrade.txt && echo NO_DIFF
