#!/usr/bin/env python3
"""Deterministic synthetic case generator for the reference disbursement-verification agent.

Run: python3 generate_cases.py   (seed fixed, writes cases.jsonl)
All names, numbers and documents are invented. Generator rules are documented in RESULTS.md.
"""
import json, random, os

SEED = 20261007
rng = random.Random(SEED)

VENDORS = ["Toko Sumber Rejeki", "CV Maju Bersama", "UD Tani Makmur", "PT Berkah Pangan Nusantara", "Toko Sinar Baru",
           "CV Cahaya Mandiri", "UD Barokah Jaya", "Toko Segar Abadi", "CV Lancar Sejahtera", "UD Harapan Kita",
           "PT Mitra Grosir Sentosa", "Toko Anugerah Utama"]
OFFLIST = ["CV Bintang Elektronik", "Toko Motor Jaya Abadi", "PT Karya Wisata Indah", "UD Mega Gadget", "Toko Emas Permata",
           "CV Sinar Properti", "Toko Pakaian Fashion Kita", "UD Bintang Timur"]

# Akad purposes: allowed item categories and catalogue (name, unit price IDR)
PURPOSES = {
    "working capital for staple food retail": {
        "ok": [("beras 25kg", 310000), ("minyak goreng 5L", 88000), ("gula pasir 50kg", 640000), ("telur 30 butir", 56000),
               ("tepung terigu 25kg", 215000), ("mi instan dus", 118000), ("garam 1kg x20", 60000)],
        "bad": [("sepeda motor bekas", 9500000), ("televisi 32 inch", 2400000), ("smartphone", 3100000), ("perhiasan emas", 5200000)]},
    "working capital for market vegetable and fruit trading": {
        "ok": [("bawang merah 10kg", 420000), ("cabai rawit 5kg", 350000), ("tomat 20kg", 260000), ("jeruk 1 peti", 480000),
               ("kentang 25kg", 375000), ("wortel 20kg", 230000)],
        "bad": [("laptop", 7800000), ("sepeda motor bekas", 9500000), ("mesin cuci", 3200000), ("tiket wisata rombongan", 4500000)]},
    "equipment purchase for a small sewing workshop": {
        "ok": [("kain katun 50m", 900000), ("benang jahit 1 lusin", 180000), ("mesin jahit portabel", 1850000), ("kancing 1 gross", 95000),
               ("resleting 100 pcs", 150000)],
        "bad": [("televisi 43 inch", 3900000), ("perhiasan emas", 5200000), ("smartphone", 3100000), ("pupuk 1 ton", 6000000)]},
}
PURPOSE_NAMES = list(PURPOSES)

MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]


def fmt_idr(n):
    return "Rp " + f"{n:,}".replace(",", ".")


def fmt_date(d, style):
    y, m, dd = d
    if style == 0: return f"{y:04d}-{m:02d}-{dd:02d}"
    if style == 1: return f"{dd:02d}/{m:02d}/{y:04d}"
    return f"{dd} {MONTHS[m-1]} {y}"


def add_days(d, n):
    import datetime
    x = datetime.date(*d) + datetime.timedelta(days=n)
    return (x.year, x.month, x.day)


def style_vendor(name, style):
    return [name, name.upper(), name.title()][style]


def make_items(purpose, cat="ok", n_items=None):
    cat_items = PURPOSES[purpose][cat]
    k = n_items or rng.randint(1, 3)
    picks = rng.sample(cat_items, min(k, len(cat_items)))
    items = []
    for name, price in picks:
        qty = rng.randint(1, 6) if price < 1_000_000 else 1
        items.append({"item": name, "qty": qty, "unit_price": price})
    return items


def total(items):
    return sum(i["qty"] * i["unit_price"] for i in items)


def new_inv_no(prefix):
    return f"{prefix}/{rng.randint(2025,2026)}/{rng.randint(1000,9999)}"


