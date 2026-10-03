#!/usr/bin/env python3
"""組出 /palvoo/ 的純文字版（舊版樣式、沒有 3D 場景），給「首頁要換回純文字版」的時候用。

    python3 _src/palvoo-2d/build.py                    # 在 repo 根目錄跑：覆蓋 palvoo/index.html（＝換成純文字版）
    python3 _src/palvoo-2d/build.py --out 某處/x.html   # 只產生到別的地方、不動網站（預覽、檢查用）

換回 3D 版：python3 _src/palvoo-3d/build.py。兩個版本的步驟寫在 README「Palvoo 首頁換回純文字版」。

這裡沒有任何內文：
  - 開場、運送流程、服務說明、費率表、試算範例、常見問題、頁尾：取自 _src/palvoo-3d/page.html（3D 版改字，這一版跟著變）
  - <head>（標題、canonical、分享預覽、JSON-LD）與客服資訊：_src/palvoo-3d/common.py（兩個版本共用）
所以 truck-uber 的 check-public-terms 對首頁的檢查（費率表、試算範例的算式、取消費與時限……），換成這一版也照樣對得上。
這裡只有版面（template.html）與「3D 版的哪一段放到哪裡」；3D 版的段落找不到（改了結構）就失敗，不會產生少一段的頁面。
"""
import argparse, html, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent.parent
SRC3D = SITE / '_src' / 'palvoo-3d'
sys.dont_write_bytecode = True
sys.path.insert(0, str(SRC3D))
from common import CONTACT, head as page_head  # noqa: E402

ap = argparse.ArgumentParser(description='產生 /palvoo/ 純文字版')
ap.add_argument('--out', default=str(SITE / 'palvoo' / 'index.html'), help='輸出檔（預設 palvoo/index.html）')
args = ap.parse_args()

page = (SRC3D / 'page.html').read_text(encoding='utf-8')
tpl = (HERE / 'template.html').read_text(encoding='utf-8')


def one(pattern, text, what):
    found = list(re.finditer(pattern, text, re.S))
    if len(found) != 1:
        sys.exit(f'3D 版 page.html 的「{what}」找到 {len(found)} 個（應該剛好 1 個）：page.html 改了結構，這支要跟著改')
    return found[0]


def text_of(fragment):
    return html.unescape(re.sub(r'<[^>]+>', '', fragment)).strip()


# ── 開場 ────────────────────────────────────────────────────────────────────
hero = one(r'<section class="chapter hero".*?</section>', page, '開場').group(0)
eyebrow = one(r'<p class="eyebrow">(.*?)</p>', hero, '開場小字').group(1)
h1 = html.escape(text_of(one(r'<h1[^>]*>(.*?)</h1>', hero, '大標').group(1)), quote=False)
lead = one(r'<p class="lead">.*?</p>', hero, '開場說明').group(0)
actions = one(r'<div class="hero-actions">.*?</div>', hero, '開場按鈕').group(0)

# ── 運送流程：3D 版捲動的每一章 → 一個步驟 ────────────────────────────────────
steps = []
for m in re.finditer(r'<section class="chapter" [^>]*>(.*?)</section>', page, re.S):
    ch = m.group(1)
    num = one(r'<span class="ch-num">(.*?)</span>', ch, '章節編號').group(1)
    label = one(r'<span class="ch-label">(.*?)</span>', ch, '章節名稱').group(1)
    title = one(r'<h2[^>]*>(.*?)</h2>', ch, '章節標題').group(1)
    paras = re.findall(r'<p(?: class="fine")?>.*?</p>', ch, re.S)
    if not paras:
        sys.exit(f'3D 版第 {num} 章沒有內文')
    steps.append(f'<li><span class="n">{num}</span><div><p class="k">{label}</p><h3>{title}</h3>' + ''.join(paras) + '</div></li>')
if not steps:
    sys.exit('3D 版 page.html 找不到任何章節（<section class="chapter" …>）')

