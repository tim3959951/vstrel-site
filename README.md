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