def base_case(idx):
    purpose = rng.choice(PURPOSE_NAMES)
    approved = rng.sample(VENDORS, 4)
    vendor = rng.choice(approved)
    ws = (2026, rng.randint(1, 8), rng.randint(1, 20))
    window = {"start": ws, "end": add_days(ws, rng.choice([14, 21, 30]))}
    span = (__import__("datetime").date(*window["end"]) - __import__("datetime").date(*window["start"])).days
    inv_date = add_days(window["start"], rng.randint(0, span))
    items = make_items(purpose)
    amt = total(items)
    prefix = "".join(w[0] for w in vendor.split()[1:3]).upper() or "INV"
    c = {
        "purpose": purpose, "approved_vendors": approved, "tranche_window": window,
        "tranche_ceiling": int(amt * rng.choice([1.1, 1.25, 1.5])),
        "vendor": vendor, "invoice_no": new_inv_no(prefix), "invoice_date": inv_date,
        "items": items, "invoice_total": amt, "transfer_amount": amt,
        "transfer_date": add_days(inv_date, rng.randint(0, 2)), "transfer_to": vendor,
        "ledger": [], "style": rng.randint(0, 2), "vstyle": rng.randint(0, 2),
    }
    # Prior accepted invoices (distractors): other vendors/dates/amounts, never matching the current one
    for _ in range(rng.randint(2, 5)):
        pv = rng.choice(approved)
        pi = make_items(purpose)
        c["ledger"].append({"vendor": pv, "invoice_no": new_inv_no("".join(w[0] for w in pv.split()[1:3]).upper() or "INV"),
                            "date": add_days(window["start"], -rng.randint(20, 120)), "total": total(pi),
                            "items": [i["item"] for i in pi]})
    return c


def render(c):
    """Turn a case dict into the documents the agent sees. Labels never appear here."""
    s = c["style"]
    inv_lines = "\n".join(f"  - {i['item']} x{i['qty']} @ {fmt_idr(i['unit_price'])} = {fmt_idr(i['qty']*i['unit_price'])}" for i in c["items"])
    invoice = (f"INVOICE\nVendor: {style_vendor(c['vendor'], c['vstyle'])}\nInvoice no: {c['invoice_no']}\n"
               f"Date: {fmt_date(c['invoice_date'], s)}\nItems:\n{inv_lines}\nTOTAL: {fmt_idr(c['invoice_total'])}")
    stmt = (f"BANK TRANSFER STATEMENT\nDate: {fmt_date(c['transfer_date'], s)}\nBeneficiary: {style_vendor(c['transfer_to'], c['vstyle'])}\n"
            f"Amount: {fmt_idr(c['transfer_amount'])}\nReference: tranche disbursement payment")
    proposal = (f"APPROVED PROPOSAL\nAkad purpose: {c['purpose']}\nApproved vendors: " + "; ".join(c["approved_vendors"]) +
                f"\nTranche window: {fmt_date(c['tranche_window']['start'], s)} to {fmt_date(c['tranche_window']['end'], s)} (inclusive)"
                f"\nTranche ceiling: {fmt_idr(c['tranche_ceiling'])}")
    ledger = "ACCEPTED INVOICE LEDGER (earlier tranches)\n" + ("\n".join(
        f"  - {e['vendor']} | {e['invoice_no']} | {fmt_date(e['date'], s)} | {fmt_idr(e['total'])} | {', '.join(e['items'])}" for e in c["ledger"]) or "  (empty)")
    return {"proposal": proposal, "invoice": invoice, "statement": stmt, "ledger": ledger}


# --- Mismatch mutators. Each returns the mutated case. ---
def m_amount(c, hard):
    delta = rng.uniform(0.01, 0.049) if hard else rng.uniform(0.10, 0.60)
    sign = rng.choice([1, -1])
    c["transfer_amount"] = max(1000, int(round(c["invoice_total"] * (1 + sign * delta), -2)))
    if c["transfer_amount"] == c["invoice_total"]:
        c["transfer_amount"] += 100 * rng.choice([1, 2, 3])
    c["tranche_ceiling"] = max(c["tranche_ceiling"], c["transfer_amount"])  # keep ceiling from being the giveaway
    return c


