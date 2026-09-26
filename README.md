# vstrel-site

VSTREL 公司首頁 — 單一靜態 HTML，部署於 GitHub Pages (vstrel.com)。

## 對外頁面的寫法

- 這些頁面金流業者審核時會看，一律用正式公司用語：用「本公司」「您」，不寫口語旁白、內部名詞、開發代號或人名。
- 條款類頁面（貨主條款、承運人條款、費用政策、取消與退款政策）改字就升版本號，並更新「最後更新／生效日」。
- **HTML 與 JS 註解一樣看得到**（瀏覽器「檢視原始碼」）。設計脈絡寫在這份 README 或 truck-uber 的 docs/，不寫在頁面裡。
- 頁面上的數字與關鍵句由 truck-uber 的 `scripts/check-public-terms.mjs` 逐條對線上設定；改寫句子時要同步改那支的錨點。

## 預先登記表單（/palvoo/waitlist/）

- 送到 Supabase Edge Function `waitlist-join`，不直接打資料庫：填表的人沒有帳號，而 anon 角色不得執行任何 public 函式，
  所以由 Edge Function 以 service_role 呼叫 `waitlist_join()`。頁面本身不含任何金鑰。
- 貨主只問四件事且都必填（主要出貨縣市、主要送達縣市、每月趟次、常用車型）：這份名單是正式開放前的統計，
  看各地缺的是貨主還是承運人、缺哪一種車。公司名稱與統編在註冊 App 時才填。
- 選項的 `value`（agency／regular／own／adhoc、11t…35t）是送到伺服器的值，改畫面文字時不要動。

## Palvoo 隱私權政策（/palvoo/privacy/）

- 這一頁是 **Palvoo App 內《隱私權政策》的全文**，兩個商店（Google Play、App Store）的「隱私權政策網址」填這一頁：
  使用者註冊時同意的與商店連到的是同一份（2026-09-26 定）。
- **不要手改內文。** 由 truck-uber 的 `node scripts/site-privacy-page.mjs <這個 repo 的目錄>` 從 `docs/privacy-policy-v1.md` 產生；
  外框（樣式、上方選單、頁尾的營運者與客服資訊）取自 /palvoo/delete-account/，改了那一頁的外框要重跑一次，兩頁才一致。
- truck-uber CI 的 check-public-terms 會拿這一頁 `<article id="policy">` 的字，跟 App 內的政策逐字比；
  App 內的政策改版時，先產生、先推這個 repo，再推 truck-uber。
- /privacy/ 是本公司的隱私權政策（整個網站與所有產品，寫得比較概括）；第一條寫明就 Palvoo 以《Palvoo 隱私權政策》為準
  （跟「官網條款與 App 內不一致時以 App 內為準」同一個原則）。Palvoo 各頁頁尾的「隱私權政策」連到 /palvoo/privacy/；
  預先登記表單蒐集的資料屬於網站本身，那一句仍連到 /privacy/。

## 首頁的 3D 版（/palvoo/3d/，預覽）

- 2026-09-26 起跟 /palvoo/ 並存，用來比較兩種版面：**沒有任何頁面連過去**、`noindex`，不取代 /palvoo/。
- 內容與 /palvoo/ 相同（服務說明、貨主與承運人服務、服務範圍、收費方式、常見問題、頁尾），另外多開場的 3D 場景
  與一張車型與基本費率表（照費用政策第二點）。場景裡的狀態字跟貨主 App 同一套說法。
- **原始碼在 `_src/palvoo-3d/`**（底線開頭的資料夾 GitHub Pages 不會送出）：`page.html` 是版面、`scene.js` 是 three.js 場景。
  改完在 repo 根目錄跑 `python3 _src/palvoo-3d/build.py`，產生 `palvoo/3d/index.html` 與 `app.js`
  （拿掉 CSS 註解、JS 壓縮，對外頁面不留註解）。標題改了字要先跑 `fonts.py`：字型子集只含標題用到的字，build.py 會檢查缺字。
- 不從第三方載入任何東西（跟其他頁一樣）：three.js r169 放在 `palvoo/3d/lib/`（npm 原檔，MIT，授權檔在旁邊）、
  字型子集放在 `palvoo/3d/fonts/`（SIL OFL 1.1，授權在 `OFL.txt`）。沒有 WebGL 或載入失敗時，畫面停在黃昏的漸層底，文字與連結照常可用。
- 分享預覽圖 `og.jpg` 是開場畫面的截圖（1200×630）。
- **如果之後改用這一版當 /palvoo/**：費率表與試算卡上的數字（起步價、每公里、每板、最多、重貨門檻、NT$7,750 的算式）
  要加進 truck-uber `check-public-terms` 的檢查，頁面也要加進它的 `PUBLIC_PAGES`（正式用語、原始碼註解）。

## 404 頁（/404.html）

- 開頭一小段 script：網址後面黏了多餘的字（聊天軟體把連結後面的「。」或其他中文一起做成連結，例如
  `/palvoo/3d/**。現在的…`），或路徑打成大寫（`/palvoo/3D/`），就導回乾淨的那一段、轉成小寫；
  真的不存在的頁面照樣顯示 404（導過去還是 404 時網址已經是乾淨的，不會一直轉）。
- 規則：取網址開頭只含英數字與 `/ . _ ~ -` 的那一段，去掉結尾的 `. ~ -`，轉小寫；跟原本不一樣才轉。
