# vstrel-site

VSTREL 公司首頁 — 單一靜態 HTML，部署於 GitHub Pages (vstrel.com)。

## 對外頁面的寫法

- 這些頁面金流業者審核時會看，一律用正式公司用語：用「本公司」「您」，不寫口語旁白、內部名詞、開發代號或人名。
- 條款類頁面（貨主條款、承運人條款、費用政策、取消與退款政策）改字就升版本號，並更新「最後更新／生效日」。
- **HTML 與 JS 註解一樣看得到**（瀏覽器「檢視原始碼」）。設計脈絡寫在這份 README 或 truck-uber 的 docs/，不寫在頁面裡。
- 頁面上的數字與關鍵句由 truck-uber 的 `scripts/check-public-terms.mjs` 逐條對線上設定；改寫句子時要同步改那支的錨點。
- **分頁圖示**：/palvoo/ 底下每一頁用 Palvoo 的 P（`/palvoo/favicon.ico`、`/palvoo/apple-touch-icon.png`），
  其他頁用 VSTREL 的（根目錄的 `/favicon.ico`）。新增 Palvoo 頁面時照抄這兩行；首頁兩個版本在 `_src/palvoo-3d/common.py`，
  隱私權政策頁照刪除帳號頁的外框產生。兩個檔是從 truck-uber 的 `apps/customer/assets/icon.png` 縮出來的
  （分頁圖示裁掉四周留白、16／32／48 三種大小；apple-touch-icon 整張縮成 180）。App 圖示換了，這兩個要跟著重做。
  Google 搜尋結果旁的小圖示是一個網域一個（看 vstrel.com 首頁），那一個仍是 VSTREL。

## 預先登記表單（/palvoo/waitlist/）

- 送到 Supabase Edge Function `waitlist-join`，不直接打資料庫：填表的人沒有帳號，而 anon 角色不得執行任何 public 函式，
  所以由 Edge Function 以 service_role 呼叫 `waitlist_join()`。頁面本身不含任何金鑰。
- 貨主只問四件事且都必填（主要出貨縣市、主要送達縣市、每月趟次、常用車型）：這份名單是正式開放前的統計，
  看各地缺的是貨主還是承運人、缺哪一種車。公司名稱與統編在註冊 App 時才填。
- 承運人兩件必填（主要接單縣市、車型級距；Tim 2026-10-03），設備四題選填。
- 必填**伺服器也擋**（truck-uber 0247，規則 B19）：網頁的必填只是先講，`waitlist_join` 缺哪一格就回「請選擇…」（Edge Function 原樣回 400，網頁照字顯示）。
  兩邊要一起改：網頁比伺服器嚴沒關係，反過來網頁會讓人送出伺服器擋掉的東西 —— 改必填時官網先上、再推 truck-uber。
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

## Palvoo 首頁（/palvoo/，3D 版）

- 2026-09-26 起以 /palvoo/3d/ 預覽、跟舊版並存；2026-10 改成正式的 /palvoo/，舊的純文字版拿掉。
  舊網址 /palvoo/3d/ 留一頁手寫的轉址頁（`palvoo/3d/index.html`：立即轉到 /palvoo/、canonical 指向 /palvoo/、`noindex`），
  因為之前寄給別人的連結用的是那個網址；build 不動它。
- 內容：服務說明、貨主與承運人服務、車型與基本費率表（照費用政策第二點）、服務範圍、收費方式、常見問題、頁尾，前面加開場的 3D 場景。
  場景裡的狀態字跟貨主 App 同一套說法。
- **原始碼在 `_src/palvoo-3d/`**（資料夾名稱沿用預覽時的；底線開頭的資料夾 GitHub Pages 不會送出）：`page.html` 是版面、`scene.js` 是 three.js 場景。
  改完在 repo 根目錄跑 `python3 _src/palvoo-3d/build.py`，產生 `palvoo/index.html` 與 `palvoo/app.js`
  （拿掉 CSS 註解、JS 壓縮，對外頁面不留註解）。標題改了字要先跑 `fonts.py`：字型子集只含標題用到的字，build.py 會檢查缺字。
- `<head>`（`<title>`、canonical、分享預覽、結構化資料 JSON-LD）與頁尾的客服資訊寫在 `_src/palvoo-3d/common.py`，不在 page.html；JSON-LD 不放地址。
  純文字版（下一節）也用這一份，兩個版本的標題、說明、分享預覽才不會一邊改了一邊沒改。
