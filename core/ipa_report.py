#!/usr/bin/env python3
"""iOS IPA / .app binary code-similarity reporter.

Usage:
    python3 core/ipa_report.py LEFT RIGHT [-o report.html] \
        [--name-left "App A"] [--name-right "App B"]

LEFT / RIGHT may each be:
    * a .ipa file (a zip containing Payload/*.app), or
    * a .app bundle directory (already extracted).

The tool extracts each app's Info.plist and main executable, parses the
Mach-O (picking the arm64 slice of any universal binary), and reports a
structural code-similarity score plus a per-metric size delta and a
configuration diff. Output is a single self-contained HTML file.

No third-party packages required -- runs on the bundled managed Python.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
import zipfile
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))

from macho_parser import parse_macho_file, stats_to_dict  # noqa: E402
from plist_parser import parse_plist_file, compare_plist, PlistInfo  # noqa: E402
from binary_compare import compare_macho, combined_similarity, format_bytes  # noqa: E402


@dataclass
class AppArtifact:
    label: str
    source: str
    plist: PlistInfo = field(default_factory=PlistInfo)
    macho: dict = field(default_factory=dict)
    app_dir: Optional[str] = None
    cleanup: list = field(default_factory=list)

    def cleanup_all(self):
        for d in self.cleanup:
            shutil.rmtree(d, ignore_errors=True)


def _find_main_app_plist(zip_names: list) -> Optional[str]:
    """Pick the top-level .app's Info.plist (prefer Payload/<app>.app)."""
    candidates = [n for n in zip_names if n.endswith(".app/Info.plist")]
    if not candidates:
        return None
    # Prefer the shortest path (top-level app, not an app extension / app clip).
    candidates.sort(key=lambda n: (n.count("/"), n))
    return candidates[0]


def _prepare_input(path: str, label: str) -> AppArtifact:
    art = AppArtifact(label=label, source=path)
    if path.endswith(".ipa") or (os.path.isfile(path) and not path.endswith(".app")):
        tmp = tempfile.mkdtemp(prefix="ipa_")
        art.cleanup.append(tmp)
        with zipfile.ZipFile(path) as z:
            names = z.namelist()
            plist_rel = _find_main_app_plist(names)
            if not plist_rel:
                art.plist = PlistInfo(available=False, error="no .app/Info.plist found in archive")
                return art
            app_dir_in_zip = plist_rel[: plist_rel.rfind(".app") + len(".app")]
            z.extract(plist_rel, tmp)
            plist_path = os.path.join(tmp, plist_rel)
            art.plist = parse_plist_file(plist_path)
            art.app_dir = os.path.join(tmp, app_dir_in_zip)
            exe = art.plist.executable or os.path.basename(app_dir_in_zip[:-4])
            exe_rel = app_dir_in_zip + "/" + exe
            if exe_rel in names:
                z.extract(exe_rel, tmp)
                exe_path = os.path.join(tmp, exe_rel)
            elif exe_rel + "/" in names:
                exe_path = None
            else:
                # fall back to first executable-like file in the app
                exe_path = _first_executable(z, app_dir_in_zip)
                if exe_path:
                    z.extract(exe_path, tmp)
                    exe_path = os.path.join(tmp, exe_path)
            if exe_path and os.path.isfile(exe_path):
                art.macho = stats_to_dict(parse_macho_file(exe_path))
        return art
    elif path.endswith(".app") or os.path.isdir(path):
        art.app_dir = path
        plist_path = os.path.join(path, "Info.plist")
        if os.path.isfile(plist_path):
            art.plist = parse_plist_file(plist_path)
        exe = art.plist.executable or os.path.basename(path.rstrip("/").rstrip(".app"))
        exe_path = os.path.join(path, exe)
        if os.path.isfile(exe_path):
            art.macho = stats_to_dict(parse_macho_file(exe_path))
        return art
    else:
        art.plist = PlistInfo(available=False, error="unsupported input: %s" % path)
        return art


def _first_executable(z: zipfile.ZipFile, app_dir: str) -> Optional[str]:
    for n in z.namelist():
        if n.startswith(app_dir + "/") and not n.endswith("/"):
            # executable == file with same basename as the .app usually; pick by
            # being directly under app dir and not a known resource extension.
            base = os.path.basename(n)
            if "." not in base and not base.endswith(".png") and not base.endswith(".json"):
                return n
    return None


