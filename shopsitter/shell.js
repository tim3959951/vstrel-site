// ShopSitter's owner pages at vstrel.com/shopsitter/… (start, try, connect, m).
// vstrel.com is a static site, so the page itself comes from the ShopSitter server: this loads it
// into this address, and the page then talks to the server's /api (allowed for vstrel.com only).
// Source: line-sales-agent/engine/site/shopsitter (copied here by engine/site-sync.sh);
// engine/src/links.ts explains the addresses.
(function () {
  var API = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) ? "http://127.0.0.1:8787" : "https://line-ai-store-agent.vstrel-ai-sales.workers.dev";
  var page = document.documentElement.getAttribute("data-page");
  var q = new URLSearchParams(location.search);
  var id = q.get("id") || "";
  var k = q.get("k") || "";
  var t = q.get("t") || "";
  var enc = encodeURIComponent;
  var path =
    page === "start" ? "/start" :
    page === "try" && id ? "/d/" + enc(id) + (k ? "?k=" + enc(k) : "") :
    page === "connect" && id && k ? "/connect/" + enc(id) + "?k=" + enc(k) :
    page === "m" && t ? "/m/" + enc(t) + (q.get("v") === "stats" ? "?v=stats" : "") :
    "";
  var msg = document.getElementById("ss-msg");
  var done = false;

  function fail(text, offerDirect) {
    done = true;
    msg.textContent = text;
    if (offerDirect) {
      var a = document.createElement("a");
      a.href = API + path;
      a.textContent = "改用另一個網址打開";
      msg.appendChild(document.createElement("br"));
      msg.appendChild(a);
    }
  }

  if (!path) return fail("這個連結不完整，請回到原本的訊息再點一次。", false);
  setTimeout(function () {
    if (!done) msg.textContent = "還在載入，網路比較慢，請稍等…";
  }, 6000);
  fetch(API + path, { credentials: "omit", cache: "no-store" })
    .then(function (r) {
      return r.text().then(function (html) {
        // The server's own pages (also its "link expired" page) are shown as they are.
        if (!/^\s*<!doctype html/i.test(html)) {
          return fail(r.status === 404 ? "找不到這個頁面：連結可能不完整，或已經失效。" : "暫時打不開，請稍後再試。", r.status !== 404);
        }
        done = true;
        document.open();
        document.write(html);
        document.close();
      });
    })
    .catch(function () {
      fail("暫時連不上 ShopSitter，請稍後再試。", true);
    });
})();
