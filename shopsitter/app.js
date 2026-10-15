// ShopSitter — scroll-driven story scene for https://vstrel.com/shopsitter/
// A Taiwanese street at 23:47: the salon is shuttered and the owner is asleep upstairs,
// customers keep messaging, ShopSitter (the green S tile) answers; in the morning the owner
// taps 確認 and later changes things just by chatting. Everything is driven by one number t
// (0 = hero … 6 = closing) taken from the scroll position, like the Palvoo page.
// three.js is the copy Palvoo already serves (/palvoo/lib/three-r169.module.min.js).
import * as THREE from "three";

const $ = (s) => document.querySelector(s);
const root = document.documentElement;
const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- small math ----------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const sm = (x) => x * x * (3 - 2 * x);
const sm5 = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ease = (t, a, b) => sm(prog(t, a, b));
const win = (t, a, b, c, d) => Math.min(ease(t, a, b), 1 - ease(t, c, d));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (h) => new THREE.Color(h);
function rng(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = rng(20261015);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// ---------- merged low-poly geometry (one draw call for everything static) ----------
const ni = (g) => (g.index ? g.toNonIndexed() : g);
const GEO = {
  box: ni(new THREE.BoxGeometry(1, 1, 1)),
  cyl: ni(new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1)),
  cyl8: ni(new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1)),
  half: ni(new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false, 0, Math.PI)),
  ico: ni(new THREE.IcosahedronGeometry(0.5, 0)),
  ico1: ni(new THREE.IcosahedronGeometry(0.5, 1)),
};
class Merge {
  constructor() { this.p = []; this.n = []; this.c = []; }
  add(geo, m, color) {
    const P = geo.attributes.position, N = geo.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3();
    const c = color instanceof THREE.Color ? color : C(color);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); this.p.push(v.x, v.y, v.z);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); this.n.push(v.x, v.y, v.z);
      this.c.push(c.r, c.g, c.b);
    }
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
function M(x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, "YXZ"); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(V(x, y, z), _q, V(sx, sy, sz));
}
const mul = (a, b) => a.clone().multiply(b);
// axis-aligned box from bounds
const bx = (m, x0, x1, y0, y1, z0, z1, color, base) => {
  const k = M((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
  m.add(GEO.box, base ? mul(base, k) : k, color);
};

// ---------- canvas textures ----------
const FONT = '"PingFang TC","Noto Sans TC","Noto Sans CJK TC","Microsoft JhengHei","Heiti TC",sans-serif';
function tex(w, h, draw, srgb = true) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const glowTex = tex(128, 128, (g) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
}, false);
const dotTex = tex(64, 64, (g) => { g.fillStyle = "#fff"; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.fill(); }, false);
function bubbleTex(fill, mark) {
  return tex(128, 128, (g) => {
    g.shadowColor = "rgba(16,24,40,.25)"; g.shadowBlur = 10; g.shadowOffsetY = 3;
    g.fillStyle = fill; rr(g, 12, 16, 104, 76, 26); g.fill();
    g.beginPath(); g.moveTo(30, 84); g.lineTo(22, 112); g.lineTo(56, 88); g.closePath(); g.fill();
    g.shadowColor = "transparent";
    g.fillStyle = mark;
    if (fill === "#16C784") { // tick for ShopSitter's reply
      g.strokeStyle = mark; g.lineWidth = 11; g.lineCap = "round"; g.lineJoin = "round";
      g.beginPath(); g.moveTo(44, 54); g.lineTo(58, 68); g.lineTo(86, 40); g.stroke();
    } else {
      for (const x of [42, 64, 86]) { g.beginPath(); g.arc(x, 54, 7.5, 0, Math.PI * 2); g.fill(); }
    }
  });
}
const shutterTex = tex(64, 64, (g) => {
  g.fillStyle = "#CBD1D8"; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    g.fillStyle = "#AEB6BF"; g.fillRect(0, y, 64, 2);
    g.fillStyle = "#DDE2E7"; g.fillRect(0, y + 2, 64, 1.5);
  }
});
shutterTex.wrapS = shutterTex.wrapT = THREE.RepeatWrapping;
const poleTex = tex(64, 128, (g) => {
  g.fillStyle = "#F7F7F5"; g.fillRect(0, 0, 64, 128);
  const band = (color, off) => { g.fillStyle = color; for (let k = -2; k < 4; k++) { g.beginPath(); const y = k * 64 + off; g.moveTo(0, y); g.lineTo(64, y - 32); g.lineTo(64, y - 12); g.lineTo(0, y + 20); g.closePath(); g.fill(); } };
  band("#D8473E", 0); band("#3E6FD1", 32);
});
poleTex.wrapS = poleTex.wrapT = THREE.RepeatWrapping;
function scissors(g, cx, cy, s, color) {
  g.strokeStyle = color; g.lineWidth = s * 0.12; g.lineCap = "round";
  g.beginPath(); g.arc(cx - s * 0.28, cy + s * 0.3, s * 0.17, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(cx + s * 0.28, cy + s * 0.3, s * 0.17, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(cx - s * 0.16, cy + s * 0.16); g.lineTo(cx + s * 0.3, cy - s * 0.42); g.stroke();
  g.beginPath(); g.moveTo(cx + s * 0.16, cy + s * 0.16); g.lineTo(cx - s * 0.3, cy - s * 0.42); g.stroke();
}
function signTex(text, opt = {}) {
  const { bg = "#FFFFFF", ink = "#1E2732", accent = "#E07A5F", icon = false, w = 1024, h = 176 } = opt;
  return tex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    let x0 = 0;
    if (icon) { g.fillStyle = accent; g.fillRect(0, 0, h, h); scissors(g, h / 2, h / 2, h * 0.62, "#FFFFFF"); x0 = h; }
    g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `800 ${Math.round(h * 0.56)}px ${FONT}`;
    const chars = [...text], step = Math.min((w - x0) * 0.8 / chars.length, h * 0.78);
    const start = x0 + (w - x0) / 2 - (step * (chars.length - 1)) / 2;
    chars.forEach((ch, i) => g.fillText(ch, start + i * step, h * 0.53));
  });
}
function vsignTex(text, accent) {
  const w = 160, h = 640;
  return tex(w, h, (g) => {
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h);
    g.fillStyle = accent; g.fillRect(0, 0, w, 120); scissors(g, w / 2, 60, 86, "#FFFFFF");
    g.fillStyle = "#1E2732"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 92px ${FONT}`;
    [...text].forEach((ch, i) => g.fillText(ch, w / 2, 190 + i * 118));
  });
}

// ---------- the S mark as a shape (read from the page's SVG symbol, so the path lives in one place) ----------
function markShape(size) {
  const d = document.querySelector("#ss-mark path").getAttribute("d");
  const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < n.length; i += 2) pts.push(new THREE.Vector2(((n[i] - 256) / 512) * size, (-(n[i + 1] - 256) / 512) * size));
  if (pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
  return new THREE.Shape(pts);
}
function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ======================================================================================
function init() {
  const canvas = $("#world");
  let renderer;
  try {
    // three.js r169 needs WebGL2; check first so browsers without it get the plain card layout quietly
    if (!document.createElement("canvas").getContext("webgl2")) throw new Error("no webgl2");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "default" });
  } catch (e) {
    root.classList.add("no-webgl");
    return;
  }
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  let dpr = 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dpr));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0xffffff, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // only static geometry casts shadows: redraw them when the sun moves

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 40, 100);
  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 400);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0xe9edf2, 1.6);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.04;
  Object.assign(key.shadow.camera, { left: -26, right: 26, top: 24, bottom: -18, near: 1, far: 140 });
  key.shadow.camera.updateProjectionMatrix();
  key.target.position.set(0, 0, -3);
  scene.add(key, key.target);
  const shopLight = new THREE.PointLight(0xffd9a6, 0, 11, 1.6);
  shopLight.position.set(0, 2.9, -5.6);
  scene.add(shopLight);

  // ---------- sky disc: a big circle behind the street that carries the time of day ----------
  const skyU = {
    uTop: { value: C(0x222c63) }, uBot: { value: C(0x4a5aa8) }, uSunCol: { value: C(0xffd79a) },
    uNight: { value: 1 }, uSun: { value: 0 }, uSunY: { value: -0.7 }, uTime: { value: 0 },
  };
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: skyU, transparent: true, depthWrite: false, fog: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uSunCol;
      uniform float uNight; uniform float uSun; uniform float uSunY; uniform float uTime;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        float r = length(vUv);
        float aa = fwidth(r) * 1.4;
        float disc = 1.0 - smoothstep(1.0 - aa, 1.0, r);
        if (disc <= 0.0) discard;
        vec3 c = mix(uBot, uTop, smoothstep(-0.95, 0.85, vUv.y));
        vec2 q = (vUv + 1.0) * 15.0; vec2 cell = floor(q); vec2 f = fract(q) - 0.5;
        float h = hash(cell);
        vec2 jit = (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.6;
        float sd = length(f - jit);
        float tw = 0.6 + 0.4 * sin(uTime * 1.7 + h * 50.0);
        float star = step(0.86, h) * (1.0 - smoothstep(0.035, 0.085 + 0.03 * step(0.97, h), sd)) * tw;
        c = mix(c, vec3(1.0), star * uNight * smoothstep(-0.35, 0.35, vUv.y) * 0.95);
        vec2 mp = vec2(0.38, 0.42);
        float md = length(vUv - mp), md2 = length(vUv - mp - vec2(0.065, 0.04));
        float am = fwidth(md) * 1.5;
        float moon = (1.0 - smoothstep(0.125 - am, 0.125, md)) * smoothstep(0.112 - am, 0.112, md2);
        c += vec3(0.85, 0.9, 1.0) * 0.16 * uNight * exp(-md * md * 22.0);
        c = mix(c, vec3(1.0, 0.97, 0.88), moon * uNight);
        vec2 sp = vec2(-0.3, uSunY); float sdd = length(vUv - sp);
        c += uSunCol * 0.5 * uSun * exp(-sdd * sdd * 7.0);
        float sun = 1.0 - smoothstep(0.15 - fwidth(sdd) * 1.5, 0.15, sdd);
        c = mix(c, mix(uSunCol, vec3(1.0, 0.98, 0.92), 0.45), sun * uSun);
        gl_FragColor = vec4(c, disc);
        #include <colorspace_fragment>
      }`,
  }));
  sky.position.set(0.5, 19, -40);
  sky.scale.setScalar(12);
  sky.renderOrder = -1;
  scene.add(sky);

  // ---------- materials ----------
  const S = new Merge(); // static, lit
  const LIT = new Merge(); // warm lit windows at night
  const OWN = new Merge(); // the owner's window (lights up in the morning)
  const LAMP = new Merge(); // street lamp + pendant lamps glow
  const signs = []; // [geometry, texture]
  const W = 0.02; // tiny gaps between facades

  // ---------- ground & street ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf1f3f6, roughness: 1 }));
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);
  const ROAD0 = 1.6, ROAD1 = 9.8;
  bx(S, -80, 80, -0.02, 0.0, ROAD0, ROAD1, 0xe1e5ea);
  for (let x = -78; x < 78; x += 4.2) bx(S, x, x + 2.2, 0.0, 0.012, 5.62, 5.78, 0xffffff); // centre dashes
  bx(S, -80, 80, 0.0, 0.012, ROAD0 + 0.08, ROAD0 + 0.2, 0xd9574c); // red curb line (紅線)
  bx(S, -80, 80, 0.0, 0.012, ROAD1 - 0.2, ROAD1 - 0.08, 0xd9574c);
  bx(S, -80, 80, 0, 0.1, 0, ROAD0, 0xeceff2); // sidewalk
  bx(S, -80, 80, 0, 0.14, ROAD0 - 0.12, ROAD0, 0xd6dbe1); // curb
  bx(S, -80, 80, 0, 0.1, ROAD1, ROAD1 + 2.2, 0xeceff2);
  bx(S, -80, 80, 0, 0.14, ROAD1, ROAD1 + 0.12, 0xd6dbe1);
  for (let z = ROAD0 + 0.6; z < ROAD1 - 0.5; z += 0.9) bx(S, -15.6, -12.6, 0, 0.014, z, z + 0.45, 0xfafbfc); // zebra crossing

  // ---------- houses (透天厝 with 騎樓, 鐵窗, water tanks) ----------
  const G0 = 3.6, FL = 3.1, DEPTH = 10, ARC = 3; // ground-floor height, floor height, depth, arcade depth
  const anchors = {};
  const winY = (f) => G0 + (f - 1) * FL + 1.78; // centre of the window on upper floor f (1 = 2F)
  const tile = [0xe5e0d8, 0xe2e3e0, 0xe7e2db];
  function windowAt(m, xc, f, ww, o) {
    const yb = G0 + (f - 1) * FL, y0 = yb + 0.95, y1 = yb + 2.6;
    bx(m, xc - ww / 2, xc + ww / 2, y0, y1, -0.16, -0.08, 0x9fb2c4); // glass
    const fr = o.frame, t = 0.09;
    bx(m, xc - ww / 2 - t, xc + ww / 2 + t, y1, y1 + t, -0.16, 0.04, fr);
    bx(m, xc - ww / 2 - t, xc + ww / 2 + t, y0 - t, y0, -0.16, 0.06, fr);
    bx(m, xc - ww / 2 - t, xc - ww / 2, y0, y1, -0.16, 0.04, fr);
    bx(m, xc + ww / 2, xc + ww / 2 + t, y0, y1, -0.16, 0.04, fr);
    bx(m, xc - 0.03, xc + 0.03, y0, y1, -0.12, -0.04, fr); // mullion
    if (o.grille) { // 鐵窗 cage
      const gc = o.grilleColor, d = 0.42, x0 = xc - ww / 2 - 0.12, x1 = xc + ww / 2 + 0.12, ya = y0 - 0.12, yz = y1 + 0.1;
      bx(m, x0, x1, yz - 0.05, yz, 0, d, gc);
      bx(m, x0, x1, ya, ya + 0.06, 0, d, gc);
      bx(m, x0, x0 + 0.05, ya, yz, 0, d, gc);
      bx(m, x1 - 0.05, x1, ya, yz, 0, d, gc);
      for (let x = x0 + 0.22; x < x1 - 0.1; x += 0.22) bx(m, x - 0.018, x + 0.018, ya, yz, d - 0.04, d, gc);
      bx(m, x0, x1, (ya + yz) / 2 - 0.02, (ya + yz) / 2 + 0.02, d - 0.05, d, gc);
    }
    return V(xc, (y0 + y1) / 2, 0.5);
  }
  const litSpots = [];
  function lit(m, xc, f, ww, color) {
    const yb = G0 + (f - 1) * FL;
    bx(m, xc - ww / 2, xc + ww / 2, yb + 0.95, yb + 2.6, -0.078, -0.072, color);
    litSpots.push([V(xc, yb + 1.78, 0.35), color, ww]);
  }
  function house(o) {
    const { x0, x1, fl } = o, w = x1 - x0, xc = (x0 + x1) / 2, top = G0 + fl * FL;
    const wall = o.wall, wall2 = C(wall).multiplyScalar(0.94);
    // upper mass + floor bands
    bx(S, x0 + W, x1 - W, G0, top, -DEPTH, 0, wall);
    for (let f = 1; f <= fl; f++) bx(S, x0 + W, x1 - W, G0 + (f - 1) * FL - 0.06, G0 + (f - 1) * FL + 0.08, 0, 0.07, o.band);
    // ground floor: pillars, arcade floor, shop wall
    bx(S, x0 + W, x0 + 0.5, 0, G0, -0.55, 0, wall);
    bx(S, x1 - 0.5, x1 - W, 0, G0, -0.55, 0, wall);
    bx(S, x0, x1, 0, 0.15, -ARC, 0, pick(tile));
    bx(S, x0 + W, x1 - W, 0, G0, -DEPTH, -ARC, wall2);
    // parapet + roof things
    bx(S, x0 + W, x1 - W, top, top + 0.85, -0.24, 0, wall);
    bx(S, x0 + W, x0 + 0.24, top, top + 0.85, -DEPTH, 0, wall);
    bx(S, x1 - 0.24, x1 - W, top, top + 0.85, -DEPTH, 0, wall);
    if (o.shed) {
      const sc = o.shed;
      bx(S, x0 + 0.4, x1 - 0.4, top, top + 2.3, -DEPTH + 0.5, -DEPTH + 5.2, 0xe8eaec);
      S.add(GEO.box, M(xc, top + 2.55, -DEPTH + 2.85, w - 0.5, 0.12, 5.3, 0, 0.12), sc);
    }
    if (o.tank !== false) {
      const tx = xc + (o.tankX ?? (rnd() - 0.5) * (w - 2.4)), tz = o.tankZ ?? -2.6, ty = top + 1.25;
      bx(S, tx - 0.62, tx + 0.62, top + 0.9, top + 1.0, tz - 0.62, tz + 0.62, 0x8f99a5);
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) bx(S, tx + dx - 0.04, tx + dx + 0.04, top, top + 0.95, tz + dz - 0.04, tz + dz + 0.04, 0x8f99a5);
      S.add(GEO.cyl, M(tx, ty + 0.58, tz, 1.1, 1.15, 1.1), o.tankColor ?? 0xf0f2f4);
      S.add(GEO.cyl, M(tx, ty + 1.2, tz, 0.5, 0.12, 0.5), 0xd9dee3);
    }
    // windows
    const ww = w - 1.5;
    for (let f = 1; f <= fl; f++) {
      const a = windowAt(S, xc, f, ww, { frame: o.frame, grille: o.grilles?.includes(f), grilleColor: o.grilleColor ?? 0xf3f4f5 });
      if (o.lit?.[f]) lit(LIT, xc, f, ww, o.lit[f]);
      if (o.ac?.includes(f)) {
        const ay = G0 + (f - 1) * FL + 0.55, ax = x1 - 0.95;
        bx(S, ax - 0.4, ax + 0.4, ay - 0.27, ay + 0.27, 0, 0.38, 0xeef0f2);
        S.add(GEO.cyl, M(ax - 0.08, ay, 0.39, 0.38, 0.02, 0.38, 0, Math.PI / 2), 0xa3acb6);
        bx(S, ax - 0.4, ax + 0.4, ay - 0.31, ay - 0.27, 0, 0.42, 0x9aa3ad);
      }
      if (o.id && f === o.custFloor) anchors[o.id] = a;
      if (o.id2 && f === o.custFloor2) anchors[o.id2] = a;
    }
    // shutter + sign over the arcade
    if (o.shutter !== false) {
      const sw = w - 1.2, sh = 3.16;
      bx(S, xc - sw / 2 - 0.1, xc + sw / 2 + 0.1, 3.28, 3.58, -ARC - 0.02, -ARC + 0.32, 0xb5bec7);
      const sMat = new THREE.MeshStandardMaterial({ map: shutterTex.clone(), roughness: 0.6, metalness: 0.2 });
      sMat.map.needsUpdate = true;
      sMat.map.repeat.set(sw / 2, 9);
      const sGeo = new THREE.PlaneGeometry(sw, sh);
      sGeo.translate(0, -sh / 2, 0); // hinge at the top
      const shut = new THREE.Mesh(sGeo, sMat);
      shut.position.set(xc, 3.3, -ARC + 0.04);
      shut.receiveShadow = true;
      scene.add(shut);
      o.shutterMesh = shut;
    }
    if (o.sign) {
      bx(S, x0 + 0.18, x1 - 0.18, G0 + 0.1, G0 + 0.86, 0, 0.16, 0xf7f8f9);
      if (o.sign.text) {
        const g = new THREE.PlaneGeometry(w - 0.5, 0.66); g.translate(xc, G0 + 0.48, 0.165);
        signs.push([g, signTex(o.sign.text, { bg: o.sign.bg, ink: o.sign.ink, w: 1024, h: Math.round(1024 * 0.66 / (w - 0.5)) })]);
      } else bx(S, x0 + 0.3, x1 - 0.3, G0 + 0.22, G0 + 0.74, 0.16, 0.17, o.sign.bg);
    }
    return o;
  }

  const FR = 0xffffff;
  const row = [
    house({ x0: -25.6, x1: -21.0, fl: 3, wall: 0xedeae4, band: 0xe0dcd5, frame: FR, grilles: [1, 2], sign: { bg: 0xdfe6ec } }),
    house({ x0: -21.0, x1: -16.2, fl: 4, wall: 0xe3e7eb, band: 0xd7dce1, frame: FR, grilles: [1, 2, 3], ac: [2], sign: { bg: 0xf1e3cf }, lit: { 3: 0xffc65e }, tankColor: 0xd8dee3 }),
    house({ x0: -16.2, x1: -11.6, fl: 4, wall: 0xefe6da, band: 0xe1d7c9, frame: FR, grilles: [1, 2], ac: [1, 3], shed: 0x7f98b6, sign: { bg: 0xe4ece6 }, lit: { 4: 0xffbf52 }, id: "C", custFloor: 4 }),
    house({ x0: -11.6, x1: -7.0, fl: 5, wall: 0xe6e9ec, band: 0xd8dde2, frame: FR, grilles: [1, 2, 3, 4], ac: [2, 4], sign: { bg: 0xf3eadf }, lit: { 3: 0xffc65e }, tankX: 0.6 }),
    house({ x0: -7.0, x1: -2.4, fl: 3, wall: 0xe8ebee, band: 0xdadfe4, frame: FR, grilles: [1, 3], ac: [1], sign: { text: "早餐", bg: "#FFF5E2", ink: "#B5522B" }, lit: { 2: 0xffbf52 }, id: "A", custFloor: 2, tankX: -0.8 }),
    null, // the salon (built below)
    house({ x0: 2.4, x1: 7.2, fl: 3, wall: 0xf0e7e2, band: 0xe3d8d1, frame: FR, grilles: [1, 3], ac: [1], sign: { text: "咖啡", bg: "#F3EEE8", ink: "#5B4636" }, lit: { 2: 0xffc65e }, id: "B", custFloor: 2, shed: 0xb98a73 }),
    house({ x0: 7.2, x1: 11.8, fl: 5, wall: 0xe3e6ea, band: 0xd5dae0, frame: FR, grilles: [2, 3], ac: [1, 2], sign: { bg: 0xe2ecf2 }, lit: { 1: 0xffc65e, 4: 0xffbf52 }, id: "D", custFloor: 1 }),
    house({ x0: 11.8, x1: 16.6, fl: 3, wall: 0xefebe5, band: 0xe2ddd5, frame: FR, grilles: [1], ac: [2], sign: { bg: 0xf4e4e0 } }),
    house({ x0: 16.6, x1: 21.2, fl: 4, wall: 0xe6e9ec, band: 0xd9dde2, frame: FR, grilles: [1, 2, 3], sign: { bg: 0xe9eef1 }, lit: { 2: 0xffc65e } }),
  ];
  const breakfast = row[4], cafe = row[6];

  // ---------- the salon 小林美髮 (centre): shutter, interior, signs, barber pole, owner's window ----------
  const X0 = -2.4, X1 = 2.4, SW = X1 - X0, TOP = G0 + 3 * FL;
  const salonWall = 0xe4f1ea, salonBand = 0xd2e6db;
  bx(S, X0 + W, X1 - W, G0, TOP, -DEPTH, 0, salonWall);
  for (let f = 1; f <= 3; f++) bx(S, X0 + W, X1 - W, G0 + (f - 1) * FL - 0.06, G0 + (f - 1) * FL + 0.08, 0, 0.07, salonBand);
  bx(S, X0 + W, X0 + 0.5, 0, G0, -0.55, 0, salonWall);
  bx(S, X1 - 0.5, X1 - W, 0, G0, -0.55, 0, salonWall);
  bx(S, X0, X1, 0, 0.15, -ARC, 0, 0xe9e3da);
  bx(S, X0 + W, X0 + 0.6, 0, G0, -DEPTH, -ARC, salonWall);
  bx(S, X1 - 0.6, X1 - W, 0, G0, -DEPTH, -ARC, salonWall);
  bx(S, X0 + W, X1 - W, TOP, TOP + 0.85, -0.24, 0, salonWall);
  bx(S, X0 + W, X0 + 0.24, TOP, TOP + 0.85, -DEPTH, 0, salonWall);
  bx(S, X1 - 0.24, X1 - W, TOP, TOP + 0.85, -DEPTH, 0, salonWall);
  { // roof: water tank + stair house
    const tx = 1.25, tz = -4.5;
    bx(S, tx - 0.62, tx + 0.62, TOP + 0.9, TOP + 1.0, tz - 0.62, tz + 0.62, 0x8f99a5);
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) bx(S, tx + dx - 0.04, tx + dx + 0.04, TOP, TOP + 0.95, tz + dz - 0.04, tz + dz + 0.04, 0x8f99a5);
    S.add(GEO.cyl, M(tx, TOP + 1.83, tz, 1.1, 1.15, 1.1), 0xf0f2f4);
    S.add(GEO.cyl, M(tx, TOP + 2.45, tz, 0.5, 0.12, 0.5), 0xd9dee3);
    bx(S, -1.9, 0.95, TOP, TOP + 2.4, -8.6, -5.2, salonWall);
    bx(S, -2.0, 1.05, TOP + 2.4, TOP + 2.55, -8.7, -5.1, 0xcfe3d8);
  }
  // upper windows: 2F is the owner's bedroom (no grille, curtains), 3F/4F ordinary
  const ownerWin = windowAt(S, 0, 1, SW - 1.5, { frame: 0xffffff });
  { const yb = G0, y0 = yb + 0.95, y1 = yb + 2.6; // curtains
    bx(S, -1.65, -1.0, y0 + 0.05, y1 - 0.05, -0.07, -0.05, 0xbfe3d0);
    bx(S, 1.0, 1.65, y0 + 0.05, y1 - 0.05, -0.07, -0.05, 0xbfe3d0);
    bx(OWN, -1.65, 1.65, y0, y1, -0.078, -0.072, 0xffd27a);
    bx(S, -1.75, 1.75, y0 - 0.2, y0 - 0.1, -0.06, 0.3, 0xffffff); // sill
    for (let i = 0; i < 4; i++) S.add(GEO.ico, M(-1.3 + i * 0.85, y0 + 0.05, 0.16, 0.42, 0.34, 0.34, i), i % 2 ? 0x6fb68b : 0x83c39c); // window-box plants
  }
  windowAt(S, 0, 2, SW - 1.5, { frame: 0xffffff, grille: true, grilleColor: 0xf3f4f5 });
  windowAt(S, 0, 3, SW - 1.5, { frame: 0xffffff });
  { const ay = G0 + FL + 0.55; bx(S, 1.05, 1.85, ay - 0.27, ay + 0.27, 0, 0.38, 0xeef0f2); S.add(GEO.cyl, M(1.37, ay, 0.39, 0.38, 0.02, 0.38, 0, Math.PI / 2), 0xa3acb6); }
  anchors.O = ownerWin;
  // interior (seen once the shutter rolls up)
  {
    const zB = -8.4, zF = -ARC;
    bx(S, X0 + 0.5, X1 - 0.5, 0, 0.16, zB, zF, 0xd8cfc3); // wood floor
    bx(S, X0 + 0.5, X1 - 0.5, 0.16, G0 - 0.1, zB - 0.1, zB, 0xf5efe7); // back wall
    bx(S, X0 + 0.5, X0 + 0.6, 0.16, G0 - 0.1, zB, zF, 0xf1ebe3);
    bx(S, X1 - 0.6, X1 - 0.5, 0.16, G0 - 0.1, zB, zF, 0xf1ebe3);
    bx(S, X0 + 0.5, X1 - 0.5, G0 - 0.12, G0 - 0.08, zB, zF, 0xf8f6f2); // ceiling
    for (const mx of [-0.95, 0.95]) {
      bx(S, mx - 0.55, mx + 0.55, 1.05, 2.55, zB, zB + 0.04, 0xffffff); // mirror frame
      bx(S, mx - 0.47, mx + 0.47, 1.12, 2.48, zB + 0.04, zB + 0.06, 0xcfe2ec); // mirror
      bx(S, mx - 0.6, mx + 0.6, 0.86, 0.94, zB, zB + 0.4, 0xffffff); // counter
      // salon chair (facing the mirror)
      const cz = zB + 1.35;
      S.add(GEO.cyl, M(mx, 0.2, cz, 0.42, 0.06, 0.42), 0xbcc3cb);
      S.add(GEO.cyl, M(mx, 0.38, cz, 0.08, 0.36, 0.08), 0xbcc3cb);
      bx(S, mx - 0.3, mx + 0.3, 0.56, 0.72, cz - 0.28, cz + 0.28, 0x2e343b);
      bx(S, mx - 0.3, mx + 0.3, 0.72, 1.45, cz + 0.2, cz + 0.32, 0x2e343b);
      bx(S, mx - 0.34, mx - 0.28, 0.72, 0.86, cz - 0.24, cz + 0.2, 0x2e343b);
      bx(S, mx + 0.28, mx + 0.34, 0.72, 0.86, cz - 0.24, cz + 0.2, 0x2e343b);
    }
    bx(S, 0.75, 1.75, 0.16, 1.1, -4.5, -3.9, 0xffffff); // reception counter
    bx(S, 0.75, 1.75, 0.3, 0.95, -3.9, -3.88, 0xe07a5f);
    S.add(GEO.cyl, M(-1.45, 0.4, -3.7, 0.4, 0.5, 0.4), 0xd08f6e);
    S.add(GEO.ico, M(-1.45, 0.95, -3.7, 0.8, 0.8, 0.8), 0x6db58a);
    for (const lx of [-0.95, 0, 0.95]) {
      bx(S, lx - 0.01, lx + 0.01, 2.75, G0 - 0.1, -5.6, -5.58, 0x6b737c);
      S.add(GEO.cyl, M(lx, 2.72, -5.59, 0.34, 0.14, 0.34), 0xffffff);
      LAMP.add(GEO.cyl, M(lx, 2.64, -5.59, 0.3, 0.02, 0.3), 0xffe1ad);
    }
    // storefront: mullions + glass
    for (const fx of [-1.86, -0.62, 0.62, 1.86]) bx(S, fx - 0.04, fx + 0.04, 0.15, 3.25, zF - 0.06, zF, 0x2c3440);
    bx(S, -1.9, 1.9, 2.55, 2.62, zF - 0.06, zF, 0x2c3440);
    bx(S, -1.9, 1.9, 3.22, 3.3, zF - 0.06, zF, 0x2c3440);
    bx(S, 0.36, 0.42, 1.0, 1.6, zF - 0.02, zF + 0.04, 0xc9ced4); // door handle
    // two pots flanking the door
    for (const px of [-1.55, 1.55]) {
      S.add(GEO.cyl8, M(px, 0.38, -2.35, 0.48, 0.46, 0.48), 0xcf8e6c);
      S.add(GEO.ico1, M(px, 0.92, -2.35, 0.78, 0.86, 0.78), 0x6fb68b);
    }
  }
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.72, 3.08), new THREE.MeshStandardMaterial({ color: 0xd7e8f0, transparent: true, opacity: 0.28, roughness: 0.08, depthWrite: false }));
  glass.position.set(0, 1.7, -ARC - 0.03);
  scene.add(glass);
  // salon shutter
  bx(S, -2.0, 2.0, 3.28, 3.58, -ARC - 0.02, -ARC + 0.34, 0xb5bec7);
  const salonShutter = (() => {
    const sw = 3.84, sh = 3.16, mat = new THREE.MeshStandardMaterial({ map: shutterTex.clone(), roughness: 0.6, metalness: 0.2 });
    mat.map.needsUpdate = true; mat.map.repeat.set(sw / 2, 9);
    const g = new THREE.PlaneGeometry(sw, sh); g.translate(0, -sh / 2, 0);
    const m = new THREE.Mesh(g, mat); m.position.set(0, 3.3, -ARC + 0.045); m.receiveShadow = true; scene.add(m);
    return m;
  })();
  // signs
  bx(S, X0 + 0.15, X1 - 0.15, G0 + 0.08, G0 + 0.88, 0, 0.18, 0xffffff);
  { const g = new THREE.PlaneGeometry(SW - 0.5, 0.66); g.translate(0, G0 + 0.48, 0.185); signs.push([g, signTex("小林美髮", { icon: true, h: 152, w: 1024 })]); }
  { // vertical sign (直立招牌), sticking out from the facade
    const x = 2.08, z0 = 0.25, z1 = 1.45, y0 = 4.55, y1 = 8.95;
    bx(S, x - 0.13, x + 0.13, y0, y1, z0, z1, 0xffffff);
    bx(S, x - 0.03, x + 0.03, y0 + 0.4, y0 + 0.5, 0, z0, 0x8f99a5);
    bx(S, x - 0.03, x + 0.03, y1 - 0.5, y1 - 0.4, 0, z0, 0x8f99a5);
    const vt = vsignTex("小林美髮", "#E07A5F");
    for (const side of [-1, 1]) {
      const g = new THREE.PlaneGeometry(z1 - z0 - 0.12, y1 - y0 - 0.12);
      g.rotateY(side * Math.PI / 2); g.translate(x + side * 0.135, (y0 + y1) / 2, (z0 + z1) / 2);
      signs.push([g, vt]);
    }
  }
  // barber pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.25, 20, 1, true), new THREE.MeshStandardMaterial({ map: poleTex, roughness: 0.35 }));
  poleTex.repeat.set(1, 1.6);
  pole.position.set(-2.12, 1.85, 0.2);
  scene.add(pole);
  S.add(GEO.cyl, M(-2.12, 2.52, 0.2, 0.32, 0.1, 0.32), 0xc9ced4);
  S.add(GEO.ico1, M(-2.12, 2.62, 0.2, 0.24, 0.2, 0.24), 0xf1f3f5);
  S.add(GEO.cyl, M(-2.12, 1.18, 0.2, 0.32, 0.1, 0.32), 0xc9ced4);
  bx(S, -2.16, -2.08, 1.4, 1.55, -0.02, 0.12, 0xc9ced4);

  // ---------- street furniture ----------
  function scooter(x, z, ry, body) {
    const b = M(x, 0.1, z, 1, 1, 1, ry);
    const add = (geo, m, c) => S.add(geo, mul(b, m), c);
    add(GEO.box, M(0, 0.33, 0.05, 0.44, 0.1, 0.95), 0x3a4047);
    add(GEO.box, M(0, 0.56, -0.38, 0.52, 0.46, 0.78), body);
    add(GEO.box, M(0, 0.84, -0.32, 0.42, 0.12, 0.72), 0x2f343b);
    add(GEO.box, M(0, 0.62, 0.5, 0.5, 0.72, 0.2, 0, -0.22), body);
    add(GEO.box, M(0, 1.05, 0.56, 0.12, 0.5, 0.12, 0, -0.22), 0x3a4047);
    add(GEO.box, M(0, 1.27, 0.6, 0.66, 0.06, 0.07), 0x3a4047);
    add(GEO.box, M(0, 1.12, 0.66, 0.18, 0.1, 0.05), 0xf7f2e3);
    add(GEO.cyl, M(0, 0.23, 0.66, 0.44, 0.1, 0.44, 0, 0, Math.PI / 2), 0x2a2e33);
    add(GEO.cyl, M(0, 0.23, -0.58, 0.44, 0.12, 0.44, 0, 0, Math.PI / 2), 0x2a2e33);
  }
  scooter(-5.9, 0.95, 0.12, 0x9fd8bf);
  scooter(-4.95, 0.95, 0.05, 0xf3f4f5);
  scooter(4.0, 0.95, -0.08, 0x8ea3c0);
  scooter(12.9, 0.95, 0.1, 0xf3f4f5);
  function tree(x, z, s = 1) {
    bx(S, x - 0.5, x + 0.5, 0.1, 0.5, z - 0.5, z + 0.5, 0xd3d9df);
    S.add(GEO.cyl8, M(x, 1.5, z, 0.18 * s, 2.1 * s, 0.18 * s), 0x8b7a6b);
    S.add(GEO.ico1, M(x, 3.0 * s, z, 1.8 * s, 1.5 * s, 1.8 * s, 0.3), 0x79be95);
    S.add(GEO.ico1, M(x + 0.55 * s, 3.45 * s, z - 0.2, 1.3 * s, 1.15 * s, 1.3 * s, 1.1), 0x6ab389);
    S.add(GEO.ico1, M(x - 0.5 * s, 3.5 * s, z + 0.15, 1.2 * s, 1.0 * s, 1.2 * s, 2.0), 0x8bc9a4);
  }
  tree(7.25, 0.95);
  tree(-11.6, 0.95, 0.95);
  tree(16.6, 0.95, 0.9);
  // red + green mailboxes (郵筒)
  for (const [mx, c] of [[-9.75, 0xd9483b], [-9.2, 0x3f9c5e]]) {
    bx(S, mx - 0.17, mx + 0.17, 0.1, 0.35, 0.68, 1.02, 0x9aa3ad);
    bx(S, mx - 0.23, mx + 0.23, 0.35, 1.05, 0.62, 1.08, c);
    S.add(GEO.half, M(mx, 1.05, 0.85, 0.46, 0.46, 0.46, Math.PI / 2, 0, Math.PI / 2), c);
    bx(S, mx - 0.12, mx + 0.12, 0.86, 0.9, 1.07, 1.09, 0x2a2e33);
  }
  // street lamp
  const LX = -8.2, LZ = 1.25;
  S.add(GEO.cyl8, M(LX, 2.9, LZ, 0.15, 5.8, 0.15), 0x69737f);
  bx(S, LX - 0.04, LX + 0.04, 5.7, 5.8, LZ, LZ + 1.5, 0x69737f);
  bx(S, LX - 0.3, LX + 0.3, 5.62, 5.82, LZ + 1.25, LZ + 1.85, 0x4e5763);
  LAMP.add(GEO.box, M(LX, 5.6, LZ + 1.55, 0.5, 0.03, 0.5), 0xffe4ad);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffd9a0, transparent: true, depthWrite: false, opacity: 0.5, toneMapped: false }));
  pool.position.set(LX, 0.03, LZ + 1.6);
  pool.renderOrder = 2;
  scene.add(pool);

  // ---------- build meshes ----------
  const staticMesh = new THREE.Mesh(S.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 }));
  staticMesh.castShadow = true;
  staticMesh.receiveShadow = true;
  scene.add(staticMesh);
  const glowMat = (opacity) => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false, toneMapped: false });
  const litMesh = new THREE.Mesh(LIT.geometry(), glowMat(1)); scene.add(litMesh);
  const ownMesh = new THREE.Mesh(OWN.geometry(), glowMat(0)); scene.add(ownMesh);
  const lampMesh = new THREE.Mesh(LAMP.geometry(), glowMat(1)); scene.add(lampMesh);
  for (const [g, t] of signs) {
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    scene.add(m);
  }
  const groundGlows = [];
  for (const [p, c, ww] of litSpots) { // warm halo around each lit window (night only)
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, depthWrite: false, opacity: 0.4, toneMapped: false }));
    s.position.copy(p); s.scale.set(ww + 1.4, 2.7, 1); s.renderOrder = 1; scene.add(s); groundGlows.push(s);
  }

  // ---------- ShopSitter: the green S tile floating in front of the salon ----------
  const SIT = V(-0.6, 15.0, 1.4); // floats above the salon's roofline, in front of the sky disc
  const sitter = new THREE.Group();
  {
    const size = 1.6;
    const tileG = new THREE.ExtrudeGeometry(roundRect(size, size, size * 0.24), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 10 });
    tileG.translate(0, 0, -0.08);
    const tileM = new THREE.MeshStandardMaterial({ color: 0x16c784, roughness: 0.4, metalness: 0, emissive: 0x16c784, emissiveIntensity: 0.18 });
    const tile = new THREE.Mesh(tileG, tileM);
    const sG = new THREE.ExtrudeGeometry(markShape(size * 0.6), { depth: 0.035, bevelEnabled: false, curveSegments: 1 });
    sG.translate(0, 0, 0.13);
    const sM = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const s = new THREE.Mesh(sG, sM);
    sitter.add(tile, s);
    sitter.userData = { tileM, sM };
  }
  sitter.position.copy(SIT);
  scene.add(sitter);
  const sitterGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x16c784, transparent: true, depthWrite: false, opacity: 0.4, toneMapped: false, blending: THREE.AdditiveBlending }));
  sitterGlow.scale.set(4.2, 4.2, 1);
  scene.add(sitterGlow);
  const ringMat = () => new THREE.MeshBasicMaterial({ color: 0x16c784, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 64), ringMat()); m.renderOrder = 3; scene.add(m); return m; });

  // ---------- message flows: dotted arcs + a small bubble travelling along each ----------
  const SHOP = V(0.4, 1.7, -2.4); // the owner, in the shop, in the morning
  const P = { A: anchors.A, B: anchors.B, C: anchors.C, D: anchors.D, O: anchors.O, S: SIT, SHOP };
  const inTex = bubbleTex("#7F8DA3", "#FFFFFF"), outTex = bubbleTex("#16C784", "#FFFFFF");
  const FLOWS = [
    ["A", "S", 0, 0.38, 0.72], ["C", "S", 0, 0.5, 0.84], ["B", "S", 0, 0.6, 0.94], ["D", "S", 0, 0.72, 1.06],
    ["S", "A", 1, 1.28, 1.52], ["S", "B", 1, 1.4, 1.64], ["S", "C", 1, 1.48, 1.72], ["S", "D", 1, 1.56, 1.8],
    ["A", "S", 0, 1.92, 2.08], ["S", "A", 1, 2.14, 2.3], ["S", "O", 1, 2.5, 2.8],
    ["O", "S", 1, 3.7, 3.84], ["S", "A", 1, 3.84, 3.98],
    ["SHOP", "S", 1, 4.48, 4.66],
    ["C", "S", 0, 5.08, 5.22], ["S", "C", 1, 5.24, 5.38],
  ].map(([a, b, out, t0, t1]) => {
    const pa = P[a].clone(), pb = P[b].clone();
    const mid = pa.clone().lerp(pb, 0.5); mid.y += 1.2 + pa.distanceTo(pb) * 0.18; mid.z += 1.2;
    const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);
    const N = Math.max(12, Math.round(curve.getLength() / 0.36));
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(N));
    const mat = new THREE.PointsMaterial({ color: out ? 0x16c784 : 0x8593aa, size: 0.24, map: dotTex, transparent: true, depthWrite: false, alphaTest: 0.05, toneMapped: false });
    const dots = new THREE.Points(geo, mat);
    dots.renderOrder = 4; dots.frustumCulled = false; geo.setDrawRange(0, 0);
    scene.add(dots);
    const tok = new THREE.Sprite(new THREE.SpriteMaterial({ map: out ? outTex : inTex, transparent: true, depthWrite: false, toneMapped: false }));
    tok.scale.set(0.95, 0.95, 1); tok.renderOrder = 5; tok.visible = false; scene.add(tok);
    return { curve, dots, mat, tok, N, t0, t1, into: b === "S" && !out, arrive: b === "S" };
  });
  const arrivals = FLOWS.filter((f) => f.arrive).map((f) => f.t1);

  // ---------- camera path (one key per chapter; pp/tp = portrait overrides) ----------
  const SKY_F = SIT; // the sky disc sits right behind the S tile, like a halo
  const K = (s, p, t, o = {}) => ({ s, p, t, ox: o.ox ?? 0.15, oy: o.oy ?? 0.2, pp: o.pp, tp: o.tp, sf: o.sf ?? SKY_F, sfp: o.sfp ?? o.sf ?? SKY_F });
  const KEYS = [
    K(0, V(14, 7.5, 47), V(1, 10.8, -6), { ox: 0.19, oy: 0.235, pp: V(6, 10, 46), tp: V(-0.4, 14.4, -2) }),
    K(1, V(-5, 10, 33), V(-2.2, 10.5, -1), { ox: 0.185, oy: 0.2, pp: V(-4, 10.5, 33), tp: V(-2.2, 12.2, -1) }),
    K(2, V(6, 10.5, 34), V(0, 10.5, -1), { ox: 0.185, oy: 0.2, pp: V(2, 11, 34), tp: V(0, 12.2, -1) }),
    K(3, V(-6.5, 9.5, 29), V(-0.8, 10.4, -0.5), { ox: 0.18, oy: 0.2, pp: V(-4, 10, 30), tp: V(-0.6, 11.6, -0.5) }),
    K(4, V(-10, 8, 33), V(-1.8, 10.5, -2), { ox: 0.18, oy: 0.2, pp: V(-6, 9, 34), tp: V(-1.6, 12.2, -2) }),
    K(5, V(12, 3.4, 14.5), V(0.2, 3.2, -1.5), { ox: 0.16, oy: 0.2, pp: V(5, 4.0, 17), tp: V(-0.2, 3.9, -1.5) }),
    K(6, V(-14, 7.5, 47), V(0, 10.8, -6), { ox: 0.19, oy: 0.17, pp: V(-6, 10, 50), tp: V(0.4, 11.8, -2) }),
  ];
  const cp = new THREE.Vector3(), ct = new THREE.Vector3(), cf = new THREE.Vector3(), sd = new THREE.Vector3();

  function placeCamera(t) {
    let i = 0;
    while (i < KEYS.length - 2 && t >= KEYS[i + 1].s) i++;
    const a = KEYS[i], b = KEYS[i + 1], k = sm5(prog(t, a.s, b.s));
    const w = window.innerWidth, h = window.innerHeight, asp = w / h, portrait = asp < 1;
    cp.lerpVectors(portrait && a.pp ? a.pp : a.p, portrait && b.pp ? b.pp : b.p, k);
    ct.lerpVectors(portrait && a.tp ? a.tp : a.t, portrait && b.tp ? b.tp : b.t, k);
    cf.lerpVectors(portrait ? a.sfp : a.sf, portrait ? b.sfp : b.sf, k);
    const pull = asp < 1.25 ? 1 + (1.25 - asp) * 0.42 : 1;
    camera.position.copy(ct).add(cp.sub(ct).multiplyScalar(pull));
    camera.lookAt(ct);
    const ox = lerp(a.ox, b.ox, k), oy = lerp(a.oy, b.oy, k);
    if (!portrait) camera.setViewOffset(w, h, -ox * w, 0, w, h);
    else camera.setViewOffset(w, h, 0, oy * h, w, h);
    camera.updateMatrixWorld();
    sd.copy(cf).sub(camera.position); // sky disc: fixed angular size, always behind the focus point
    const sdist = sd.length() + 40;
    sky.position.copy(camera.position).addScaledVector(sd.normalize(), sdist);
    sky.scale.setScalar(sdist * Math.tan(((portrait ? 6.2 : 7.6) * Math.PI) / 180));
    sky.quaternion.copy(camera.quaternion);
    const d = camera.position.distanceTo(ct);
    scene.fog.near = d * 1.05;
    scene.fog.far = d * 2.2 + 18;
  }
  function fitFov() {
    const asp = window.innerWidth / window.innerHeight;
    camera.fov = asp < 1 ? 34 : 30;
    camera.aspect = asp;
    camera.updateProjectionMatrix();
  }
  fitFov();

  // ---------- time of day ----------
  const NIGHT = { top: C(0x222c63), bot: C(0x4a5aa8), hemiS: C(0xc3caf0), hemiG: C(0xe2e3ee), key: C(0xd8deff), dir: V(-0.55, 0.85, 0.75).normalize() };
  const DAWN = { top: C(0x9fb3e6), bot: C(0xffcfa6) };
  const DAY = { top: C(0xbfe9d6), bot: C(0xf1fbf6), hemiS: C(0xffffff), hemiG: C(0xe8ecf0), key: C(0xfff3e2), dir: V(0.6, 0.78, 0.55).normalize() };
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), dirV = new THREE.Vector3();
  function timeOfDay(t) {
    const day = ease(t, 3.2, 4.15), dawn = win(t, 3.1, 3.55, 3.9, 4.45), night = 1 - day;
    tmpC.copy(NIGHT.top).lerp(DAY.top, day); tmpC2.copy(DAWN.top); skyU.uTop.value.copy(tmpC).lerp(tmpC2, dawn * 0.85);
    tmpC.copy(NIGHT.bot).lerp(DAY.bot, day); tmpC2.copy(DAWN.bot); skyU.uBot.value.copy(tmpC).lerp(tmpC2, dawn * 0.9);
    skyU.uNight.value = night;
    skyU.uSun.value = ease(t, 3.2, 3.6);
    skyU.uSunY.value = lerp(-0.6, 0.36, ease(t, 3.2, 4.1));
    hemi.color.copy(NIGHT.hemiS).lerp(DAY.hemiS, day);
    hemi.groundColor.copy(NIGHT.hemiG).lerp(DAY.hemiG, day);
    hemi.intensity = lerp(3.0, 1.95, day);
    key.color.copy(NIGHT.key).lerp(DAY.key, day);
    tmpC.setRGB(1, 0.86, 0.72); key.color.lerp(tmpC, dawn * 0.5);
    key.intensity = lerp(0.75, 2.45, day);
    dirV.copy(NIGHT.dir).lerp(DAY.dir, day).normalize();
    key.position.copy(key.target.position).addScaledVector(dirV, 60);
    litMesh.material.opacity = night;
    lampMesh.material.opacity = Math.max(night, ease(t, 4.15, 4.5));
    pool.material.opacity = 0.55 * night;
    for (const g of groundGlows) g.material.opacity = 0.42 * night;
    ownMesh.material.opacity = win(t, 3.3, 3.55, 4.6, 5.0);
    sitter.userData.tileM.emissiveIntensity = lerp(0.12, 0.3, night);
    renderer.toneMappingExposure = lerp(1.0, 1.04, day);
    return { day, night };
  }

  // ---------- HUD (HTML labels pinned to 3D points) ----------
  const topbar = $(".topbar");
  const hud = (id, p, pp) => { const el = $(id); return { el, p, pp: pp || p, w: 0, h: 0, mini: el.querySelector(".mini") }; }; // pp: anchor on portrait screens
  const H = {
    status: hud("#hud-status", V(0, 1.15, -2.0)),
    sitter: hud("#hud-sitter", SIT.clone().add(V(0, 0.95, 0))),
    zzz: hud("#hud-zzz", anchors.O.clone().add(V(1.15, 0.55, 0))),
    a: hud("#hud-a", anchors.A.clone().add(V(0.9, 1.0, 0)), anchors.A.clone().add(V(0.9, -0.7, 0))),
    b: hud("#hud-b", anchors.B.clone().add(V(0.2, 1.0, 0))),
    owner: hud("#hud-owner", anchors.O.clone().add(V(0.2, 1.05, 0))),
    notify: hud("#hud-notify", anchors.A.clone().add(V(0, 1.0, 0))),
    manage: hud("#hud-manage", V(1.2, 3.6, 0.8)),
    c: hud("#hud-c", V(5.4, 3.0, 0.6), V(1.0, 0.9, 0.8)), // a customer asking after the change (café side / below the chat on phones)
  };
  const timeEl = $("#hud-time"), stateEl = $("#hud-state"), statusPill = $("#hud-status .pill");
  const ownerCard = $("#owner-card");
  const cards = [...document.querySelectorAll(".story .card")];
  const chatIns = [...document.querySelectorAll(".chat-in")];
  const heroInner = $(".hero-inner");
  const bubbles = [...document.querySelectorAll(".hud [data-at]")].map((el) => ({ el, at: parseFloat(el.dataset.at), on: false }));
  let statusKey = "";
  const pv = new THREE.Vector3();
  let hudLast = performance.now();
  function hudFrame(t) {
    const now = performance.now(), fadeK = 1 - Math.exp(-Math.min(now - hudLast, 250) / 90);
    hudLast = now;
    const showStatus = Math.max(win(t, -1, -0.5, 0.4, 0.6), win(t, 3.42, 3.62, 4.3, 4.45), win(t, 5.45, 5.62, 9, 10));
    const showSitter = Math.max(win(t, -1, -0.5, 0.4, 0.6), win(t, 5.55, 5.8, 9, 10));
    const heroPortrait = window.innerWidth < window.innerHeight && t < 0.6; // phones: keep the hero clean
    // [label, visibility, soft]. Hard labels carry the story; soft ones step aside (fade out) when they
    // would cover a chapter card or a label placed before them.
    const vis = [
      [H.a, win(t, 0.48, 0.64, 2.52, 2.64), false], [H.owner, win(t, 2.66, 2.8, 4.3, 4.42), false],
      [H.manage, win(t, 4.44, 4.56, 5.5, 5.66), false], [H.notify, win(t, 3.9, 4.0, 4.3, 4.42), true],
      [H.b, win(t, 0.66, 0.82, 2.0, 2.18), true], [H.c, win(t, 5.04, 5.16, 5.82, 5.96), true],
      [H.sitter, showSitter, true], [H.status, heroPortrait ? 0 : showStatus, true], [H.zzz, heroPortrait ? 0 : win(t, -1, -0.5, 3.2, 3.38), true],
    ];
    // content state
    let sk, time, state;
    if (t < 3.35) { sk = "night"; time = "23:47"; state = "已打烊"; }
    else if (t < 4.3) { sk = "dawn"; time = "08:30"; state = "早安"; }
    else if (t < 4.98) { sk = "open"; time = "10:00"; state = "營業中"; }
    else { sk = "open2"; time = "10:00"; state = "營業中・明天公休"; }
    if (sk !== statusKey) {
      statusKey = sk; timeEl.textContent = time; stateEl.textContent = state;
      statusPill.className = "pill " + (sk === "open2" ? "open" : sk);
    }
    ownerCard.classList.toggle("is-done", t >= 3.7);
    for (const b of bubbles) { const on = t >= b.at; if (on !== b.on) { b.on = on; b.el.classList.toggle("on", on); } }
    // a full chat scrolls its messages up with a transform (never by layout, so nothing on the page shifts)
    for (const ci of chatIns) {
      const box = ci.parentElement, cs = getComputedStyle(box);
      const over = Math.max(0, Math.round(ci.offsetHeight - (box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom))));
      if (over !== ci._over) { ci._over = over; ci.style.transform = over ? `translateY(${-over}px)` : ""; box.classList.toggle("over", over > 0); }
    }
    // measure, then write
    const vw = window.innerWidth, vh = window.innerHeight, topY = topbar.offsetHeight + 8;
    for (const [o, a] of vis) {
      o.a = a;
      if (a <= 0.02) continue;
      o.w = o.el.offsetWidth; o.h = o.el.offsetHeight; o.cl = 0; o.cr = o.w;
      if (o.mini) { // a mini chat has a fixed width; only its visible bubbles count as occupied space
        let l = 1e9, r = -1e9;
        for (const m of o.mini.children) if (m.offsetWidth) { l = Math.min(l, m.offsetLeft); r = Math.max(r, m.offsetLeft + m.offsetWidth); }
        if (r > l) { o.cl = l; o.cr = r; }
      }
    }
    const placed = [];
    for (const c of cards) { // chapter cards on screen are obstacles for soft labels
      const r = c.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) placed.push({ l: r.left - 4, r: r.right + 4, t: r.top - 4, b: r.bottom + 4 });
    }
    const hr = heroInner.getBoundingClientRect(); // so is the hero text (on portrait screens, with its white backing panel)
    if (hr.bottom > 0 && hr.top < vh) placed.push(vw < vh ? { l: 0, r: vw, t: hr.top - 110, b: hr.bottom + 40 } : { l: hr.left - 4, r: hr.right + 4, t: hr.top - 4, b: hr.bottom + 4 });
    for (let i = 0; i < vis.length; i++) {
      const o = vis[i][0], soft = vis[i][2], el = o.el;
      let a = o.a;
      if (a > 0.02) pv.copy(vw < vh ? o.pp : o.p).project(camera);
      if (a <= 0.02 || pv.z > 1 || Math.abs(pv.x) > 1.35 || Math.abs(pv.y) > 1.35) {
        o.clear = undefined;
        if (el.style.visibility !== "hidden") { el.style.visibility = "hidden"; el.style.opacity = "0"; }
        continue;
      }
      const x = clamp((pv.x * 0.5 + 0.5) * vw, o.w / 2 + 10, vw - o.w / 2 - 10);
      const y = Math.max((-pv.y * 0.5 + 0.5) * vh, topY + o.h);
      const r = { l: x - o.w / 2 + o.cl - 6, r: x - o.w / 2 + o.cr + 6, t: y - o.h - 6, b: y + 6 };
      const hit = soft && placed.some((q) => r.l < q.r && r.r > q.l && r.t < q.b && r.b > q.t);
      const goal = hit ? 0 : 1;
      o.clear = REDUCE || o.clear === undefined ? goal : lerp(o.clear, goal, fadeK);
      if (Math.abs(o.clear - goal) < 0.02) o.clear = goal;
      a *= o.clear;
      if (a <= 0.02) { if (el.style.visibility !== "hidden") { el.style.visibility = "hidden"; el.style.opacity = "0"; } continue; }
      if (!hit) placed.push(r);
      el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
      el.style.opacity = a.toFixed(3);
      el.style.visibility = "visible";
    }
  }

  // ---------- per-frame scene state ----------
  const tp = new THREE.Vector3();
  function sceneFrame(t, time) {
    timeOfDay(t);
    skyU.uTime.value = REDUCE ? 0 : time;
    // shutters
    const open = ease(t, 4.12, 4.55);
    salonShutter.scale.y = lerp(1, 0.06, open);
    salonShutter.material.map.repeat.y = 9 * salonShutter.scale.y;
    const bOpen = ease(t, 3.62, 3.98);
    breakfast.shutterMesh.scale.y = lerp(1, 0.06, bOpen);
    breakfast.shutterMesh.material.map.repeat.y = 9 * breakfast.shutterMesh.scale.y;
    shopLight.intensity = 9 * open;
    if (!REDUCE && open > 0.5) poleTex.offset.y = (time * 0.35) % 1;
    // the S tile: gentle hover; pulses when a message arrives
    const bob = REDUCE ? 0 : Math.sin(time * 1.4) * 0.08;
    sitter.position.set(SIT.x, SIT.y + bob, SIT.z);
    const yaw = Math.atan2(camera.position.x - SIT.x, camera.position.z - SIT.z) * 0.75;
    sitter.rotation.set(0, yaw + (REDUCE ? 0 : Math.sin(time * 0.7) * 0.08), REDUCE ? 0 : Math.sin(time * 0.9) * 0.03);
    sitterGlow.position.copy(sitter.position).add(V(0, 0, -0.35));
    sitterGlow.material.opacity = 0.5 * skyU.uNight.value;
    let pulse = 0;
    for (const ta of arrivals) pulse = Math.max(pulse, win(t, ta - 0.04, ta, ta + 0.02, ta + 0.2));
    rings.forEach((r, i) => {
      let k, base = 0;
      if (i < 2) { // scroll-driven pulse at each arrival
        let best = -1;
        for (const ta of arrivals) { const p = (t - ta) / 0.28 - i * 0.25; if (p >= 0 && p <= 1) best = Math.max(best, p); }
        k = best;
        base = k >= 0 ? (1 - k) * 0.55 : 0;
      } else { // idle breathing ring
        k = REDUCE ? -1 : (time * 0.45) % 1;
        base = k >= 0 ? (1 - k) * 0.16 * (0.3 + 0.7 * skyU.uNight.value) : 0;
      }
      r.visible = base > 0.01;
      if (!r.visible) return;
      r.position.copy(sitter.position).add(V(0, 0, -0.1));
      r.quaternion.copy(camera.quaternion);
      r.scale.setScalar(0.95 + k * 1.15);
      r.material.opacity = base;
    });
    sitter.scale.setScalar(1 + pulse * 0.08);
    // flows
    for (const f of FLOWS) {
      const p = prog(t, f.t0, f.t1);
      const fade = 1 - ease(t, f.t1 + 0.12, f.t1 + 0.4);
      const shown = p > 0 && fade > 0;
      f.dots.visible = shown;
      if (shown) {
        f.dots.geometry.setDrawRange(0, Math.ceil(sm(p) * (f.N + 1)));
        f.mat.opacity = 0.95 * fade;
      }
      const moving = p > 0 && p < 1;
      f.tok.visible = moving;
      if (moving) {
        f.curve.getPoint(sm(p), tp);
        f.tok.position.copy(tp);
        const s = 0.95 * Math.min(1, p * 6, (1 - p) * 6 + 0.35);
        f.tok.scale.set(s, s, 1);
      }
    }
  }

  // ---------- scroll → t ----------
  const chapters = [...document.querySelectorAll("[data-ch]")];
  let centers = [];
  function measure() {
    centers = chapters.map((el) => { const r = el.getBoundingClientRect(); return r.top + window.scrollY + r.height / 2; });
  }
  function scrollT() {
    const y = window.scrollY + window.innerHeight / 2;
    if (y <= centers[0]) return 0;
    for (let i = 0; i < centers.length - 1; i++) if (y < centers[i + 1]) return i + (y - centers[i]) / (centers[i + 1] - centers[i]);
    return centers.length - 1;
  }

  // ---------- render loop: render while scrolling; idle animation at 30 fps, then sleep ----------
  const info = $("#details");
  const IDLE_MS = 15000, IDLE_FRAME = 1000 / 30;
  let U = 0, shadowU = -1, lastRaw = -1, first = true, running = false, lastInput = performance.now(), lastFrame = 0, fpsT = 0, fpsN = 0;
  const clock = new THREE.Clock();
  function wake() {
    lastInput = performance.now();
    if (!running) { running = true; clock.getDelta(); requestAnimationFrame(frame); }
  }
  function frame(now) {
    const covered = !first && info.getBoundingClientRect().top <= 0;
    if (!first && (covered || document.hidden || now - lastInput > IDLE_MS)) { running = false; return; }
    requestAnimationFrame(frame);
    let raw = scrollT();
    if (REDUCE) raw = Math.round(raw); // reduced motion: one still picture per chapter
    const moving = first || raw !== lastRaw || Math.abs(raw - U) > 5e-4;
    if (!moving && (REDUCE || now - lastFrame < IDLE_FRAME)) return;
    const realDt = clock.getDelta(), dt = Math.min(realDt, 0.06), time = clock.elapsedTime;
    U = REDUCE || first ? raw : U + (raw - U) * (1 - Math.exp(-Math.min(realDt, 0.25) * 6));
    if (Math.abs(raw - U) < 2e-4) U = raw;
    placeCamera(U);
    sceneFrame(U, time);
    if (U !== shadowU) { renderer.shadowMap.needsUpdate = true; shadowU = U; }
    renderer.render(scene, camera);
    hudFrame(U);
    lastRaw = raw; lastFrame = now;
    if (first) { canvas.classList.add("ready"); first = false; }
    if (moving && dpr > 1 && !REDUCE) { // drop resolution once if the device struggles
      fpsT += dt; fpsN++;
      if (fpsT > 1.5) { if (fpsN / fpsT < 30) { dpr = 1; renderer.setPixelRatio(1); } fpsT = 0; fpsN = 0; }
    }
  }
  ["scroll", "wheel", "pointermove", "pointerdown", "touchstart", "keydown"].forEach((e) => window.addEventListener(e, wake, { passive: true }));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    fitFov();
    measure();
    wake();
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("load", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();
  running = true;
  requestAnimationFrame(frame);
}

init();