- 不從第三方載入任何東西（跟其他頁一樣）：three.js r169 放在 `palvoo/lib/`（npm 原檔，MIT，授權檔在旁邊）、
  字型子集放在 `palvoo/fonts/`（SIL OFL 1.1，授權在 `OFL.txt`）。沒有 WebGL 或載入失敗時，畫面停在黃昏的漸層底，文字與連結照常可用。
- 分享預覽圖 `palvoo/og.jpg` 是開場畫面的截圖（1200×630）。其他 Palvoo 頁的分享圖仍是 `palvoo/og.png`，不要刪。
- 費率表與試算卡上的數字（起步價、每公里、每板、最多、重貨門檻、NT$7,750 的算式）與常見問題裡的取消費、時限，
  由 truck-uber `check-public-terms` 對線上設定；改寫句子時要同步改那支的錨點。

## Palvoo 首頁換回純文字版（rollback）

- 2026-10-03 Tim：3D 版正式上線、舊的純文字版不留在網站上；但萬一有人反映 3D 太花俏、不習慣，要能換回舊版的樣子。
  所以舊版做成「另一種排版」放在 `_src/palvoo-2d/`（底線開頭，GitHub Pages 不會送出），平常不產生、不上線。
- **換成純文字版**：在 repo 根目錄 `python3 _src/palvoo-2d/build.py`（覆蓋 `palvoo/index.html`）→ commit → 推（約 10 分鐘生效）。
  **換回 3D 版**：`python3 _src/palvoo-3d/build.py` → commit → 推。兩個版本都不用動其他檔案（`app.js`、`lib/`、`fonts/` 留著沒關係，純文字版不載入它們）。
- 純文字版**沒有自己的內文**：開場、運送流程（3D 版的五章）、服務說明、車型與費率表、試算範例、常見問題、頁尾都由 build.py 從 `_src/palvoo-3d/page.html` 取出，
  `<head>` 與客服資訊用 `common.py`。所以平常只改 3D 版的 page.html，純文字版自動跟著；truck-uber 的 `check-public-terms` 對首頁的檢查兩個版本都過
  （10-03 用本機兩份網站＋正式站設定對過：111 條全對；故意改錯試算範例、每站加價、營業用車那一句都會紅）。
- 版面在 `_src/palvoo-2d/template.html`：跟其他 Palvoo 頁（費用政策、條款）同一套樣式與上方選單；常見問題全部展開、一題一個小標（舊版的樣子）；
  分享預覽圖用 `palvoo/og.png`（`og.jpg` 是 3D 開場的截圖）。
- page.html 改了結構（段落改名、拿掉試算範例、常見問題不用 `<details>`……）時 build.py 會失敗並說是哪一段，不會產生少一段的頁面；照錯誤訊息改 build.py。

## 搜尋引擎（robots.txt、sitemap.xml、canonical、結構化資料）

- `robots.txt`：全部允許，指到 `sitemap.xml`。
- `sitemap.xml`：手寫，列要被搜尋到的頁面（首頁、本公司條款與隱私權政策、Palvoo 首頁與各政策、預先登記）；
  不列 /palvoo/3d/（轉址頁）與 /palvoo/delete-account/。新增對外頁面時一起加。
- canonical：每一頁指向自己的完整網址（結尾斜線跟實際網址一樣）。/palvoo/privacy/ 由 truck-uber 的產生器產生、
  外框取自 /palvoo/delete-account/：產生器先拿掉外框自己的 canonical、再放 privacy 的（delete-account 那一頁的 canonical 手寫在它自己的檔案裡）。
  truck-uber `check-public-terms` 對 Palvoo 每一頁查「只有一個 canonical、指向自己」，/palvoo/ 不能有 noindex，/palvoo/3d/ 要轉到 /palvoo/。
- 結構化資料（JSON-LD）：首頁 `/` 是 Organization（`@id` https://vstrel.com/#organization）、/palvoo/ 是 Service（provider 用同一個 `@id`）。
  只放頁面上看得到的資料；不放地址、不放電話（首頁沒有電話）。FAQ 結構化資料不做（Google 2023-08 起只給政府、醫療網站）。

## 404 頁（/404.html）

- 開頭一小段 script：網址後面黏了多餘的字（聊天軟體把連結後面的「。」或其他中文一起做成連結，例如
  `/palvoo/3d/**。現在的…`），或路徑打成大寫（`/palvoo/3D/`），就導回乾淨的那一段、轉成小寫；
  真的不存在的頁面照樣顯示 404（導過去還是 404 時網址已經是乾淨的，不會一直轉）。
- 規則：取網址開頭只含英數字與 `/ . _ ~ -` 的那一段，去掉結尾的 `. ~ -`，轉小寫；跟原本不一樣才轉。