# ── 結尾那張卡（Palvoo 不是運送人）→ 流程下面的提示框；它的小字（預先登記）放回開場按鈕下面 ──
closing = one(r'<section class="closing".*?</section>', page, '結尾').group(0)
c_title = one(r'<h2[^>]*>(.*?)</h2>', closing, '結尾標題').group(1)
c_paras = re.findall(r'<p>(.*?)</p>', closing, re.S)
if not c_paras:
    sys.exit('3D 版結尾那張卡沒有內文')
signup = one(r'<p class="fine">(.*?)</p>', closing, '結尾小字').group(1)
note = ('<div class="note"><p><strong>' + c_title + '</strong>' + c_paras[0] + '</p>'
        + ''.join(f'<p>{p}</p>' for p in c_paras[1:]) + '</div>')


# ── 服務說明、車型與費率、常見問題：整段照搬 ─────────────────────────────────
def section(sid):
    return one(rf'<section class="sec" id="{sid}".*?</section>', page, f'#{sid} 那一段').group(0)


services, rates, faq = section('services'), section('rates'), section('faq')

# 試算範例（3D 版浮在場景上的小卡）放在費率表的算式下面；字一樣，check-public-terms 照樣重算
card = one(r'<div class="hud-card">(.*?)</div>\s*<div class="hud-stem">', page, '試算範例').group(1).strip()
one(r'<p class="formula">.*?</p>', rates, '基本運費算式')
rates = re.sub(r'(<p class="formula">.*?</p>)', lambda m: m.group(1) + f'\n      <div class="quote">{card}</div>',
               rates, count=1, flags=re.S)

# 常見問題全部展開，一題一個小標（舊版的樣子）
faq, n_qa = re.subn(r'<details><summary>(.*?)</summary>(.*?)</details>', r'<div class="qa"><h3>\1</h3>\2</div>', faq, flags=re.S)
if n_qa == 0 or '<details' in faq:
    sys.exit('常見問題的 <details> 沒有全部換掉（page.html 的寫法改了？）')

foot = one(r'<footer class="foot">.*?</footer>', page, '頁尾').group(0)
if foot.count('<!--@CONTACT-->') != 1:
    sys.exit('頁尾找不到客服資訊的位置（<!--@CONTACT-->）')
foot = foot.replace('<!--@CONTACT-->', CONTACT)

# ── 組起來 ──────────────────────────────────────────────────────────────────
body = re.sub(r'<style>(.*?)</style>',
              lambda m: '<style>\n' + re.sub(r'\n\s*\n+', '\n', re.sub(r'/\*.*?\*/', '', m.group(1), flags=re.S)).lstrip('\n') + '</style>',
              tpl, count=1, flags=re.S)
for key, value in (('EYEBROW', eyebrow), ('H1', h1), ('LEAD', lead), ('ACTIONS', actions), ('SIGNUP', signup),
                   ('STEPS', '\n'.join(steps)), ('NOTE', note), ('SERVICES', services), ('RATES', rates),
                   ('FAQ', faq), ('FOOT', foot)):
    mark = f'<!--@{key}-->'
    if body.count(mark) != 1:
        sys.exit(f'template.html 的 {mark} 應該剛好一個')
    body = body.replace(mark, value)

out = page_head(viewport='width=device-width, initial-scale=1', theme_color='#0B0D12', og_image='og.png') + body

# 對外頁面不留註解（README「對外頁面的寫法」）；3D 版的場景、腳本一樣都不能帶進來
if '<!--' in out or '/*' in re.search(r'<style>(.*?)</style>', out, re.S).group(1):
    sys.exit('輸出裡還有註解')
for leftover in ('id="world"', 'app.js', 'importmap', 'class="hud"', 'class="chapter'):
    if leftover in out:
        sys.exit(f'輸出裡還有 3D 版的東西：{leftover}')
ids = re.findall(r'\sid="([^"]+)"', out)
if len(ids) != len(set(ids)):
    sys.exit('id 重複：' + ', '.join(sorted({i for i in ids if ids.count(i) > 1})))

target = pathlib.Path(args.out)
target.write_text(out, encoding='utf-8')
print(f'{target} {len(out.encode()):,} bytes（純文字版：{len(steps)} 個流程步驟、{n_qa} 題常見問題）')
