#!/usr/bin/env python3
"""組出 /palvoo/3d/（首頁的 3D 版，預覽用、不列入搜尋）。

    python3 _src/palvoo-3d/build.py          # 在 repo 根目錄跑

輸入：_src/palvoo-3d/page.html（版面）、scene.js（3D 場景）
輸出：palvoo/3d/index.html、palvoo/3d/app.js
另外兩樣是先放好、build 不動的：palvoo/3d/fonts/（fonts.py 產生）、palvoo/3d/lib/（three.js r169，npm 原檔與授權）。

對外頁面的原始碼人人看得到（README「對外頁面的寫法」），所以這支會：
  - 拿掉 CSS 註解；JS 用 esbuild 壓縮（註解一起拿掉）；輸出裡有任何 HTML 註解就失敗
  - 檢查標題用到的每一個字都在字型子集裡（標題改了字，要先跑 fonts.py）
esbuild 版本固定：npx --yes esbuild@0.24.0（需要 Node）。
"""
import hashlib, html, pathlib, re, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent.parent
OUT = SITE / 'palvoo' / '3d'
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
body = body.replace('<!--@CONTACT-->',
                    '<p>客服電話：<a href="tel:+886913534909">0913-534-909</a>　客服信箱：<a href="mailto:tim@vstrel.com">tim@vstrel.com</a>　客服時間：平日 09:00–18:00</p>')
body = body.replace('<!--@SCRIPTS-->',
                    '<script type="importmap">{"imports":{"three":"./' + THREE + '"}}</script>\n'
                    f'<script type="module" src="./app.js?v={ver}"></script>')

desc = ('Palvoo 為臺灣大型貨車與聯結車之運輸媒合平台，提供 11 噸至 35 噸級車輛之即時與預約媒合、'
        '公開之參考價及運送狀態追蹤。由維斯托有限公司（VSTREL）營運。')   # 與 /palvoo/ 相同
head = f'''<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Palvoo — 貨有所託，車有所行</title>
<meta name="description" content="{desc}">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#0B0F16">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Palvoo">
<meta property="og:url" content="https://vstrel.com/palvoo/3d/">
<meta property="og:title" content="Palvoo — 貨有所託，車有所行">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://vstrel.com/palvoo/3d/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="zh_TW">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="fonts/serif-900.woff2" as="font" type="font/woff2" crossorigin>
<link rel="modulepreload" href="./{THREE}">
'''
out = head + body.replace('<style>', '<style>\n', 1).replace('</style>\n', '</style>\n</head>\n<body>\n', 1) + '</body>\n</html>\n'

# 對外頁面不留註解（CSS 已經拿掉；HTML 一個都不能有）
if '<!--' in out or '/*' in re.search(r'<style>(.*?)</style>', out, re.S).group(1):
    sys.exit('輸出裡還有註解')
if re.search(r'[一-鿿]', re.sub(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\]|\\.)*`', '', app)):
    sys.exit('app.js 裡字串以外還有中文（註解沒拿乾淨？）')
(OUT / 'index.html').write_text(out, encoding='utf-8')
print(f'palvoo/3d/index.html {len(out.encode()):,} bytes；app.js {len(app.encode()):,} bytes（v={ver}）')
