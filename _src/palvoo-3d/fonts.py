#!/usr/bin/env python3
"""下載 /palvoo/3d/ 用的字型子集（只在標題的字改了之後重跑；需要網路）。

- 標題用 Noto Serif TC：只取頁面上 h1（900）與 h2（700）用到的字，檔案才小。
- 數字用 Barlow Condensed（500／600／700）：只取 ASCII 與幾個符號。
- 內文用系統字型（跟 /palvoo/ 一樣），不下載。

字型放在 palvoo/3d/fonts/，網站自己送，不從第三方載入（跟網站其他頁一致）。
兩套字型都是 SIL Open Font License 1.1，授權與著作權聲明寫在 fonts/OFL.txt。
下載用 Google Fonts 的 css2 API 的 text= 參數（回傳只含那些字的 woff2）。
"""
import html, pathlib, re, subprocess, urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent.parent
OUT = SITE / 'palvoo' / '3d' / 'fonts'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'


def texts(tag):
    page = (HERE / 'page.html').read_text(encoding='utf-8')
    out = ''
    for m in re.finditer(rf'<{tag}\b[^>]*>(.*?)</{tag}>', page, re.S):
        out += html.unescape(re.sub(r'<[^>]+>', '', m.group(1)))
    return out


def chars(s):
    return ''.join(sorted(set(c for c in s if not c.isspace())))


def fetch(url):
    return subprocess.run(['curl', '-sSf', '-A', UA, url], check=True, capture_output=True).stdout


def get(family, weight, text, name):
    q = urllib.parse.urlencode({'family': f'{family}:wght@{weight}', 'text': text, 'display': 'swap'})
    css = fetch('https://fonts.googleapis.com/css2?' + q).decode()
    urls = re.findall(r"src:\s*url\(([^)]+)\)\s*format\('woff2'\)", css)
    assert len(urls) == 1, css
    data = fetch(urls[0])
    (OUT / name).write_bytes(data)
    print(f'{name}: {len(text)} 字, {len(data):,} bytes')


OUT.mkdir(parents=True, exist_ok=True)
ascii_ = ''.join(chr(c) for c in range(0x21, 0x7f)) + '×−–·'
get('Noto Serif TC', 900, chars(texts('h1')), 'serif-900.woff2')
get('Noto Serif TC', 700, chars(texts('h2') + ascii_), 'serif-700.woff2')
for w in (500, 600, 700):
    get('Barlow Condensed', w, ascii_, f'cond-{w}.woff2')