def build_report(left: AppArtifact, right: AppArtifact,
                 code_cmp: dict, plist_cmp: dict, combined: float) -> str:
    la = left.plist
    lb = right.plist
    name_a = la.surface.get("CFBundleDisplayName") or la.surface.get("CFBundleName") or left.label
    name_b = lb.surface.get("CFBundleDisplayName") or lb.surface.get("CFBundleName") or right.label
    ver_a = la.short_version or la.bundle_version or "?"
    ver_b = lb.short_version or lb.bundle_version or "?"

    def pct(x):
        return "%.1f%%" % (x * 100)

    # overall color
    score = combined * 100
    if score >= 90:
        color = "#1a7f37"
    elif score >= 70:
        color = "#bf8700"
    else:
        color = "#cf222e"

    rows = []
    for m in code_cmp["metrics"]:
        delta_cls = "up" if m["delta"] > 0 else ("down" if m["delta"] < 0 else "")
        rows.append(
            "<tr><td><code>%s</code></td>"
            "<td class='num'>%s</td><td class='num'>%s</td>"
            "<td class='num %s'>%s (%s)</td>"
            "<td class='num'>%s</td></tr>" % (
                m["name"],
                format_bytes(m["a"]),
                format_bytes(m["b"]),
                delta_cls,
                ("+" if m["delta"] > 0 else "") + format_bytes(m["delta"]),
                ("+" if m["delta_pct"] > 0 else "") + str(m["delta_pct"]) + "%",
                pct(m["similarity"]),
            )
        )
    metrics_html = "\n".join(rows)

    def macho_cell(st: dict) -> str:
        if not st.get("available"):
            return "<span class='muted'>unavailable%s</span>" % (
                " (" + st.get("error") + ")" if st.get("error") else "")
        arch = st.get("arch") or "?"
        fat = "universal" if st.get("fat") else "thin"
        return ("<b>%s</b> (%s)<br>"
                "<span class='muted'>arch list: %s</span><br>"
                "uuid: <code>%s</code><br>"
                "load cmds: %d (meaningful %d)<br>"
                "seg file size: %s") % (
            arch, fat, ", ".join(st.get("arch_list") or [arch]),
            st.get("uuid") or "-", st.get("ncmds_raw"), st.get("ncmds_meaningful"),
            format_bytes(st.get("seg_total_filesize")),
        )

    plist_rows = []
    for d in plist_cmp["diffs"]:
        plist_rows.append(
            "<tr><td><code>%s</code></td><td class='num'>%s</td><td class='num'>%s</td></tr>" % (
                d["key"], d["a"], d["b"]))
    plist_html = "\n".join(plist_rows) if plist_rows else (
        "<tr><td colspan='3' class='muted'>No configuration differences detected.</td></tr>")

    identity_note = "" if plist_cmp["identity_match"] else (
        "<p class='warn'>⚠️ Bundle identifier or executable name differs between the two builds -- "
        "these may not be the same app. Treat the similarity score with caution.</p>")

    html = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>iOS 二进制代码相似度报告</title>
