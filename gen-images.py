#!/usr/bin/env python3
"""Regenerate the share card and the GitHub profile banner.

Both are screenshots of throwaway pages built from this site's own stylesheet,
so they always match the real thing. The icon sprite and the chip markup are
read straight out of index.html - edit the chips there and they follow.

    python3 gen-images.py                      # assets/og.png + assets/og-light.png
    python3 gen-images.py --banner             # also ../arnegiacomo/banner.png
    python3 gen-images.py --banner path.png    # banner somewhere else

Needs Google Chrome. Nothing else.
"""
import argparse
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_BANNER = os.path.join(ROOT, "..", "arnegiacomo", "banner.png")
CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
]

STYLE = '<link rel="stylesheet" href="css/style.css">'

OG = dict(
    width=1200, height=630,
    css="""
body{margin:0;width:1200px;height:630px;overflow:hidden;display:flex;align-items:center;
     gap:64px;padding:0 78px;box-sizing:border-box}
.portrait-wrap{flex:0 0 300px} .chip{--size:4rem} .txt{flex:1}
.txt h1{font-family:var(--head);font-size:76px;line-height:.98;letter-spacing:-.02em;
        text-transform:uppercase;font-weight:700;margin:14px 0 22px}
.eyebrow{font-size:19px;margin:0} .lead{font-size:26px;max-width:26ch;margin:0 0 30px}
.url{display:inline-block;background:var(--primary);color:var(--on-accent);
     border:3px solid var(--line);box-shadow:6px 6px 0 0 var(--shadow-color);
     padding:10px 18px;font:500 22px var(--mono)}
""",
    body='<div class="txt"><p class="eyebrow">FULLSTACK DEVELOPER</p>'
         '<h1>Arne Giacomo<br>Munthe-Kaas</h1>'
         '<p class="lead">Web and cloud development, mostly for banking and finance.</p>'
         '<span class="url">arnegiacomo.dev</span></div>',
)

BANNER = dict(
    width=1400, height=480,
    css="""
body{margin:0;width:1400px;height:480px;overflow:hidden;display:flex;align-items:center;
     gap:72px;padding:0 84px;box-sizing:border-box;border:5px solid #000}
.portrait-wrap{flex:0 0 296px} .chip{--size:4.1rem} .txt{flex:1}
.txt h1{font-family:var(--head);font-size:96px;line-height:.95;letter-spacing:-.025em;
        text-transform:uppercase;font-weight:700;margin:0 0 28px}
.eyebrow{font-size:23px;margin:0 0 16px;letter-spacing:.14em}
.row{display:flex;gap:16px;align-items:center}
.tag{display:inline-flex;align-items:center;height:64px;box-sizing:border-box;
     border:3px solid var(--line);box-shadow:6px 6px 0 0 var(--shadow-color);
     padding:0 22px;font:500 26px/1 var(--mono);background:var(--card);color:var(--ink)}
.tag.hi{background:var(--primary);color:var(--on-accent)}
""",
    body='<div class="txt"><p class="eyebrow">FULLSTACK DEVELOPER &middot; BERGEN</p>'
         '<h1>Arne Giacomo<br>Munthe-Kaas</h1>'
         '<div class="row"><span class="tag hi">arnegiacomo.dev</span>'
         '<span class="tag">&#127475;&#127476; &#127470;&#127481;</span></div></div>',
)


# AGMK is unreadable at 16px - four glyphs at roughly 7px each. That size gets
# AG instead, which is the top row of the same monogram, so the two sizes read as
# one mark rather than two. Browsers pick per size via the sizes attribute.
MONO = """
<style>
 html,body{margin:0;padding:0;width:SIZEpx;height:SIZEpx;overflow:hidden;
           background:#ffdc58;background-image:none}
 .m{width:SIZEpx;height:SIZEpx;background:#ffdc58;color:#000;display:grid;
    place-content:center;font-family:var(--head);font-weight:800;
    font-size:FSpx;line-height:LH;letter-spacing:-.04em;text-align:center}
 span{display:block}
</style>
<div class="m">LINES</div>"""

