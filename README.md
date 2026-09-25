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
