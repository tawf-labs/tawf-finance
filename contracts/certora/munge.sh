#!/usr/bin/env bash
# Builds a verification-only copy of OpenZeppelin under certora/munged/ with
# the inline assembly the prover cannot track replaced by plain Solidity
# (Certora guide "Designing Solidity Contracts That Don't Fight Formal
# Verification", section 1.4). Production builds never see this copy.
set -euo pipefail
cd "$(dirname "$0")/.."
src=lib/openzeppelin-contracts
dst=certora/munged/openzeppelin-contracts
rm -rf "$dst" && mkdir -p "$dst"
cp -r "$src/contracts" "$dst/contracts"
python3 - "$dst/contracts" <<'PY'
import re, sys
root = sys.argv[1]

def patch(path, pattern, repl, expect):
    s = open(path).read()
    s, n = re.subn(pattern, repl, s, flags=re.S)
    if n != expect:
        sys.exit(f"munge: expected {expect} match(es) in {path}, got {n}")
    open(path, "w").write(s)

# ERC1155._asSingletonArrays: free-memory-pointer assembly -> two new arrays.
patch(f"{root}/token/ERC1155/ERC1155.sol",
      r'(returns \(uint256\[\] memory array1, uint256\[\] memory array2\) \{)\s*assembly \("memory-safe"\) \{.*?mstore\(0x40, add\(array2, 0x40\)\)\s*\}',
      r'\1\n        array1 = new uint256[](1);\n        array1[0] = element1;\n        array2 = new uint256[](1);\n        array2[0] = element2;',
      1)

# Arrays.unsafeMemoryAccess (all 5 memory overloads): mload -> bounds-checked index.
patch(f"{root}/utils/Arrays.sol",
      r'(function unsafeMemoryAccess\((\w+(?:\[\])?) memory arr, uint256 pos\) internal pure returns \([^)]*\) \{)\s*assembly \{\s*res := mload\(add\(add\(arr, 0x20\), mul\(pos, 0x20\)\)\)\s*\}',
      r'\1\n        res = arr[pos];',
      5)
PY
echo "munged OpenZeppelin ready at $dst"