#        px   lines        font-size ratio  line-height  output
FAVICONS = [
    (16,  ["AG"],         0.62,  "1",   "assets/favicon-16.png"),
    (32,  ["AG", "MK"],   0.45,  ".84", "assets/favicon-32.png"),
    (180, ["AG", "MK"],   0.45,  ".84", "assets/apple-touch-icon.png"),
]


def render_favicon(chrome, size, lines, ratio, lh, out):
    tpl = (MONO.replace("SIZE", str(size))
               .replace("FS", f"{size * ratio:.2f}")
               .replace("LH", lh)
               .replace("LINES", "".join(f"<span>{l}</span>" for l in lines)))
    page = '<!doctype html><html data-theme="light"><meta charset=utf-8>' + STYLE + tpl
    fd, tmp = tempfile.mkstemp(suffix=".html", dir=ROOT)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(page)
        subprocess.run([chrome, "--headless", "--disable-gpu", "--no-sandbox",
                        f"--screenshot={os.path.join(ROOT, out)}",
                        f"--window-size={size},{size}", "--hide-scrollbars",
                        "file://" + tmp], check=True, capture_output=True)
    finally:
        os.unlink(tmp)
    print(f"  {out:44} {size}x{size}  {''.join(lines)}")


def find_chrome():
    for path in CHROME_CANDIDATES:
        if os.path.exists(path):
            return path
    sys.exit("Google Chrome not found - add its path to CHROME_CANDIDATES.")


def read_page():
    """Pull the icon sprite and chip markup out of index.html."""
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()

    sprite = re.search(r'<svg class="sprite".*?</svg>', html, re.S)
    if not sprite:
        sys.exit("no <svg class=\"sprite\"> in index.html")

    chips = re.findall(
        r'<span class="chip block (\S+)\s+(p\d)"[^>]*>'
        r'<svg><use href="(#i-[\w-]+)"/></svg></span>', html)
    if not chips:
        sys.exit("no chips matched in index.html - has the markup changed?")

    markup = ['<div class="portrait-wrap">',
              '  <div class="portrait block"><img src="assets/portrait.png" alt=""></div>']
    markup += [f'  <span class="chip block {cls} {pos}"><svg><use href="{ref}"/></svg></span>'
               for cls, pos, ref in chips]
    markup.append('</div>')
    return sprite.group(0), "\n".join(markup), chips


def render(chrome, spec, sprite, chips, out, light):
    root = '<!doctype html><html data-theme="light">' if light else '<!doctype html>'
    page = (root + '<meta charset=utf-8>' + STYLE
            + '<style>' + spec["css"] + '</style>'
            + sprite + chips + spec["body"])

    # Written into the repo root so the relative css/ and assets/ paths resolve.
    fd, tmp = tempfile.mkstemp(suffix=".html", dir=ROOT)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(page)
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        subprocess.run([chrome, "--headless", "--disable-gpu", "--no-sandbox",
                        f"--screenshot={os.path.abspath(out)}",
                        f"--window-size={spec['width']},{spec['height']}",
                        "--hide-scrollbars", "file://" + tmp],
                       check=True, capture_output=True)
    finally:
        os.unlink(tmp)
    print(f"  {os.path.relpath(out, ROOT):44} {os.path.getsize(out) / 1024:6.0f} KB")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--banner", nargs="?", const=DEFAULT_BANNER, default=None,
                    help="also render the GitHub profile banner")
    args = ap.parse_args()

    chrome = find_chrome()
    sprite, chips, found = read_page()
    print("chips from index.html:", ", ".join(f"{c}@{p}" for c, p, _ in found))

    render(chrome, OG, sprite, chips, os.path.join(ROOT, "assets/og.png"), light=False)
    render(chrome, OG, sprite, chips, os.path.join(ROOT, "assets/og-light.png"), light=True)
    if args.banner:
        render(chrome, BANNER, sprite, chips, args.banner, light=True)
    for size, lines, ratio, lh, out in FAVICONS:
        render_favicon(chrome, size, lines, ratio, lh, out)


if __name__ == "__main__":
    main()
