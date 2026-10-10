(function () {
  var KEY = 'palvoo.attr';
  var DAYS = 30;
  var FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ref'];
  var SHAPE = /^[A-Za-z0-9._-]{1,64}$/;

  function clean(value, isRef) {
    if (typeof value !== 'string') return null;
    var v = value.replace(/^\s+|\s+$/g, '');
    if (!SHAPE.test(v)) return null;
    return isRef ? v.toUpperCase() : v.toLowerCase();
  }

  function fromUrl() {
    var q = window.location.search.replace(/^\?/, '');
    if (!q) return null;
    var out = {}, any = false, parts = q.split('&');
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      if (eq <= 0) continue;
      var key, raw;
      try {
        key = decodeURIComponent(parts[i].slice(0, eq).replace(/\+/g, ' '));
        raw = decodeURIComponent(parts[i].slice(eq + 1).replace(/\+/g, ' '));
      } catch (e) { continue; }
      if (FIELDS.indexOf(key) < 0 || out[key]) continue;
      var v = clean(raw, key === 'ref');
      if (v) { out[key] = v; any = true; }
    }
    return any ? out : null;
  }

  function stored(now) {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o.at !== 'number' || now - o.at < 0 || now - o.at > DAYS * 86400000) {
        window.localStorage.removeItem(KEY);
        return null;
      }
      var out = { at: o.at };
      for (var i = 0; i < FIELDS.length; i++) {
        var v = clean(o[FIELDS[i]], FIELDS[i] === 'ref');
        if (v) out[FIELDS[i]] = v;
      }
      return out;
    } catch (e) { return null; }
  }

  var now = Date.now();
  var first = stored(now);
  var fresh = fromUrl();
  if (!first && fresh) {
    fresh.at = now;
    try { window.localStorage.setItem(KEY, JSON.stringify(fresh)); } catch (e) { }
  }

  window.palvooAttr = function () {
    var pick = stored(Date.now()) || fresh;
    var out = {};
    if (!pick) return out;
    for (var i = 0; i < FIELDS.length; i++) if (pick[FIELDS[i]]) out[FIELDS[i]] = pick[FIELDS[i]];
    return out;
  };
})();
