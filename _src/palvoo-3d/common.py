"""/palvoo/ 兩個版本共用的部分：3D 版（build.py）與純文字版（../palvoo-2d/build.py）。

<head>（標題、說明、canonical、分享預覽、結構化資料 JSON-LD）與頁尾的客服資訊只寫在這裡，
換版本（README「Palvoo 首頁要換回純文字版」）時兩邊才不會一邊改了、一邊沒改。
內文兩個版本都取自 page.html，也是同一份。
"""
import json

DESC = ('Palvoo 為臺灣大型貨車與聯結車之運輸媒合平台，提供 11 噸至 35 噸級車輛之即時與預約媒合、'
        '公開之參考價及運送狀態追蹤。由維斯托有限公司（VSTREL）營運。')

CONTACT = ('<p>客服電話：<a href="tel:+886913534909">0913-534-909</a>　'
           '客服信箱：<a href="mailto:service@vstrel.com">service@vstrel.com</a>　客服時間：平日 09:00–18:00</p>')

# 結構化資料（JSON-LD）：服務名稱、營運公司與服務範圍。不放地址。
LD = json.dumps({
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': 'https://vstrel.com/palvoo/#service',
    'name': 'Palvoo',
    'serviceType': '大型貨車與聯結車運輸媒合平台',
    'description': DESC,
    'url': 'https://vstrel.com/palvoo/',
    'areaServed': {'@type': 'Country', 'name': '臺灣'},
    'provider': {
        '@type': 'Organization',
        '@id': 'https://vstrel.com/#organization',
        'name': 'VSTREL',
        'legalName': '維斯托有限公司',
        'alternateName': ['維斯托', 'VSTREL Co., Ltd.'],
        'taxID': '62050829',
        'url': 'https://vstrel.com/',
    },
}, ensure_ascii=False, separators=(',', ':'))


def head(*, viewport, theme_color, og_image, extra=''):
    """<!DOCTYPE> 到 JSON-LD 為止；extra 接在後面（3D 版的字型與 three.js 預載）。"""
    return f'''<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="{viewport}">
<title>Palvoo｜大貨車、聯結車媒合平台 — 貨有所託，車有所行</title>
<meta name="description" content="{DESC}">
<link rel="canonical" href="https://vstrel.com/palvoo/">
<link rel="icon" href="/palvoo/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/palvoo/apple-touch-icon.png">
<meta name="theme-color" content="{theme_color}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Palvoo">
<meta property="og:url" content="https://vstrel.com/palvoo/">
<meta property="og:title" content="Palvoo — 貨有所託，車有所行">
<meta property="og:description" content="{DESC}">
<meta property="og:image" content="https://vstrel.com/palvoo/{og_image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="zh_TW">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{LD}</script>
{extra}'''
