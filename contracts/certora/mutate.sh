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
work=${MUTATE_WORKDIR:-$HOME/.cache/tawf-mutate-work}
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
  comps=$(spec_of "$id" | tr ',' ' ')
  rules=$(tr ',\n' '  ' < "$dir/expect.txt")

  rm -rf "$work" && mkdir -p "$work"
  cp -r src certora foundry.toml remappings.txt "$work"/ 2>/dev/null
  rm -rf "$work/certora/mutants" "$work/certora/out"
  [ -d "$work/certora/specs" ] || { echo "$id ERROR (copy failed)"; summary+=("$id ERROR (copy failed)"); continue; }
  ln -s "$root/lib" "$work/lib"
  # The mutant imports src via ../../../src/; inside the copy it sits at src/.
  sed -E 's#\.\./\.\./\.\./src/#./#g' "$file" > "$work/$target"

  verdict="SURVIVED"
  for comp in $comps; do
    conf=certora/confs/autospec_pool_${comp}.conf
    spec=certora/specs/autospec_pool_${comp}.spec
    rule_args=(); mine=()
    for r in $rules; do grep -qE "^(rule|invariant) $r\b" "$spec" && { rule_args+=(--rule "$r"); mine+=("$r"); }; done
    [ ${#mine[@]} -eq 0 ] && continue
    log="$out/${id}_${comp}.log"
    (cd "$work" && ~/tools/bin/prove "$conf" "${rule_args[@]}" > "$root/$log" 2>&1)
    pat=$(IFS='|'; echo "${mine[*]}")
    if tr -d '\r' < "$log" | grep -aqE "^Failed on ($pat):"; then
      verdict="KILLED"; break
    elif ! tr -d '\r' < "$log" | grep -aqE "^(Verified|Violated): "; then
      verdict="ERROR"
    fi
  done
  summary+=("$id $verdict ($comps: $rules)")
  echo "$id $verdict ($comps: $rules)"
done
rm -rf "$work"
printf '\n%s\n' "${summary[@]}" > "$out/summary.txt"
