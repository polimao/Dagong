"""Compare two parsed Mach-O metric sets and produce a similarity report.

The score is a *structural* heuristic, not a cryptographic or semantic one:
it blends per-section / per-segment size ratios weighted toward executable
text. Rebuilding identical source with a different compiler/SDK shifts sizes,
so treat the number as a similarity hint (high = almost certainly the same
codebase; low = clearly different builds), not proof of equivalence.
"""

from __future__ import annotations

from typing import Optional

# Size metrics that matter for "is this the same code", with weights summing to 1.
SIZE_METRICS = {
    "sect_text_size": 0.50,       # executable code -- dominant signal
    "sect_const_size": 0.15,      # constant data
    "sect_data_size": 0.10,       # mutable data
    "seg_total_filesize": 0.20,   # everything linked (objc, stub, etc.)
    "ncmds_meaningful": 0.05,     # linked frameworks / structure count
}


def _metric_similarity(a: int, b: int) -> float:
    """1 - normalized absolute difference. Identical => 1.0, disjoint => 0.0."""
    a = int(a or 0)
    b = int(b or 0)
    span = max(a, b)
    if span == 0:
        return 1.0
    return 1.0 - abs(a - b) / span


def compare_macho(a: dict, b: dict) -> dict:
    a_avail = bool(a.get("available"))
    b_avail = bool(b.get("available"))

    metrics = []
    weighted = 0.0
    for name, weight in SIZE_METRICS.items():
        av = int(a.get(name) or 0)
        bv = int(b.get(name) or 0)
        sim = _metric_similarity(av, bv)
        span = max(av, bv, 1)
        delta_pct = ((bv - av) / span * 100.0) if span else 0.0
        metrics.append({
            "name": name,
            "weight": weight,
            "a": av,
            "b": bv,
            "delta": bv - av,
            "delta_pct": round(delta_pct, 2),
            "similarity": round(sim, 4),
        })
        weighted += weight * sim

    code_similarity = round(weighted, 4) if (a_avail and b_avail) else None
    return {
        "available_a": a_avail,
        "available_b": b_avail,
        "metrics": metrics,
        "code_similarity": code_similarity,
    }


def combined_similarity(code_similarity: Optional[float], plist_similarity: float,
                        code_weight: float = 0.85) -> float:
    if code_similarity is None:
        return round(plist_similarity, 4)
    return round(code_weight * code_similarity + (1 - code_weight) * plist_similarity, 4)


def format_bytes(n: int) -> str:
    n = int(n or 0)
    if n >= 1024 * 1024:
        return "%.2f MB" % (n / (1024 * 1024))
    if n >= 1024:
        return "%.2f KB" % (n / 1024)
    return "%d B" % n
