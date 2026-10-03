#!/usr/bin/env python3
"""組出 /palvoo/（Palvoo 首頁，3D 版）。

    python3 _src/palvoo-3d/build.py          # 在 repo 根目錄跑

輸入：_src/palvoo-3d/page.html（版面）、scene.js（3D 場景）、common.py（<head> 與客服資訊，純文字版共用）
輸出：palvoo/index.html、palvoo/app.js
另外兩樣是先放好、build 不動的：palvoo/fonts/（fonts.py 產生）、palvoo/lib/（three.js r169，npm 原檔與授權）。
舊網址 /palvoo/3d/ 是一頁手寫的轉址頁（palvoo/3d/index.html），build 不動它。

對外頁面的原始碼人人看得到（README「對外頁面的寫法」），所以這支會：
  - 拿掉 CSS 註解；JS 用 esbuild 壓縮（註解一起拿掉）；輸出裡有任何 HTML 註解就失敗
  - 檢查標題用到的每一個字都在字型子集裡（標題改了字，要先跑 fonts.py）
esbuild 版本固定：npx --yes esbuild@0.24.0（需要 Node）。
"""
import hashlib, html, pathlib, re, subprocess, sys

from common import CONTACT, head as page_head   # <head> 與客服資訊：跟純文字版（_src/palvoo-2d）共用

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent.parent
OUT = SITE / 'palvoo'
ESBUILD = ['npx', '--yes', 'esbuild@0.24.0']
THREE = 'lib/three-r169.module.min.js'

page = (HERE / 'page.html').read_text(encoding='utf-8')

# ── 字型子集要涵蓋標題的每一個字 ─────────────────────────────────────────────
def tag_text(tag):
    return ''.join(html.unescape(re.sub(r'<[^>]+>', '', m.group(1)))
                   for m in re.finditer(rf'<{tag}\b[^>]*>(.*?)</{tag}>', page, re.S))

try:
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit('需要 fontTools（pip install fonttools brotli）')
for tag, font in (('h1', 'serif-900.woff2'), ('h2', 'serif-700.woff2')):
    cmap = TTFont(OUT / 'fonts' / font).getBestCmap()
    missing = sorted({c for c in tag_text(tag) if not c.isspace() and ord(c) not in cmap})
    if missing:
        sys.exit(f'{font} 缺字：{"".join(missing)} —— 先跑 python3 _src/palvoo-3d/fonts.py')

# ── JS：壓縮（three 由 importmap 指到網站自己的那一份） ───────────────────────
r = subprocess.run(ESBUILD + [str(HERE / 'scene.js'), '--minify', '--format=esm', '--target=es2020',
                              '--charset=utf8', '--legal-comments=none'],
                   capture_output=True, text=True)
if r.returncode:
    sys.exit(r.stderr)
app = r.stdout
(OUT / 'app.js').write_text(app, encoding='utf-8')
ver = hashlib.sha256(app.encode()).hexdigest()[:10]

# ── 頁面 ────────────────────────────────────────────────────────────────────
faces = ''.join(
    f'@font-face{{font-family:"{fam}";font-style:normal;font-weight:{w};font-display:swap;'
    f'src:url(fonts/{f}) format("woff2")}}\n'
    for fam, w, f in (('Palvoo Serif', 700, 'serif-700.woff2'), ('Palvoo Serif', 900, 'serif-900.woff2'),
                      ('Palvoo Cond', 500, 'cond-500.woff2'), ('Palvoo Cond', 600, 'cond-600.woff2'),
                      ('Palvoo Cond', 700, 'cond-700.woff2')))
body = page.replace('/*@FONT-FACES*/', faces)
body = re.sub(r'<style>(.*?)</style>',
              lambda m: '<style>' + re.sub(r'\n\s*\n+', '\n', re.sub(r'/\*.*?\*/', '', m.group(1), flags=re.S)) + '</style>',
              body, count=1, flags=re.S)
body = body.replace('<!--@LABEL-->\n', '')
body = body.replace('<!--@CONTACT-->', CONTACT)
body = body.replace('<!--@SCRIPTS-->',
                    '<script type="importmap">{"imports":{"three":"./' + THREE + '"}}</script>\n'
                    f'<script type="module" src="./app.js?v={ver}"></script>')

head = page_head(viewport='width=device-width, initial-scale=1, viewport-fit=cover', theme_color='#0B0F16', og_image='og.jpg',
                 extra='<link rel="preload" href="fonts/serif-900.woff2" as="font" type="font/woff2" crossorigin>\n'
                       f'<link rel="modulepreload" href="./{THREE}">\n')
out = head + body.replace('<style>', '<style>\n', 1).replace('</style>\n', '</style>\n</head>\n<body>\n', 1) + '</body>\n</html>\n'

# 對外頁面不留註解（CSS 已經拿掉；HTML 一個都不能有）
if '<!--' in out or '/*' in re.search(r'<style>(.*?)</style>', out, re.S).group(1):
    sys.exit('輸出裡還有註解')
if re.search(r'[一-鿿]', re.sub(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\]|\\.)*`', '', app)):
    sys.exit('app.js 裡字串以外還有中文（註解沒拿乾淨？）')
(OUT / 'index.html').write_text(out, encoding='utf-8')
print(f'palvoo/index.html {len(out.encode()):,} bytes；app.js {len(app.encode()):,} bytes（v={ver}）')
