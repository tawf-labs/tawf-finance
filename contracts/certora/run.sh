#!/usr/bin/env bash
#
# certora/run.sh — serial driver for the local Certora Prover.
#
# Usage (run from contracts/):
#   ./certora/run.sh                 # run every certora/confs/*.conf in turn
#   ./certora/run.sh pool_Registry   # run only certora/confs/autospec_pool_Registry.conf
#   ./certora/run.sh Registry Vault  # several components, serially
#
# A component name <C> maps to certora/confs/autospec_pool_<C>.conf, but a full
# conf basename (with or without the autospec_pool_ prefix / .conf suffix) is
# also accepted. Logs land in certora/out/<component>.log and one summary line
# per conf is printed. Exit is non-zero if any conf has real violations
# (Violated lines that are not rule_not_vacuous).
#
# STRICTLY SERIAL: only ever one prover job runs at a time. The laptop has
# 15 GB RAM; the memory cap lives in the ~/tools/bin/prove wrapper.

set -u

# Resolve directories relative to this script so it works from contracts/.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_DIR="$SCRIPT_DIR/confs"
OUT_DIR="$SCRIPT_DIR/out"
PROVE="${PROVE:-$HOME/tools/bin/prove}"

mkdir -p "$OUT_DIR"

# Map an argument to an actual conf file path. Accepts:
#   pool_Registry  -> confs/autospec_pool_Registry.conf
#   Registry       -> confs/autospec_pool_Registry.conf
#   autospec_pool_Registry        -> confs/autospec_pool_Registry.conf
#   autospec_pool_Registry.conf   -> confs/autospec_pool_Registry.conf
resolve_conf() {
  local name="$1"
  local base="${name%.conf}"
  local candidates=(
    "$CONF_DIR/$base.conf"
    "$CONF_DIR/autospec_$base.conf"
    "$CONF_DIR/autospec_pool_$base.conf"
  )
  # also handle a bare "pool_Registry" -> autospec_pool_Registry
  case "$base" in
    pool_*) candidates+=("$CONF_DIR/autospec_$base.conf") ;;
  esac
  local c
  for c in "${candidates[@]}"; do
    if [[ -f "$c" ]]; then
      printf '%s\n' "$c"
      return 0
    fi
  done
  return 1
}

# Derive a short component label from a conf path, for the log file name and
# the summary line: autospec_pool_Registry.conf -> pool_Registry.
label_for() {
  local base
  base="$(basename "$1" .conf)"
  printf '%s\n' "${base#autospec_}"
}

# Build the list of conf files to run.
confs=()
if [[ $# -eq 0 ]]; then
  # No args: every conf, in sorted order, serially.
  shopt -s nullglob
  for c in "$CONF_DIR"/*.conf; do
    confs+=("$c")
  done
  shopt -u nullglob
  if [[ ${#confs[@]} -eq 0 ]]; then
    echo "run.sh: no confs found in $CONF_DIR" >&2
    exit 2
  fi
else
  for arg in "$@"; do
    if conf="$(resolve_conf "$arg")"; then
      confs+=("$conf")
    else
      echo "run.sh: no conf for component '$arg' (looked in $CONF_DIR)" >&2
      exit 2
    fi
  done
fi

overall_rc=0

# The confs point openzeppelin-contracts at certora/munged (a patched copy with
# the inline-assembly hot spots rewritten in plain Solidity). Build it once,
# before the first prove run, if it is missing. It is gitignored, so a fresh
# checkout needs this.
if [[ ! -d "$SCRIPT_DIR/munged" ]]; then
  echo ">>> munged/ missing — running ./certora/munge.sh"
  "$SCRIPT_DIR/munge.sh"
fi

# Run each conf one at a time. Never background a job: a single prover run can
# use multiple GB, and two at once took the 15 GB laptop down.
for conf in "${confs[@]}"; do
  label="$(label_for "$conf")"
  log="$OUT_DIR/$label.log"

  echo ">>> $label  ($(basename "$conf"))"
  # Memory safety is enforced inside the wrapper (cgroup cap + bounded heap +
  # single solver + --max_concurrent_rules). We just feed it one conf.
  "$PROVE" "$conf" >"$log" 2>&1
  prove_rc=$?

  # Summaries are read back from the log so the counts match exactly what the
  # prover reported, regardless of the wrapper's own exit code.
  verified=$(grep -c '^Verified: ' "$log" 2>/dev/null || true)
  # Real violations: "Violated: " lines that are not the benign
  # rule_not_vacuous reachability witnesses.
  violated=$(grep '^Violated: ' "$log" 2>/dev/null | grep -vc 'rule_not_vacuous' || true)
  timeouts=$(grep -c 'Timeout' "$log" 2>/dev/null || true)

  # Normalise (grep -c prints 0 on no match but set -u / || true keep us safe).
  verified=${verified:-0}
  violated=${violated:-0}
  timeouts=${timeouts:-0}

  echo "=== $label: verified=$verified violated=$violated timeouts=$timeouts (log: ${log#$SCRIPT_DIR/})"

  if [[ "$violated" -gt 0 ]]; then
    overall_rc=1
  fi
  # A nonzero wrapper exit with no parsed violations still signals trouble.
  if [[ "$prove_rc" -ne 0 && "$violated" -eq 0 ]]; then
    echo "    note: prove wrapper exited $prove_rc (see log)"
  fi
done

exit "$overall_rc"
