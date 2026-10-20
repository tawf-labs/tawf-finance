#!/usr/bin/env bash
# Spec-strength check: run each mutant in certora/mutants/M*/ and confirm the
# rule named in its expect.txt turns Violated. A mutant that stays green means
# the spec is too weak to catch that bug.
#
# Usage (from contracts/): ./certora/mutate.sh [M1 M5 ...]
# Each run is a throwaway copy of the project with one src file swapped, so the
# real tree is never touched. Runs are serial (the prover wrapper holds a lock).
set -uo pipefail
cd "$(dirname "$0")/.."
root=$(pwd)
work=certora/mutants/_work
out=certora/out/mutants
mkdir -p "$out"
[ -d certora/munged ] || ./certora/munge.sh

ids=("$@")
[ ${#ids[@]} -eq 0 ] && ids=($(ls -d certora/mutants/M* | xargs -n1 basename))

# Which spec a mutant belongs to, from the last column of the README table.
spec_of() { grep -E "^\| $1 \|" certora/mutants/README.md | awk -F'|' '{gsub(/ /,"",$(NF-1)); print $(NF-1)}'; }

summary=()
for id in "${ids[@]}"; do
  dir=certora/mutants/$id
  file=$(ls "$dir"/*.sol | head -1)
  name=$(basename "$file")
  target=$(find src -name "$name" | head -1)
  comp=$(spec_of "$id")
  conf=certora/confs/autospec_pool_${comp}.conf
  rules=$(tr ',' ' ' < "$dir/expect.txt")

  rm -rf "$work" && mkdir -p "$work"
  cp -r src certora foundry.toml remappings.txt "$work"/ 2>/dev/null
  rm -rf "$work/certora/mutants" "$work/certora/out"
  ln -s "$root/lib" "$work/lib"
  # The mutant imports src via ../../../src/; inside the copy it sits at src/.
  sed -E 's#\.\./\.\./\.\./src/#./#g' "$file" > "$work/$target"

  log="$out/$id.log"
  rule_args=()
  for r in $rules; do rule_args+=(--rule "$r"); done
  (cd "$work" && ~/tools/bin/prove "$conf" "${rule_args[@]}" > "$root/$log" 2>&1)
  if tr -d '\r' < "$log" | grep -aE "^Failed on ($(echo $rules | tr ' ' '|')):" >/dev/null; then
    verdict="KILLED"
  elif tr -d '\r' < "$log" | grep -aqE "CRITICAL|had an error"; then
    verdict="ERROR"
  else
    verdict="SURVIVED"
  fi
  summary+=("$id $verdict ($comp: $rules)")
  echo "$id $verdict ($comp: $rules)"
done
rm -rf "$work"
printf '\n%s\n' "${summary[@]}" > "$out/summary.txt"