<style>
  :root {{ --fg:#1f2328; --muted:#656d76; --line:#d0d7de; --bg:#ffffff; --panel:#f6f8fa; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
         color: var(--fg); background: var(--bg); margin: 0; padding: 32px; line-height: 1.55; }}
  .wrap {{ max-width: 960px; margin: 0 auto; }}
  h1 {{ font-size: 24px; margin: 0 0 4px; }}
  .sub {{ color: var(--muted); margin: 0 0 24px; }}
  .cards {{ display: flex; gap: 16px; margin-bottom: 24px; }}
  .card {{ flex: 1; border: 1px solid var(--line); border-radius: 10px; padding: 16px; background: var(--panel); }}
  .card h3 {{ margin: 0 0 8px; font-size: 15px; }}
  .card .meta {{ color: var(--muted); font-size: 13px; }}
  .score {{ text-align: center; margin: 8px 0 28px; }}
  .score .big {{ font-size: 56px; font-weight: 700; }}
  .bar {{ height: 10px; border-radius: 6px; background: var(--line); overflow: hidden; margin: 10px auto 0; max-width: 420px; }}
  .bar > span {{ display: block; height: 100%; }}
  table {{ width: 100%; border-collapse: collapse; margin: 8px 0 24px; font-size: 14px; }}
  th, td {{ text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }}
  th {{ background: var(--panel); font-weight: 600; }}
  td.num, th.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  .up {{ color: #1a7f37; }} .down {{ color: #cf222e; }}
  code {{ background: var(--panel); padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }}
  .muted {{ color: var(--muted); }}
  .warn {{ background: #fff8c5; border: 1px solid #d4a72c; color: #633c01; padding: 10px 12px; border-radius: 8px; }}
  .section {{ margin: 28px 0; }}
  .section > h2 {{ font-size: 17px; border-left: 4px solid var(--line); padding-left: 10px; }}
  footer {{ color: var(--muted); font-size: 12.5px; margin-top: 32px; border-top: 1px solid var(--line); padding-top: 14px; }}
</style></head>
<body><div class="wrap">
  <h1>iOS 二进制代码相似度报告</h1>
  <p class="sub">结构启发式比对 · 仅提取 Mach-O 可执行段与 Info.plist，不反编译、不传输</p>

  <div class="cards">
    <div class="card"><h3>{name_a}</h3>
      <div class="meta">版本 {ver_a}<br>bundle: {bid_a}</div></div>
    <div class="card"><h3>{name_b}</h3>
      <div class="meta">版本 {ver_b}<br>bundle: {bid_b}</div></div>
  </div>

  <div class="score">
    <div class="big" style="color:{color}">{score:.1f}%</div>
    <div class="muted">综合相似度（代码 {cw}% + 配置 {pw}%）</div>
    <div class="bar"><span style="width:{score:.1f}%;background:{color}"></span></div>
  </div>
  {identity_note}

  <div class="section">
    <h2>代码段尺寸对比</h2>
    <table>
      <thead><tr><th>指标</th><th class="num">A</th><th class="num">B</th>
      <th class="num">Δ (B−A)</th><th class="num">单项相似</th></tr></thead>
      <tbody>
      {metrics_html}
      </tbody>
    </table>
    <p class="muted">代码整体相似度：<b>{code_sim}</b></p>
  </div>

  <div class="section">
    <h2>Mach-O 解析明细</h2>
    <table>
      <thead><tr><th>A</th><th>B</th></tr></thead>
      <tbody><tr><td>{macho_a}</td><td>{macho_b}</td></tr></tbody>
    </table>
  </div>

  <div class="section">
    <h2>Info.plist 配置差异</h2>
    <table>
      <thead><tr><th>键</th><th class="num">A</th><th class="num">B</th></tr></thead>
      <tbody>
      {plist_html}
      </tbody>
    </table>
    <p class="muted">配置相似度：<b>{plist_sim}</b>（能力集 {cap_sim} · 版本/部署目标 {ver_sim}）</p>
  </div>

  <footer>
    方法论：代码相似度按可执行段（__text 50% / __const 15% / __data 10% / 段总文件尺寸 20% / 有效加载命令数 5%）的逐指标
    1−|Δ|/max 加权得到；配置相似度按能力集 Jaccard + 版本/部署目标精确匹配 + 标识匹配混合。
    本分数为“是否同一套代码/同代构建”的结构提示，非密码学或语义等价证明——相同源码换编译器/SDK 重建后尺寸会有偏移。
    所有解析在本地完成，未上传任何文件。
  </footer>
</div></body></html>"""
    return html.format(
        name_a=name_a, ver_a=ver_a, bid_a=la.bundle_id or "-",
        name_b=name_b, ver_b=ver_b, bid_b=lb.bundle_id or "-",
        color=color, score=score,
        cw=int(0.85 * 100), pw=int(0.15 * 100),
        identity_note=identity_note,
        metrics_html=metrics_html,
        code_sim=pct(code_cmp["code_similarity"] if code_cmp["code_similarity"] is not None else 0),
        macho_a=macho_cell(left.macho), macho_b=macho_cell(right.macho),
        plist_html=plist_html,
        plist_sim=pct(plist_cmp["similarity"]),
        cap_sim=pct(plist_cmp["capability_similarity"]),
        ver_sim=pct(plist_cmp["version_similarity"]),
    )


def main(argv=None):
    ap = argparse.ArgumentParser(description="iOS IPA / .app code-similarity reporter")
    ap.add_argument("left", help="first .ipa or .app")
    ap.add_argument("right", help="second .ipa or .app")
    ap.add_argument("-o", "--output", default="ipa-similarity-report.html")
    ap.add_argument("--name-left", default=None)
    ap.add_argument("--name-right", default=None)
    args = ap.parse_args(argv)

    left = _prepare_input(args.left, args.name_left or os.path.basename(args.left))
    right = _prepare_input(args.right, args.name_right or os.path.basename(args.right))

    code_cmp = compare_macho(left.macho, right.macho)
    plist_cmp = compare_plist(left.plist, right.plist)
    combined = combined_similarity(code_cmp["code_similarity"], plist_cmp["similarity"])

    html = build_report(left, right, code_cmp, plist_cmp, combined)
    out_path = os.path.abspath(args.output)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)

    # console summary
    cs = code_cmp["code_similarity"]
    print("Left : %s (plist %s, macho %s)" % (
        left.label, "ok" if left.plist.available else "FAIL",
        "ok" if left.macho.get("available") else "FAIL"))
    print("Right: %s (plist %s, macho %s)" % (
        right.label, "ok" if right.plist.available else "FAIL",
        "ok" if right.macho.get("available") else "FAIL"))
    print("Code similarity : %s" % ("%.1f%%" % (cs * 100) if cs is not None else "n/a"))
    print("Plist similarity: %.1f%%" % (plist_cmp["similarity"] * 100))
    print("Combined        : %.1f%%" % (combined * 100))
    print("Report written  : %s" % out_path)

    left.cleanup_all()
    right.cleanup_all()
    return 0


if __name__ == "__main__":
    sys.exit(main())