def m_dup(c, near):
    pv = c["vendor"]
    entry = {"vendor": pv, "invoice_no": c["invoice_no"], "date": c["invoice_date"], "total": c["invoice_total"],
             "items": [i["item"] for i in c["items"]]}
    if near:
        # Ledger invoice number differs by one digit. Everything else (vendor, date, items, total) identical.
        no = c["invoice_no"]
        pos = max(i for i, ch in enumerate(no) if ch.isdigit())
        d = str((int(no[pos]) + rng.randint(1, 9)) % 10)
        entry["invoice_no"] = no[:pos] + d + no[pos+1:]
    c["ledger"].insert(rng.randint(0, len(c["ledger"])), entry)
    return c


def m_vendor(c):
    v = rng.choice(OFFLIST)
    c["vendor"] = v; c["transfer_to"] = v
    return c


def m_date(c):
    off = rng.randint(3, 60)
    if rng.random() < 0.5:
        c["invoice_date"] = add_days(c["tranche_window"]["start"], -off)
    else:
        c["invoice_date"] = add_days(c["tranche_window"]["end"], off)
    c["transfer_date"] = add_days(c["invoice_date"], rng.randint(0, 2))
    return c


def m_category(c):
    c["items"] = make_items(c["purpose"], cat="bad", n_items=1)
    c["invoice_total"] = total(c["items"]); c["transfer_amount"] = c["invoice_total"]
    c["tranche_ceiling"] = max(c["tranche_ceiling"], c["invoice_total"])
    return c


def genuine_variant(c, k):
    """Distractors that look suspicious but are valid, so flagging everything is not a winning strategy."""
    if k == 0:   # same vendor as a past invoice, but different items, date and total
        pv = c["vendor"]
        c["ledger"].append({"vendor": pv, "invoice_no": new_inv_no("RPT"), "date": add_days(c["tranche_window"]["start"], -rng.randint(25, 90)),
                            "total": c["invoice_total"] + rng.randint(1, 9) * 10000, "items": [i["item"] for i in c["items"]]})
    elif k == 1:  # invoice dated exactly on the window edge
        c["invoice_date"] = rng.choice([c["tranche_window"]["start"], c["tranche_window"]["end"]])
        c["transfer_date"] = add_days(c["invoice_date"], rng.randint(0, 2))
    elif k == 2:  # amount close to ceiling
        c["tranche_ceiling"] = c["invoice_total"]
    return c


SPEC = ([("genuine", "plain", 120), ("genuine", "distractor", 60)] +
        [("amount_altered", "clear", 20), ("amount_altered", "hard_under_5pct", 10),
         ("duplicate_invoice", "exact_reuse", 20), ("duplicate_invoice", "hard_near_duplicate", 10),
         ("vendor_not_approved", "clear", 20), ("date_outside_window", "clear", 20),
         ("category_mismatch", "clear", 20)])
# Totals: 180 genuine, 120 mismatch, 300 cases.


def build():
    cases = []
    for label, sub, n in SPEC:
        for _ in range(n):
            c = base_case(len(cases))
            if label == "genuine":
                if sub == "distractor":
                    c = genuine_variant(c, rng.randint(0, 2))
            elif label == "amount_altered": c = m_amount(c, hard=sub.startswith("hard"))
            elif label == "duplicate_invoice": c = m_dup(c, near=sub.startswith("hard"))
            elif label == "vendor_not_approved": c = m_vendor(c)
            elif label == "date_outside_window": c = m_date(c)
            elif label == "category_mismatch": c = m_category(c)
            cases.append((label, sub, c))
    order = list(range(len(cases)))
    rng.shuffle(order)
    out = []
    for new_id, i in enumerate(order, 1):
        label, sub, c = cases[i]
        out.append({"id": f"C{new_id:03d}", "truth": "match" if label == "genuine" else "mismatch",
                    "type": label, "subtype": sub, "docs": render(c)})
    return out


if __name__ == "__main__":
    cases = build()
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cases.jsonl")
    with open(path, "w") as f:
        for c in cases:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    from collections import Counter
    print(len(cases), Counter(c["truth"] for c in cases), Counter((c["type"], c["subtype"]) for c in cases))
