#!/usr/bin/env python3
"""Shared config + cast helpers for the local-Anvil disbursement prototype.

LOCAL ANVIL ONLY. Reads eval/agent/onchain/deployment.local.json, which is
gitignored and written by anvil_up.sh. Never contains testnet/mainnet keys.
Stdlib only.
"""
import hashlib, json, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
DEPLOYMENT = os.path.join(HERE, "deployment.local.json")

# Hard guard: the prototype is local-only. We refuse any non-local RPC.
_LOCAL_RPC_RE = re.compile(r"^http://(127\.0\.0\.1|localhost):\d+/?$")


def load_cfg(path=DEPLOYMENT):
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"{path} not found. Run eval/agent/onchain/anvil_up.sh first to start Anvil and deploy the prototype."
        )
    cfg = json.load(open(path))
    rpc = cfg.get("rpc_url", "")
    if not _LOCAL_RPC_RE.match(rpc):
        raise ValueError(f"refusing non-local RPC {rpc!r}; this prototype is local-Anvil only")
    return cfg


def sha256_hex(text: str) -> str:
    """0x-prefixed sha256 digest, used for evidence and reasons hashes."""
    return "0x" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def cast(args, rpc_url=None, check=True, capture=True):
    """Run a `cast` subcommand. Returns stripped stdout."""
    cmd = ["cast"] + args
    if rpc_url and "--rpc-url" not in args:
        cmd += ["--rpc-url", rpc_url]
    r = subprocess.run(cmd, capture_output=capture, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"cast {' '.join(args[:2])} failed: {r.stderr.strip() or r.stdout.strip()}")
    return r.stdout.strip() if capture else ""


def cast_call(cfg, sig, *call_args):
    """Read-only `cast call` against the verifier."""
    return cast(["call", cfg["verifier"], sig, *map(str, call_args)], rpc_url=cfg["rpc_url"])


def cast_send(cfg, private_key, sig, *call_args):
    """State-changing `cast send` against the verifier. Returns the tx hash."""
    out = cast(
        ["send", cfg["verifier"], sig, *map(str, call_args), "--private-key", private_key, "--json"],
        rpc_url=cfg["rpc_url"],
    )
    try:
        return json.loads(out).get("transactionHash")
    except json.JSONDecodeError:
        return out


if __name__ == "__main__":
    c = load_cfg()
    print("verifier:", c["verifier"], "rpc:", c["rpc_url"])
