import * as THREE from 'three';

/* Palvoo 3D 首頁：黃昏的西部走廊。
   捲動位置 s（0＝開場、1～5＝五個章節、6＝結尾）決定鏡頭與那台聯結車在哪裡。
   顏色的分工：車與景物用真實世界的顏色；橘色只給平台那一層（路線、通知的波紋、標記、畫面上的小卡）——
   平台不擁有車輛，車身不漆成品牌色。 */

const $ = (s) => document.querySelector(s);
const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const seg = (s, a, b) => clamp((s - a) / (b - a), 0, 1);
const bump = (s, a, b, c, d) => Math.min(smooth(seg(s, a, b)), 1 - smooth(seg(s, c, d)));
const C = (hex) => new THREE.Color(hex);

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const R = rng(926);
const pick = (arr) => arr[Math.floor(R() * arr.length)];
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash2(xi, zi), hash2(xi + 1, zi), u), lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), u), v);
}
function fbm(x, z) { let f = 0, a = 0.5; for (let i = 0; i < 5; i++) { f += a * vnoise(x, z); x *= 2.03; z *= 2.03; a *= 0.5; } return f; }

/* ── 地形：西邊是海（x 小）、中間平原、東邊是中央山脈；z 往正是往南 ── */
const coastX = (z) => -38 + 3.2 * Math.sin(z * 0.045) + 1.6 * Math.sin(z * 0.13 + 1.3);
function heightAt(x, z) {
  const cx = coastX(z);
  if (x < cx) return lerp(0.0, -2.4, smooth(clamp((cx - x) / 6, 0, 1)));
  let h = 0;
  const f1 = smooth(clamp((x - 22) / 14, 0, 1));
  h += f1 * (2.5 + 5 * fbm(x * 0.05 + 7, z * 0.05));
  const f2 = smooth(clamp((x - 34) / 26, 0, 1));
  const r = 1 - Math.abs(fbm(x * 0.035 + 3, z * 0.03) * 2 - 1);
  h += f2 * (6 + 24 * r * r);
  h += smooth(clamp((x - 70) / 60, 0, 1)) * (10 + 18 * fbm(x * 0.02, z * 0.025 + 5));
  return h;
}

/* ── 很多個方塊合併成一個網格，省下繪製次數 ── */
const flat = (g) => (g.index ? g.toNonIndexed() : g);
const GEO = {
  box: flat(new THREE.BoxGeometry(1, 1, 1)),
  cyl: flat(new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1)),
  cone: flat(new THREE.ConeGeometry(0.5, 1, 6, 1)),
  ico: flat(new THREE.IcosahedronGeometry(0.5, 0)),
  // 溫室：半圓筒，圓的那一面朝上、長邊沿 z
  tunnel: flat(new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2)),
};
class Batch {
  constructor() { this.p = []; this.n = []; this.c = []; }
  add(geo, m, color) {
    const p = geo.attributes.position, n = geo.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); this.p.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); this.n.push(v.x, v.y, v.z);
      this.c.push(color.r, color.g, color.b);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}
const EU = new THREE.Euler(), QU = new THREE.Quaternion();
function M(x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
  EU.set(rx, ry, rz, 'YXZ'); QU.setFromEuler(EU);
  return new THREE.Matrix4().compose(V(x, y, z), QU, V(sx, sy, sz));
}
const within = (parent, local) => parent.clone().multiply(local);

function main() {
  const canvas = $('#world');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    root.classList.add('no-webgl');
    return;
  }
  const phone = Math.min(window.innerWidth, window.innerHeight) < 600;
  let dprCap = phone ? 1.5 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 1, 1600);

  /* ── 光：太陽低低地在西北西的海上（台灣夏天日落的方位），影子往東南拉長 ── */
  const sunDir = V(-0.86, 0.36, -0.40).normalize();
  const sun = new THREE.DirectionalLight(0xffb27a, 3.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 520;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0x8ea3d6, 0x5a4a3e, 1.45));

  /* ── 天空：頂上是藍、地平線是橘，太陽那一側有光暈，高處幾顆星 ── */
  const skyU = {
    top: { value: C(0x0c1322) }, mid: { value: C(0x34375a) }, hor: { value: C(0xeea064) },
    low: { value: C(0x2a2f3a) }, sunDir: { value: sunDir }, sunCol: { value: C(0xffd09a) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 40, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 low; uniform vec3 sunDir; uniform vec3 sunCol;
        varying vec3 vDir;
        float hsh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir); float h = d.y;
          float s = max(dot(d, normalize(sunDir)), 0.0);
          vec3 horizon = mix(mix(hor, mid, 0.55), hor, pow(s, 1.5));
          vec3 c = mix(horizon, mid, smoothstep(0.0, 0.26, h));
          c = mix(c, top, smoothstep(0.26, 0.8, h));
          c = h < 0.0 ? mix(horizon, low, smoothstep(0.0, -0.18, h)) : c;
          c += sunCol * (pow(s, 1400.0) * 2.2 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12);
          vec3 cell = floor(d * 240.0);
          float star = step(0.9975, hsh(cell)) * smoothstep(0.35, 0.8, h) * (1.0 - pow(s, 2.0));
          c += vec3(star) * 0.9;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -1;
  scene.add(sky);
  // 霧的顏色＝背對太陽那一側的地平線，遠山才會融進天色裡
  scene.fog = new THREE.Fog(skyU.hor.value.clone().lerp(skyU.mid.value, 0.55), 110, 300);

  const staticBatch = new Batch();   // 受光、會投影的（建築、車站、風機塔、港）
  const glowBatch = new Batch();     // 自己亮的（窗、招牌燈）

  /* ── 地形 ── */
  {
    const g = new THREE.PlaneGeometry(280, 320, 175, 200);
    g.rotateX(-Math.PI / 2);
    g.translate(20, 0, 0);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const sand = C(0xc2a97c), ridge = C(0x62704a), hill1 = C(0x566f43), hill2 = C(0x44603d), mtn = C(0x4a5a58), rock = C(0x777a82), deep = C(0x1b3340);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = heightAt(x, z);
      pos.setY(i, y);
      const cx = coastX(z);
      if (x < cx - 0.5) tmp.copy(deep);
      else if (x < cx + 2.6) tmp.copy(sand);
      else if (y < 0.05) tmp.copy(ridge);
      else if (y < 7) tmp.copy(hill1).lerp(hill2, fbm(x * 0.2, z * 0.2));
      else if (y < 18) tmp.copy(hill2).lerp(mtn, smooth(clamp((y - 7) / 11, 0, 1)));
      else tmp.copy(mtn).lerp(rock, smooth(clamp((y - 18) / 14, 0, 1)));
      const j = 0.92 + 0.16 * hash2(x * 3.1, z * 2.7);
      col[i * 3] = tmp.r * j; col[i * 3 + 1] = tmp.g * j; col[i * 3 + 2] = tmp.b * j;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const land = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.97 }));
    land.receiveShadow = true;
    scene.add(land);

    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(640, 640).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x2c5a6c, roughness: 0.3, metalness: 0.1 }),
    );
    sea.position.set(-80, -0.35, 0);
    sea.receiveShadow = true;
    scene.add(sea);
  }

  /* ── 道路：國道、聯絡道路、台 61 海岸公路、台鐵海線 ── */
  const P = (x, z) => V(x, 0, z);
  const curve = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => P(x, z)), false, 'centripetal');
  const H = curve([[-9, -150], [-7, -108], [-5, -80], [-2.5, -62], [-1, -50], [1.5, -34], [3, -16], [1.5, 0], [0, 12], [-0.3, 22],
    [1.5, 32], [4.5, 44], [6.5, 54], [8, 66], [9.5, 84], [10, 108], [10.5, 150]]);
  const hSamples = H.getSpacedPoints(1600);
  const uAtZ = (z) => { let best = 0, bd = 1e9; hSamples.forEach((p, i) => { const d = Math.abs(p.z - z); if (d < bd) { bd = d; best = i; } }); return best / 1600; };
  const hz = (z) => { const p = H.getPointAt(uAtZ(z)); return [p.x, p.z]; };
  const L1 = curve([[-12, -53.5], [-8.5, -53.3], [-5, -52.2], hz(-48.8)]);           // 工業區 → 國道
  const L0 = curve([[6.5, -60], [3.5, -58.6], hz(-56.6)]);                            // 休息站 → 國道
  const L2 = curve([hz(2.5), [-5, 6.8], [-10, 11], [-11.2, 14.2], [-9.4, 18.6], [-4.6, 22.6], hz(27.5)]); // 中途卸貨點的彎道
  const L3 = curve([hz(49.5), [7.8, 54], [10.2, 57.4], [13, 58.8], [17.6, 58.9]]);    // 國道 → 物流中心
  const alongCoast = (dx) => new THREE.CatmullRomCurve3(Array.from({ length: 76 }, (_, i) => { const z = -150 + i * 4; return P(coastX(z) + dx, z); }), false, 'centripetal');
  const coast = alongCoast(5.6);
  const rail = alongCoast(3.3);   // 海線：沙灘與海岸公路之間
  const K1 = curve([[coastX(-18) + 5.6, -18], [-20, -17.4], [-8, -16.6], hz(-16)]);
  const K2 = curve([[coastX(40) + 5.6, 40], [-16, 40.5], [-6, 41.2], hz(41.5)]);

  // 路的位置先記起來，擺田、樹、房子時避開（格子加速）
  const RG = new Map(), RC = 4;
  function addRoadPts(pts, half) {
    for (const p of pts) {
      const k = `${Math.floor(p.x / RC)},${Math.floor(p.z / RC)}`;
      if (!RG.has(k)) RG.set(k, []);
      RG.get(k).push([p.x, p.z, half]);
    }
  }
  const nearRoad = (x, z, pad) => {
    const cx = Math.floor(x / RC), cz = Math.floor(z / RC), reach = Math.ceil((2.2 + pad) / RC);
    for (let i = -reach; i <= reach; i++) for (let j = -reach; j <= reach; j++) {
      const a = RG.get(`${cx + i},${cz + j}`);
      if (a) for (const [px, pz, h] of a) if ((px - x) ** 2 + (pz - z) ** 2 < (h + pad) ** 2) return true;
    }
    return false;
  };

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2c3139, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const localMat = new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xcfc8b4, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  function ribbon(cv, width, n, y, offset = 0) {
    const pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n; const p = cv.getPointAt(u); const t = cv.getTangentAt(u);
      const r = new THREE.Vector3().crossVectors(t, UP).normalize();
      const c = p.clone().addScaledVector(r, offset);
      const a = c.clone().addScaledVector(r, -width / 2), b = c.clone().addScaledVector(r, width / 2);
      pos.push(a.x, y, a.z, b.x, y, b.z);
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function flatMesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m); return m; }
  function addRoad(cv, width, mat, marks) {
    const len = cv.getLength();
    flatMesh(ribbon(cv, width, Math.ceil(len * 1.4), 0.07), mat);
    if (marks) {
      flatMesh(ribbon(cv, 0.08, Math.ceil(len * 1.4), 0.09, width / 2 - 0.2), lineMat);
      flatMesh(ribbon(cv, 0.08, Math.ceil(len * 1.4), 0.09, -(width / 2 - 0.2)), lineMat);
      const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.02, 1.0), lineMat, Math.floor(len / 2.4));
      for (let i = 0; i < dashes.count; i++) {
        const u = (i * 2.4 + 1.2) / len; const p = cv.getPointAt(u); const t = cv.getTangentAt(u);
        dashes.setMatrixAt(i, M(p.x, 0.095, p.z, 1, 1, 1, Math.atan2(t.x, t.z)));
      }
      scene.add(dashes);
    }
    addRoadPts(cv.getSpacedPoints(Math.ceil(len / 1.2)), width / 2);
  }
  addRoad(H, 3.6, roadMat, true);
  addRoad(coast, 2.4, localMat, false);
  [L1, L0, L2, L3, K1, K2].forEach((cv) => addRoad(cv, 2.0, localMat, false));

  // 鐵路：道碴、枕木、兩條鋼軌
  {
    const len = rail.getLength();
    flatMesh(ribbon(rail, 1.3, Math.ceil(len * 1.2), 0.06), new THREE.MeshStandardMaterial({ color: 0x7a6f63, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    const railMat = new THREE.MeshStandardMaterial({ color: 0xa8adb3, roughness: 0.35, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    flatMesh(ribbon(rail, 0.07, Math.ceil(len * 1.2), 0.13, 0.3), railMat);
    flatMesh(ribbon(rail, 0.07, Math.ceil(len * 1.2), 0.13, -0.3), railMat);
    const n = Math.floor(len / 0.75);
    const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.05, 0.16), new THREE.MeshStandardMaterial({ color: 0x5b4c3e, roughness: 1 }), n);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n; const p = rail.getPointAt(u); const t = rail.getTangentAt(u);
      sleepers.setMatrixAt(i, M(p.x, 0.09, p.z, 1, 1, 1, Math.atan2(t.x, t.z)));
    }
    sleepers.receiveShadow = true;
    scene.add(sleepers);
    addRoadPts(rail.getSpacedPoints(Math.ceil(len / 1.2)), 0.8);
  }

  /* ── 場地 ── */
  const sites = [
    { x0: -32, x1: -9, z0: -66, z1: -46.5 },  // 工業區（示意）
    { x0: 4, x1: 14.5, z0: -71, z1: -58 },    // 國道旁的休息站
    { x0: -21.5, x1: -12.4, z0: 9.5, z1: 18.5 }, // 中途卸貨點：建材行
    { x0: 5.5, x1: 25, z0: 56.5, z1: 70 },    // 物流中心
    { x0: -8, x1: -1, z0: 8, z1: 21 },        // 彎道內側的街屋
  ];
  const inSite = (x, z, pad = 0) => sites.some((s) => x > s.x0 - pad && x < s.x1 + pad && z > s.z0 - pad && z < s.z1 + pad);
  const pad = (s, color) => staticBatch.add(GEO.box, M((s.x0 + s.x1) / 2, 0.01, (s.z0 + s.z1) / 2, s.x1 - s.x0, 0.1, s.z1 - s.z0), C(color));
  pad(sites[0], 0x9aa1a8); pad(sites[1], 0x8e959c); pad(sites[2], 0x9c9a92); pad(sites[3], 0x9aa1a8);

  /* 兩坡屋頂：屋脊沿 x（alongZ=false）或沿 z；w 是跨距、l 是屋脊長 */
  function gable(base, w, l, h, rise, color, alongZ) {
    const a = Math.atan2(rise, w / 2), sl = Math.hypot(w / 2, rise) + 0.18;
    for (const k of [-1, 1]) {
      const m = alongZ ? M(k * w / 4, h + rise / 2 + 0.04, 0, sl, 0.1, l + 0.3, 0, 0, -k * a)
        : M(0, h + rise / 2 + 0.04, k * w / 4, l + 0.3, 0.1, sl, 0, k * a, 0);
      staticBatch.add(GEO.box, within(base, m), color);
    }
    // 山牆：用一個扁方塊把兩片屋頂下面的三角形補起來
    staticBatch.add(GEO.box, within(base, alongZ ? M(0, h + rise * 0.42, 0, w * 0.55, rise * 0.84, l - 0.04) : M(0, h + rise * 0.42, 0, l - 0.04, rise * 0.84, w * 0.55)), C(0xd9dce1));
  }
  /* 藍色鐵皮屋頂的廠房（屋脊沿 x；正面朝南） */
  function shed(x, z, w, d, h, roof, wall = 0xdcdfe4) {
    const base = M(x, 0, z);
    staticBatch.add(GEO.box, within(base, M(0, h / 2, 0, w, h, d)), C(wall));
    gable(base, d, w, h, d * 0.16, C(roof), false);
    for (let i = 0; i < Math.floor(w / 3.2); i++) {   // 正面的鐵捲門
      staticBatch.add(GEO.box, within(base, M(-w / 2 + 1.7 + i * 3.2, h * 0.36, d / 2 + 0.02, 1.9, h * 0.72, 0.04)), C(0x8b939c));
    }
    glowBatch.add(GEO.box, within(base, M(0, h * 0.86, d / 2 + 0.03, w * 0.8, 0.16, 0.04)), C(0xffcf8a));
  }
  function flatBox(x, z, w, d, h, color, tank = false) {
    const base = M(x, 0, z);
    staticBatch.add(GEO.box, within(base, M(0, h / 2, 0, w, h, d)), C(color));
    if (tank) staticBatch.add(GEO.cyl, within(base, M(w * 0.2, h + 0.3, -d * 0.15, 0.5, 0.6, 0.5)), C(0xcfd5dc));
  }

  // 工業區：一大一小兩棟廠房、辦公室、北邊的圍牆
  shed(-22.2, -60.4, 14, 7, 3.3, 0x3f6fb5);
  shed(-12.3, -61.2, 4.6, 5.4, 2.7, 0x5584c6);
  flatBox(-11.8, -48.6, 2.8, 2.0, 2.6, 0xe7e4dc, true);
  glowBatch.add(GEO.box, M(-11.8, 1.8, -47.58, 2.2, 0.26, 0.04), C(0xffd79a));
  glowBatch.add(GEO.box, M(-11.8, 0.9, -47.58, 2.2, 0.26, 0.04), C(0xffe7bf));
  for (let i = 0; i < 21; i++) staticBatch.add(GEO.box, M(-31.6 + i * 1.1, 0.35, -65.6, 1.0, 0.7, 0.12), C(0xb9bcc0));
  // 休息站：小房子、停車格
  flatBox(6.4, -67.6, 3.0, 2.0, 1.8, 0xe9e2d2, true);
  glowBatch.add(GEO.box, M(6.4, 1.2, -66.58, 2.4, 0.3, 0.04), C(0xffe2a8));
  for (let i = 0; i < 4; i++) staticBatch.add(GEO.box, M(8.6 + i * 1.7, 0.07, -64.2, 0.06, 0.03, 6.4), C(0xe8e3d3));
  // 建材行：開放式鐵皮棚、磚與磁磚
  {
    const cx = -17, cz = 14;
    for (const [px, pz] of [[-3.5, -3], [3.5, -3], [-3.5, 3], [3.5, 3]]) staticBatch.add(GEO.box, M(cx + px, 1.2, cz + pz, 0.18, 2.4, 0.18), C(0x8c9198));
    staticBatch.add(GEO.box, M(cx, 2.5, cz, 7.8, 0.14, 6.8, 0, 0, 0.06), C(0x3f6fb5));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      const hh = 0.4 + (i + j) % 3 * 0.25;
      staticBatch.add(GEO.box, M(cx - 2.6 + i * 1.05, hh / 2 + 0.02, cz - 1.4 + j * 1.3, 0.8, hh, 0.9), C(j === 1 ? 0x9a9ea4 : 0xa9553b));
    }
  }
  // 物流中心：一棟大倉庫、北面（朝聯絡道路）一排月台門
  {
    const bx = 16.2, bz = 64.2, w = 13, d = 7.4, h = 4.4;
    staticBatch.add(GEO.box, M(bx, h / 2, bz, w, h, d), C(0xd8dbe0));
    staticBatch.add(GEO.box, M(bx, h + 0.1, bz, w + 0.3, 0.2, d + 0.3), C(0x6e7680));
    staticBatch.add(GEO.box, M(bx, 0.5, bz - d / 2 - 0.6, w, 1.0, 1.2), C(0xb4b9bf));   // 月台
    for (let i = 0; i < 5; i++) staticBatch.add(GEO.box, M(bx - 5.2 + i * 2.6, 1.9, bz - d / 2 - 0.02, 1.7, 1.8, 0.05), C(0x2d333b));
    glowBatch.add(GEO.box, M(bx, 3.6, bz - d / 2 - 0.03, w * 0.86, 0.18, 0.04), C(0xffd08c));
  }

  /* 透天厝：窄長、三四層樓，屋頂上有水塔或頂樓加蓋 */
  const houseCols = [0xe9e4d8, 0xd8d2c4, 0xc9ced6, 0xe3d6c3, 0xbfc6ce, 0xd9c7b0, 0xf1efe9];
  function townRow(x0, z0, dx, dz, n, facing) {
    let x = x0, z = z0;
    for (let i = 0; i < n; i++) {
      const w = 1.1 + R() * 0.4, h = 2.6 + Math.floor(R() * 3) * 0.9, d = 2.8;
      const base = M(x, 0, z, 1, 1, 1, facing);
      staticBatch.add(GEO.box, within(base, M(0, h / 2, 0, w, h, d)), C(pick(houseCols)));
      const r = R();
      if (r < 0.4) staticBatch.add(GEO.cyl, within(base, M(0.1, h + 0.26, -0.5, 0.4, 0.52, 0.4)), C(0xd7dde3));
      else if (r < 0.75) staticBatch.add(GEO.box, within(base, M(0, h + 0.32, -0.4, w * 0.94, 0.64, 1.4)), C(pick([0x3f6fb5, 0xb24a3a, 0x5584c6])));
      for (let f = 0; f < Math.round((h - 0.5) / 0.9); f++) {
        if (R() < 0.6) glowBatch.add(GEO.box, within(base, M(0, 0.65 + f * 0.9, d / 2 + 0.02, w * 0.6, 0.18, 0.04)), C(R() < 0.5 ? 0xffd28f : 0xffe7bf));
      }
      x += dx * (w + 0.06); z += dz * (w + 0.06);
    }
  }
  townRow(-6.8, 9.0, 0.25, 1, 8, -Math.PI / 2 + 0.25);
  townRow(-2.6, 10.2, 0.05, 1, 7, Math.PI / 2);
  for (let k = 0; k < 3; k++) townRow(coastX(-32 + k * 10) + 8.3, -32 + k * 10, 0, 1, 6, -Math.PI / 2);
  townRow(coastX(22) + 8.3, 22, 0, 1, 8, -Math.PI / 2);
  townRow(3.8, 35.5, 0.2, 1, 6, Math.PI / 2 + 0.2);

  /* 廟：紅牆、橘色琉璃瓦、屋脊兩端翹起來 */
  function temple(x, z, ry) {
    const base = M(x, 0, z, 1, 1, 1, ry);
    staticBatch.add(GEO.box, within(base, M(0, 0.12, 0, 3.4, 0.24, 2.8)), C(0xb9ab98));
    staticBatch.add(GEO.box, within(base, M(0, 0.85, -0.15, 2.5, 1.2, 1.8)), C(0xb33a2c));
    gable(within(base, M(0, 0, -0.15)), 2.3, 2.9, 1.45, 0.62, C(0xe08a2c), false);
    for (const k of [-1, 1]) staticBatch.add(GEO.box, within(base, M(k * 1.7, 2.12, -0.15, 0.42, 0.34, 0.14, 0, 0, k * 0.5)), C(0x2f9e8f));
    staticBatch.add(GEO.box, within(base, M(0, 2.12, -0.15, 2.9, 0.1, 0.12)), C(0x2f9e8f));
    for (const k of [-1, 1]) glowBatch.add(GEO.box, within(base, M(k * 0.7, 1.05, 0.78, 0.2, 0.26, 0.2)), C(0xff5a3a));
  }
  temple(coastX(0) + 9.0, 0.5, -Math.PI / 2);

  /* ── 田：長方形的稻田成片排列，田埂是地面的顏色；有剛插秧灌水的水田、收割前的金黃、休耕 ── */
  {
    const PW = 4.4, PD = 6.6, GAP = 0.36;
    const free = (cx, cz) => {
      for (const [dx, dz] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const x = cx + dx * PW / 2, z = cz + dz * PD / 2;
        if (x < coastX(z) + 3.2 || inSite(x, z, 0.8) || nearRoad(x, z, 0.5)) return false;
      }
      return true;
    };
    const spots = [];
    let col = 0;
    for (let x = -36; x <= 21 - PW; x += PW, col++) {
      if (col % 4 === 3) x += 0.8;   // 每四塊留一條農路
      for (let z = -150; z <= 150 - PD; z += PD) {
        const cx = x + PW / 2, cz = z + PD / 2;
        if (!free(cx, cz)) continue;
        if (R() < 0.04) continue;
        spots.push({ x: cx, z: cz, col });
      }
    }
    // 三合院與溫室占掉幾塊田
    const farm = [], green = [], dry = [], wet = [];
    const crops = { g1: C(0x7a9a4f), g2: C(0x8aa759), g3: C(0x6a8a4a), gold: C(0xb8a75c), gold2: C(0xc8b56a), fallow: C(0x957f5e) };
    spots.forEach((p) => {
      const r = R();
      if (r < 0.028) { farm.push(p); return; }
      if (r < 0.045) { green.push(p); return; }
      const n = fbm(p.x * 0.025 + 11, p.z * 0.02 - 4);
      let c;
      if (n > 0.6) c = crops.gold.clone().lerp(crops.gold2, R());
      else if (n < 0.36 && R() < 0.45) c = crops.fallow.clone();
      else if (R() < 0.12 && n < 0.55) { wet.push(p); return; }
      else c = crops.g1.clone().lerp(R() < 0.5 ? crops.g2 : crops.g3, R());
      c.multiplyScalar(0.94 + R() * 0.12);
      dry.push([p, c]);
    });
    const geo = new THREE.BoxGeometry(PW - GAP, 0.07, PD - GAP);
    const dm = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.95 }), dry.length);
    dry.forEach(([p, c], i) => { dm.setMatrixAt(i, M(p.x, 0.04, p.z)); dm.setColorAt(i, c); });
    dm.receiveShadow = true;
    scene.add(dm);
    const wm = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x8fb4bf, roughness: 0.18, metalness: 0.05 }), wet.length);
    wet.forEach((p, i) => wm.setMatrixAt(i, M(p.x, 0.03, p.z)));
    wm.receiveShadow = true;
    scene.add(wm);
    // 農路（淺色的碎石路）
    spots.forEach((p) => { if (p.col % 4 === 3) staticBatch.add(GEO.box, M(p.x + PW / 2 + 0.4, 0.03, p.z, 0.7, 0.04, PD), C(0xa39a82)); });

    // 三合院：正身＋左右護龍，前面是曬穀的稻埕，後面一叢竹林
    farm.forEach((p) => {
      const base = M(p.x, 0, p.z);
      const wall = C(0xe8dccb), roof = C(0xb4553a);
      staticBatch.add(GEO.box, within(base, M(0, 0.04, 0.6, 3.2, 0.06, 3.0)), C(0xbdb5a5));
      staticBatch.add(GEO.box, within(base, M(0, 0.55, -1.3, 3.6, 1.1, 1.2)), wall);
      gable(within(base, M(0, 0, -1.3)), 1.2, 3.6, 1.1, 0.42, roof, false);
      for (const k of [-1, 1]) {
        staticBatch.add(GEO.box, within(base, M(k * 1.4, 0.45, 0.5, 0.95, 0.9, 2.3)), wall);
        gable(within(base, M(k * 1.4, 0, 0.5)), 0.95, 2.3, 0.9, 0.34, roof, true);
      }
      glowBatch.add(GEO.box, within(base, M(0, 0.55, -0.68, 0.8, 0.3, 0.04)), C(0xffd28f));
      for (let i = 0; i < 4; i++) staticBatch.add(GEO.cone, M(p.x - 1.2 + i * 0.8, 1.0, p.z - 2.7, 0.8, 2.0 + R() * 0.6, 0.8, R() * 3), C(0x5b7f3c));
    });
    // 溫室：一片四條白色的半圓筒
    green.forEach((p) => {
      for (let i = 0; i < 4; i++) staticBatch.add(GEO.tunnel, M(p.x - 1.5 + i * 1.0, 0.02, p.z, 0.9, 1.2, PD - 0.8), C(0xdfe6ea));
    });
  }

  /* ── 樹：山腳一片一片的闊葉林、平原上的檳榔樹 ── */
  {
    const greens = [0x3f6139, 0x4a6d3e, 0x557a44, 0x36562f, 0x5f7f45].map(C);
    const list = [];
    for (let i = 0; i < 5200 && list.length < 1700; i++) {
      const x = 19 + R() * 75, z = -150 + R() * 300;
      const y = heightAt(x, z);
      if (y > 24) continue;
      const dens = fbm(x * 0.06 + 2, z * 0.06 - 3);
      if (dens < (x < 27 ? 0.52 : 0.4)) continue;
      if (inSite(x, z, 2) || nearRoad(x, z, 1.2)) continue;
      list.push([x, y, z, 1.1 + R() * 1.4]);
    }
    const trees = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), list.length);
    list.forEach(([x, y, z, s], i) => {
      trees.setMatrixAt(i, M(x, y + 0.5 * s, z, 1.5 * s, 1.3 * s, 1.5 * s, R() * 3));
      trees.setColorAt(i, pick(greens).clone().multiplyScalar(0.9 + R() * 0.2));
    });
    trees.castShadow = true; trees.receiveShadow = true;
    scene.add(trees);

    const palms = [];
    for (let i = 0; i < 900 && palms.length < 240; i++) {
      const x = -34 + R() * 56, z = -150 + R() * 300;
      if (x < coastX(z) + 3 || x > 24 || inSite(x, z, 1.5) || nearRoad(x, z, 1.4)) continue;
      if (fbm(x * 0.08, z * 0.08) < 0.52) continue;
      palms.push([x, z, 2.2 + R() * 1.0, R() * 3]);
    }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 1, 5), new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.9 }), palms.length);
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x547f40, flatShading: true, roughness: 0.9 }), palms.length);
    palms.forEach(([x, z, h, ry], i) => {
      trunk.setMatrixAt(i, M(x, h / 2, z, 1, h, 1));
      crown.setMatrixAt(i, M(x, h + 0.1, z, 1.7, 1, 1.7, ry, Math.PI));
    });
    [trunk, crown].forEach((m) => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
  }

  /* ── 港：碼頭、防波堤、貨櫃場、兩台橋式起重機、一艘靠港的貨櫃輪 ── */
  const boxCols = [0xc0392b, 0x2e86ab, 0xe0a93b, 0x5a6b7b, 0x3f8f63, 0xd8dde2];
  {
    const cx = coastX(36);
    staticBatch.add(GEO.box, M(cx - 7, -0.9, 38, 11, 2.2, 13), C(0x8f949a));
    staticBatch.add(GEO.box, M(cx - 13, -0.8, 27.5, 16, 1.8, 1.4, 0.35), C(0x9aa0a6));
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
      const n = 1 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) staticBatch.add(GEO.box, M(cx - 8.4 + i * 1.3, 0.2 + 0.5 + k * 1.0, 34 + j * 2.9, 1.1, 0.95, 2.6), C(pick(boxCols)));
    }
    for (let c = 0; c < 2; c++) {
      const zc = 34 + c * 6.5, xc = cx - 11.2;
      for (const dz of [-1.4, 1.4]) for (const dx of [-1.2, 1.2]) staticBatch.add(GEO.box, M(xc + dx, 3.2, zc + dz, 0.25, 6.4, 0.25), C(0xe8622a));
      staticBatch.add(GEO.box, M(xc - 2.6, 6.6, zc, 8.2, 0.5, 0.5), C(0xe8622a));
      staticBatch.add(GEO.box, M(xc, 6.6, zc, 0.5, 0.5, 3.2), C(0xf2f2f2));
    }
    // 貨櫃輪
    const sx = cx - 17.2, sz = 40;
    staticBatch.add(GEO.box, M(sx, 0.35, sz, 3.4, 1.6, 16), C(0x243447));
    staticBatch.add(GEO.box, M(sx, -0.3, sz, 3.34, 0.3, 15.9), C(0x8e2f2a));
    staticBatch.add(GEO.box, M(sx, 0.35, sz - 8.2, 2.4, 1.6, 2.4, Math.PI / 4), C(0x243447));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
      const n = 1 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) staticBatch.add(GEO.box, M(sx - 0.72 + j * 1.44, 1.65 + k * 0.9, sz - 6.6 + i * 2.3, 1.3, 0.86, 2.2), C(pick(boxCols)));
    }
    staticBatch.add(GEO.box, M(sx, 2.3, sz + 6.9, 3.1, 2.4, 1.8), C(0xeceeef));
    staticBatch.add(GEO.box, M(sx, 3.55, sz + 6.9, 3.8, 0.18, 1.3), C(0xdfe2e5));
    staticBatch.add(GEO.box, M(sx, 3.8, sz + 7.5, 0.8, 1.2, 0.9), C(0x303640));
    glowBatch.add(GEO.box, M(sx, 3.0, sz + 5.98, 2.6, 0.18, 0.04), C(0xffe2a8));
  }

  /* ── 風機：海岸一排、外海一排，機艙上有閃的紅燈 ── */
  const rotors = [];
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true });
  const bladeGeo = (() => {
    const b = new Batch();
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Matrix4().makeRotationZ(k * Math.PI * 2 / 3).multiply(M(0, 2.1, 0, 0.26, 4.2, 0.08));
      b.add(GEO.box, m, C(0xf2f4f6));
    }
    b.add(GEO.ico, M(0, 0, 0, 0.5, 0.5, 0.5), C(0xe9ecef));
    return b.geometry();
  })();
  const bladeMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 });
  const lightGeo = new THREE.SphereGeometry(0.16, 8, 6);
  function turbine(x, z, s) {
    const y = Math.max(heightAt(x, z), -0.3);
    staticBatch.add(GEO.cyl, M(x, y + 5 * s, z, 0.34 * s, 10 * s, 0.34 * s), C(0xeef0f2));
    staticBatch.add(GEO.box, M(x, y + 10.2 * s, z - 0.2 * s, 0.6 * s, 0.6 * s, 1.5 * s), C(0xe4e7ea));
    const rot = new THREE.Mesh(bladeGeo, bladeMat);
    rot.position.set(x, y + 10.2 * s, z + 0.65 * s);
    rot.scale.setScalar(s);
    rot.rotation.z = R() * Math.PI;
    rot.userData.speed = 0.55 + R() * 0.3;
    rot.castShadow = true;
    scene.add(rot); rotors.push(rot);
    const l = new THREE.Mesh(lightGeo, redMat);
    l.position.set(x, y + 10.62 * s, z - 0.2 * s); l.scale.setScalar(s);
    scene.add(l);
  }
  for (let z = -144; z <= 144; z += 16) turbine(coastX(z) + 0.6, z, 1);
  for (let z = -126; z <= 126; z += 21) turbine(coastX(z) - 19, z + 6, 0.85);

  /* ── 國道的路燈 ── */
  {
    const len = H.getLength(), n = Math.floor(len / 9);
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.06, 1, 5), new THREE.MeshStandardMaterial({ color: 0x5b6068, roughness: 0.6 }), n * 2);
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.07, 0.42), new THREE.MeshBasicMaterial({ color: 0xffd79a }), n * 2);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n; const p = H.getPointAt(u); const t = H.getTangentAt(u);
      const r = new THREE.Vector3().crossVectors(t, UP).normalize();
      [-1, 1].forEach((k, j) => {
        const q = p.clone().addScaledVector(r, k * 2.25);
        poles.setMatrixAt(i * 2 + j, M(q.x, 0.95, q.z, 1, 1.9, 1));
        heads.setMatrixAt(i * 2 + j, M(q.x - r.x * k * 0.2, 1.92, q.z - r.z * k * 0.2, 1, 1, 1, Math.atan2(r.x, r.z)));
      });
    }
    poles.castShadow = true;
    scene.add(poles, heads);
  }

  /* ── 車 ── */
  const blobTex = (() => {
    const cvs = document.createElement('canvas'); cvs.width = cvs.height = 64;
    const g = cvs.getContext('2d'); const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cvs);
  })();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  function blobShadow(w, l) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), blobMat);
    m.position.y = 0.11; m.renderOrder = 1;
    return m;
  }
  const vehMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.15 });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const solid = (geo) => { const m = new THREE.Mesh(geo, vehMat); m.castShadow = true; m.receiveShadow = true; return m; };
  function wheels(b, zs, color = 0x1b1d22) {
    for (const z of zs) for (const x of [-0.5, 0.5]) b.add(GEO.cyl, M(x, 0.3, z, 0.6, 0.24, 0.6, 0, 0, Math.PI / 2), C(color));
  }
  /* 平頭（cab-over）曳引車 */
  function tractor(cab) {
    const b = new Batch(), g = new Batch();
    b.add(GEO.box, M(0, 0.55, -0.2, 0.9, 0.3, 2.5), C(0x2b2f36));
    b.add(GEO.box, M(0, 1.22, 0.55, 1.12, 1.08, 1.2), C(cab));
    b.add(GEO.box, M(0, 1.9, 0.38, 1.02, 0.34, 0.74), C(cab));
    b.add(GEO.box, M(0, 1.38, 1.16, 1.0, 0.44, 0.05), C(0x1d2a38));
    b.add(GEO.box, M(0, 0.86, 1.16, 0.8, 0.22, 0.04), C(0x3a3f47));   // 水箱罩
    b.add(GEO.box, M(0, 0.52, 1.18, 1.14, 0.2, 0.08), C(0x2b2f36));
    for (const x of [-0.62, 0.62]) b.add(GEO.box, M(x, 1.42, 1.02, 0.05, 0.3, 0.1), C(0x22252b));  // 後照鏡
    b.add(GEO.box, M(0.5, 0.62, -0.1, 0.18, 0.28, 0.9), C(0xb7bec6));
    b.add(GEO.box, M(-0.44, 1.5, -0.12, 0.08, 1.0, 0.08), C(0x9aa0a6));  // 排氣管
    wheels(b, [0.78, -0.5, -1.05]);
    g.add(GEO.box, M(-0.38, 0.66, 1.23, 0.2, 0.1, 0.03), C(0xfff1c9));
    g.add(GEO.box, M(0.38, 0.66, 1.23, 0.2, 0.1, 0.03), C(0xfff1c9));
    for (const x of [-0.3, 0, 0.3]) g.add(GEO.box, M(x, 2.1, 0.7, 0.1, 0.06, 0.06), C(0xffb347));
    const grp = new THREE.Group();
    grp.add(solid(b.geometry()), new THREE.Mesh(g.geometry(), glowMat), blobShadow(1.8, 3.4));
    return grp;
  }
  /* 平板拖車（前面有擋板，兩側有立柱） */
  function trailer(color = 0x59616b) {
    const b = new Batch(), g = new Batch();
    b.add(GEO.box, M(0, 1.02, -3.1, 1.08, 0.14, 6.2), C(color));
    b.add(GEO.box, M(0, 0.82, -3.1, 0.5, 0.28, 6.0), C(0x2b2f36));
    b.add(GEO.box, M(0, 1.36, -0.06, 1.08, 0.56, 0.08), C(color));
    for (let i = 0; i < 6; i++) for (const x of [-0.53, 0.53]) b.add(GEO.box, M(x, 1.22, -0.6 - i * 1.1, 0.04, 0.3, 0.05), C(0x3a3f47));
    b.add(GEO.box, M(0, 0.45, -1.2, 0.7, 0.55, 0.1), C(0x2b2f36));
    wheels(b, [-4.95, -5.6]);
    g.add(GEO.box, M(-0.42, 0.86, -6.21, 0.18, 0.1, 0.03), C(0xff3a2e));
    g.add(GEO.box, M(0.42, 0.86, -6.21, 0.18, 0.1, 0.03), C(0xff3a2e));
    const grp = new THREE.Group();
    grp.add(solid(b.geometry()), new THREE.Mesh(g.geometry(), glowMat));
    const sh = blobShadow(1.9, 7.2); sh.position.z = -3.1; grp.add(sh);
    return grp;
  }
  function boxTruck(cab, body) {
    const b = new Batch(), g = new Batch();
    b.add(GEO.box, M(0, 0.55, -0.9, 0.9, 0.3, 4.4), C(0x2b2f36));
    b.add(GEO.box, M(0, 1.15, 0.9, 1.08, 1.0, 1.0), C(cab));
    b.add(GEO.box, M(0, 1.33, 1.41, 0.96, 0.4, 0.05), C(0x1d2a38));
    b.add(GEO.box, M(0, 1.55, -1.55, 1.12, 1.55, 3.9), C(body));
    wheels(b, [0.95, -2.2, -2.85]);
    g.add(GEO.box, M(-0.36, 0.62, 1.42, 0.18, 0.1, 0.03), C(0xfff1c9));
    g.add(GEO.box, M(0.36, 0.62, 1.42, 0.18, 0.1, 0.03), C(0xfff1c9));
    g.add(GEO.box, M(-0.44, 0.9, -3.51, 0.16, 0.1, 0.03), C(0xff3a2e));
    g.add(GEO.box, M(0.44, 0.9, -3.51, 0.16, 0.1, 0.03), C(0xff3a2e));
    const grp = new THREE.Group();
    grp.add(solid(b.geometry()), new THREE.Mesh(g.geometry(), glowMat));
    const sh = blobShadow(1.8, 5.6); sh.position.z = -0.9; grp.add(sh);
    return grp;
  }
  function car(color) {
    const b = new Batch(), g = new Batch();
    b.add(GEO.box, M(0, 0.36, 0, 0.78, 0.32, 1.6), C(color));
    b.add(GEO.box, M(0, 0.66, -0.12, 0.66, 0.3, 0.8), C(color));
    b.add(GEO.box, M(0, 0.66, 0.29, 0.6, 0.24, 0.03), C(0x1d2a38));
    wheels(b, [0.5, -0.5], 0x16181c);
    g.add(GEO.box, M(-0.26, 0.4, 0.81, 0.14, 0.07, 0.02), C(0xfff1c9));
    g.add(GEO.box, M(0.26, 0.4, 0.81, 0.14, 0.07, 0.02), C(0xfff1c9));
    g.add(GEO.box, M(-0.28, 0.42, -0.81, 0.14, 0.07, 0.02), C(0xff3a2e));
    g.add(GEO.box, M(0.28, 0.42, -0.81, 0.14, 0.07, 0.02), C(0xff3a2e));
    const grp = new THREE.Group();
    grp.add(solid(b.geometry()), new THREE.Mesh(g.geometry(), glowMat), blobShadow(1.2, 2.2));
    grp.scale.setScalar(1.1);
    return grp;
  }
  /* 棧板上的培養土：木棧板＋一疊咖啡色的袋子、綠色的標籤帶 */
  const palletGeo = (() => {
    const b = new Batch();
    b.add(GEO.box, M(0, 0.05, 0, 0.5, 0.1, 0.5), C(0xb08a5a));
    b.add(GEO.box, M(0, 0.32, 0, 0.47, 0.42, 0.47), C(0x6e4e36));
    b.add(GEO.box, M(0, 0.47, 0, 0.48, 0.06, 0.48), C(0x4e7a3a));
    return b.geometry();
  })();

  /* 一台聯結車，拖車跟著路線轉彎（關節式） */
  function makeSemi(cab, cargo) {
    const t = tractor(cab), tr = trailer();
    scene.add(t, tr);
    const pallets = [];
    if (cargo) {
      for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) {
        const m = solid(palletGeo);
        m.position.set(c ? 0.27 : -0.27, 1.09, -0.75 - r * 1.1);
        tr.add(m); pallets.push(m);
      }
    }
    return { t, tr, pallets };
  }
  const tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
  function lanePoint(cv, u, lane, out) {
    const uu = clamp(u, 0, 1);
    cv.getPointAt(uu, out);
    const tg = cv.getTangentAt(uu, tmpC);
    const r = tmpB.crossVectors(tg, UP).normalize();
    out.addScaledVector(r, lane);
    if (u < 0) out.addScaledVector(tg, u * cv.getLength());
    if (u > 1) out.addScaledVector(tg, (u - 1) * cv.getLength());
    return out;
  }
  function placeSemi(semi, cv, u, lane) {
    const len = cv.getLength();
    const p = lanePoint(cv, u, lane, new THREE.Vector3());
    const ahead = lanePoint(cv, u + 0.5 / len, lane, new THREE.Vector3());
    semi.t.position.copy(p); semi.t.lookAt(ahead.x, 0, ahead.z);
    const dir = ahead.sub(p).normalize();
    const king = p.clone().addScaledVector(dir, -0.55);
    const rear = lanePoint(cv, u - 6.0 / len, lane, new THREE.Vector3());
    const tdir = king.clone().sub(rear).setY(0).normalize();
    semi.tr.position.copy(king);
    semi.tr.lookAt(king.x + tdir.x, 0, king.z + tdir.z);
  }
  function placeRigid(obj, cv, u, lane, dir = 1) {
    const len = cv.getLength();
    const p = lanePoint(cv, u, lane, new THREE.Vector3());
    const ahead = lanePoint(cv, u + dir * 0.5 / len, lane, new THREE.Vector3());
    obj.position.copy(p); obj.lookAt(ahead.x, 0, ahead.z);
  }

  /* ── 這一趟的路線：休息站 → 工業區裝貨 → 國道 → 建材行（中途卸 4 板）→ 物流中心（卸完） ── */
  function samples(cv, u0, u1, step = 0.8) {
    const len = cv.getLength() * Math.abs(u1 - u0);
    const n = Math.max(2, Math.ceil(len / step));
    return Array.from({ length: n + 1 }, (_, i) => cv.getPointAt(lerp(u0, u1, i / n)));
  }
  const dedupe = (pts) => pts.filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]) > 0.25);
  const hu = (z) => uAtZ(z);
  const Lspot = P(-19.05, -52.4);
  const yardIn = curve([[-12, -53.5], [-15, -50.6], [-20, -49.7], [-26, -49.7], [-29.4, -51.1], [-28.8, -53.2], [-25.4, -52.6], [-19.05, -52.4]]);
  const RA = new THREE.CatmullRomCurve3(dedupe([
    P(11.4, -61.8), P(10.7, -59.7), P(8.6, -59.6), ...samples(L0, 0, 1), ...samples(H, hu(-56.6) + 0.002, hu(-48.8) - 0.002),
    ...samples(L1, 1, 0), ...samples(yardIn, 0, 1),
  ]), false, 'centripetal');
  const RB = new THREE.CatmullRomCurve3(dedupe([
    Lspot.clone(), P(-15.6, -53.0), ...samples(L1, 0, 1), ...samples(H, hu(-48.8) + 0.002, hu(2.5) - 0.002),
    ...samples(L2, 0, 1), ...samples(H, hu(27.5) + 0.002, hu(49.5) - 0.002), ...samples(L3, 0, 1),
  ]), false, 'centripetal');
  const RBsp = RB.getSpacedPoints(2000);
  let uM = 0, bd = 1e9;
  RBsp.forEach((p, i) => { const d = (p.x + 11.2) ** 2 + (p.z - 14.2) ** 2; if (d < bd) { bd = d; uM = i / 2000; } });

  // 規劃好的路線：承接之後亮起來
  const routeLine = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(RB.getSpacedPoints(900).map((p) => p.clone().setY(0.34))), 900, 0.11, 6, false),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  routeLine.renderOrder = 2;
  scene.add(routeLine);
  const routeIndexCount = routeLine.geometry.index.count;
  routeLine.geometry.setDrawRange(0, 0);

  // 中途卸貨點與終點的標記
  const pinMat = new THREE.MeshBasicMaterial({ color: 0xff8c4a, transparent: true });
  const pins = [P(-12.4, 14.2), P(17.9, 58.9)].map((p) => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), pinMat); m.position.set(p.x, 3.2, p.z); m.scale.set(1, 1.5, 1); scene.add(m); return m;
  });

  /* ── 主角與另外四台同級距的承運人（車身是各家自己的顏色） ── */
  const hero = makeSemi(0x2e62a8, true);
  const othersCfg = [
    { cab: 0xeef0f2, cv: coast, u: 0.36, lane: 0.6, v: 26 },
    { cab: 0x3f8f63, cv: H, u: hu(-22), lane: -0.9, v: -30 },
    { cab: 0xb8342c, cv: coast, u: 0.47, lane: -0.6, v: -22 },
    { cab: 0xd4cfc4, cv: H, u: hu(-84), lane: 0.9, v: 30 },
  ];
  const others = othersCfg.map((o) => makeSemi(o.cab, false));
  // 媒合結束後（s > 2.25）其他幾台照常開走；v 是每一個 s 開多遠（負的是往北）
  function updateOthers(s) {
    othersCfg.forEach((o, i) => placeSemi(others[i], o.cv, o.u + Math.max(0, s - 2.25) * o.v / o.cv.getLength(), o.lane));
  }
  // 工業區裡等著上車的十板貨、一台堆高機
  const yardPallets = [];
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) {
    const m = solid(palletGeo); m.position.set(-25.6 + i * 1.1, 0.06, -55.6 + r * 1.05); scene.add(m); yardPallets.push(m);
  }
  const forklift = (() => {
    const b = new Batch();
    b.add(GEO.box, M(0, 0.45, 0, 0.7, 0.55, 1.0), C(0xf2b51c));
    b.add(GEO.box, M(0, 0.95, -0.15, 0.6, 0.5, 0.5), C(0x2b2f36));
    b.add(GEO.box, M(0, 0.95, 0.56, 0.5, 1.6, 0.08), C(0x3a3f47));
    wheels(b, [0.3, -0.3], 0x16181c);
    const g = new THREE.Group(); g.add(solid(b.geometry()), blobShadow(1.1, 1.5)); g.scale.setScalar(0.9); scene.add(g); return g;
  })();
  // 休息站停著一台、物流中心旁邊停著兩台
  { const o = boxTruck(0xeef1f4, 0xd9dde2); o.position.set(9.45, 0, -63.6); o.rotation.y = Math.PI; scene.add(o); }
  [[7.6, 63.0], [9.4, 63.0]].forEach(([x, z]) => { const o = boxTruck(0x3d5a80, 0xe8e4da); o.position.set(x, 0, z); scene.add(o); });

  // 通知的波紋
  const ringGeo = new THREE.RingGeometry(0.86, 1.08, 48).rotateX(-Math.PI / 2);
  const rings = [hero, ...others].map((s, i) => {
    const pair = [0, 1].map(() => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, depthWrite: false })); m.renderOrder = 3; scene.add(m); return m; });
    return { s, pair, i };
  });
  const acceptDisc = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff8c4a, transparent: true, opacity: 0, depthWrite: false }));
  acceptDisc.renderOrder = 3; scene.add(acceptDisc);

  /* ── 背景車流：國道雙向、海岸公路；海線上一列貨運列車 ── */
  const traffic = [];
  const bodies = [0xeef1f4, 0xd9dde2, 0xc3c9d0, 0xe8e4da];
  const carCols = [0xf2f2f2, 0xb8bec6, 0x2d3c55, 0x8c1f28, 0x3b3f46, 0xd9d4c8];
  for (let i = 0; i < 26; i++) {
    const truck = R() < 0.45;
    const obj = truck ? boxTruck(pick([0xf2f3f5, 0xdfe3e8, 0x3d5a80, 0x9aa3ad]), pick(bodies)) : car(pick(carCols));
    scene.add(obj);
    traffic.push({ obj, cv: H, u: R(), dir: R() < 0.5 ? 1 : -1, speed: (truck ? 5.5 : 8) + R() * 3 });
  }
  for (let i = 0; i < 9; i++) {
    const obj = R() < 0.3 ? boxTruck(0xe9ecef, pick(bodies)) : car(pick(carCols));
    scene.add(obj);
    traffic.push({ obj, cv: coast, u: R(), dir: R() < 0.5 ? 1 : -1, speed: 6 + R() * 3 });
  }
  const placeTraffic = (tr) => placeRigid(tr.obj, tr.cv, tr.u, tr.dir > 0 ? 0.9 : -0.9, tr.dir);
  traffic.forEach(placeTraffic);

  const train = [];
  {
    const b = new Batch(), g = new Batch();
    b.add(GEO.box, M(0, 0.95, 0, 1.1, 1.2, 3.6), C(0x2d4f7c));
    b.add(GEO.box, M(0, 0.62, 0, 1.12, 0.14, 3.62), C(0xf2c230));
    b.add(GEO.box, M(0, 1.15, 1.81, 0.9, 0.34, 0.02), C(0x1d2a38));
    b.add(GEO.box, M(0, 0.3, 0, 0.9, 0.3, 3.2), C(0x22252b));
    g.add(GEO.box, M(0, 0.62, 1.82, 0.5, 0.08, 0.02), C(0xfff1c9));
    const loco = new THREE.Group(); loco.add(solid(b.geometry()), new THREE.Mesh(g.geometry(), glowMat));
    scene.add(loco); train.push(loco);
    for (let i = 0; i < 9; i++) {
      const c = new Batch();
      c.add(GEO.box, M(0, 0.45, 0, 0.95, 0.12, 3.5), C(0x3a3f47));
      c.add(GEO.box, M(0, 0.26, 0, 0.8, 0.3, 3.0), C(0x22252b));
      if (R() < 0.85) c.add(GEO.box, M(0, 1.05, 0, 1.0, 1.08, 3.3), C(pick(boxCols)));
      const grp = new THREE.Group(); grp.add(solid(c.geometry())); scene.add(grp); train.push(grp);
    }
  }
  const railLen = rail.getLength();
  let trainU = 0.18;
  const placeTrain = () => train.forEach((o, i) => placeRigid(o, rail, trainU - (i * 3.75 + (i ? 0.1 : 0)) / railLen, 0, 1));
  placeTrain();

  // 合併好的靜態網格
  const statics = new THREE.Mesh(staticBatch.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }));
  statics.castShadow = true; statics.receiveShadow = true;
  scene.add(statics);
  scene.add(new THREE.Mesh(glowBatch.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true })));

  /* ── 捲動 → 行程 ── */
  const chapters = [...document.querySelectorAll('[data-ch]')];
  let centers = [];
  function measure() {
    centers = chapters.map((el) => { const r = el.getBoundingClientRect(); return r.top + window.scrollY + r.height / 2; });
  }
  function scrollS() {
    const y = window.scrollY + window.innerHeight / 2;
    if (y <= centers[0]) return 0;
    for (let i = 0; i < centers.length - 1; i++) if (y < centers[i + 1]) return i + (y - centers[i]) / (centers[i + 1] - centers[i]);
    return centers.length - 1;
  }

  const heroPos = new THREE.Vector3();
  function updateHero(s) {
    let cv, u;
    if (s < 2.3) { cv = RA; u = 0; }
    else if (s < 2.8) { cv = RA; u = smoother(seg(s, 2.3, 2.8)); }
    else if (s < 3.1) { cv = RB; u = 0; }
    else if (s < 3.7) { cv = RB; u = uM * smoother(seg(s, 3.1, 3.7)); }
    else if (s < 4.05) { cv = RB; u = uM; }
    else { cv = RB; u = lerp(uM, 1, smoother(seg(s, 4.05, 4.65))); }
    placeSemi(hero, cv, u, (cv === RA && s < 2.3) || (cv === RB && s < 3.1) ? 0 : 0.65);
    heroPos.copy(hero.t.position);
    updateOthers(s);
    // 裝貨：2.8 → 3.05 十板上車；中途卸 4 板；終點卸完
    let n = 0;
    if (s >= 2.8) n = Math.round(10 * smooth(seg(s, 2.8, 3.05)));
    if (s >= 3.75) n = 10 - Math.round(4 * smooth(seg(s, 3.75, 3.98)));
    if (s >= 4.68) n = 6 - Math.round(6 * smooth(seg(s, 4.68, 4.95)));
    hero.pallets.forEach((p, i) => { p.visible = i < n; });
    const loaded = s >= 3.05 ? 10 : Math.round(10 * smooth(seg(s, 2.8, 3.05)));
    yardPallets.forEach((p, i) => { p.visible = i >= loaded; });
    const f = s >= 2.75 && s < 3.1 ? (Math.sin(seg(s, 2.8, 3.05) * Math.PI * 10) * 0.5 + 0.5) : 0;
    forklift.position.set(-23.4 + 1.4 * Math.sin(s * 7), 0, lerp(-53.9, -53.4, f));
    forklift.rotation.y = Math.PI;
  }

  /* 鏡頭：一串關鍵畫面，中間平滑過去；「跟車」的畫面跟著那台車走。
     ox／oy：主體往右（橫螢幕，左邊留給文字卡）或往上（直螢幕，下面留給文字卡）偏多少 */
  const fixed = (px, py, pz, tx, ty, tz) => { const p = V(px, py, pz), t = V(tx, ty, tz); return () => ({ pos: p, tgt: t }); };
  const followCam = (ox, oy, oz) => () => ({ pos: heroPos.clone().add(V(ox, oy, oz)), tgt: heroPos.clone().add(V(0.6, 1, 2.8)) });
  const chase = followCam(-13, 11.5, -12);
  const KF = [
    { s: 0.0, cam: fixed(-80, 44, 72, -6, 0, -14), ox: 0.17, oy: 0.25 },
    { s: 1.0, cam: fixed(-46, 22, -27, -20, 1.5, -56), ox: 0.13, oy: 0.2 },
    { s: 2.0, cam: fixed(-50, 56, 2, -4, 0, -46), ox: 0.13, oy: 0.2 },
    { s: 2.55, cam: fixed(-44, 34, -18, -8, 0, -54), ox: 0.13, oy: 0.2 },
    { s: 2.86, cam: fixed(-37, 15, -35, -21, 1, -53.5), ox: 0.13, oy: 0.2 },
    { s: 3.12, cam: chase, ox: 0.13, oy: 0.2 },
    { s: 3.6, cam: chase, ox: 0.13, oy: 0.2 },
    { s: 3.82, cam: fixed(-8, 24, -10, -13.5, 1, 14.5), ox: 0.13, oy: 0.2 },
    { s: 4.05, cam: fixed(-8, 24, -10, -13.5, 1, 14.5), ox: 0.13, oy: 0.2 },
    { s: 4.2, cam: chase, ox: 0.13, oy: 0.2 },
    { s: 4.6, cam: chase, ox: 0.13, oy: 0.2 },
    { s: 4.86, cam: fixed(-1, 17, 38, 15, 1, 60), ox: 0.13, oy: 0.2 },
    { s: 5.15, cam: fixed(-72, 80, 110, 4, 0, 32), camP: fixed(-44, 72, 100, 12, 0, 50), ox: 0.13, oy: 0.2 },
    { s: 6.0, cam: fixed(-98, 50, 100, 0, 0, 0), ox: 0.15, oy: 0.28 },
  ];
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  function updateCamera(s) {
    let i = 0;
    while (i < KF.length - 2 && s >= KF[i + 1].s) i++;
    const A = KF[i], B = KF[i + 1];
    const f = smoother(seg(s, A.s, B.s));
    const w = window.innerWidth, h = window.innerHeight, aspect = w / h;
    const shot = (K) => (aspect < 1 && K.camP ? K.camP : K.cam)();   // camP：直螢幕另外構圖
    const a = shot(A), b = shot(B);
    camPos.lerpVectors(a.pos, b.pos, f); camTgt.lerpVectors(a.tgt, b.tgt, f);
    const k = aspect < 1.2 ? 1 + (1.2 - aspect) * 0.45 : 1;
    camera.position.copy(camTgt).add(camPos.sub(camTgt).multiplyScalar(k));
    camera.lookAt(camTgt);
    const ox = lerp(A.ox, B.ox, f), oy = lerp(A.oy, B.oy, f);
    if (aspect >= 1) camera.setViewOffset(w, h, -ox * w, 0, w, h);
    else camera.setViewOffset(w, h, 0, oy * h, w, h);
    sky.position.copy(camera.position);
    // 霧跟著距離走：主體清楚、遠景淡進天色
    const dist = camera.position.distanceTo(camTgt);
    scene.fog.near = dist * 0.9;
    scene.fog.far = dist * 2.6 + 60;
    // 影子只算鏡頭看的那一塊
    const half = Math.round(clamp(dist * 0.55, 22, 95));
    const sc = sun.shadow.camera;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
    sun.target.position.copy(camTgt);
    sun.position.copy(camTgt).addScaledVector(sunDir, 240);
  }

  function updateRings(s, t) {
    const v = bump(s, 1.45, 1.85, 2.35, 2.7);
    const win = smooth(seg(s, 1.98, 2.2));
    rings.forEach(({ s: semi, pair, i }) => {
      const p = semi.t.position;
      pair.forEach((m, k) => {
        const ph = ((reduceMotion ? 0.35 : t * 0.6) + k * 0.5 + i * 0.13) % 1;
        m.position.set(p.x, 0.14, p.z);
        m.scale.setScalar(1 + ph * 4.5);
        const alive = i === 0 ? 1 : 1 - win;
        m.material.opacity = v * alive * (1 - ph) * 0.9;
        m.visible = m.material.opacity > 0.01;
      });
    });
    acceptDisc.position.set(hero.t.position.x, 0.13, hero.t.position.z);
    acceptDisc.material.opacity = 0.4 * win * (1 - smooth(seg(s, 2.3, 2.6)));
    acceptDisc.visible = acceptDisc.material.opacity > 0.01;
  }

  const hudQuote = $('#hud-quote'), hudAccept = $('#hud-accept'), hudStatus = $('#hud-status'), hudText = $('#hud-status-text');
  const proj = new THREE.Vector3();
  const topbar = $('.topbar');
  function hud(el, world, vis) {
    if (vis < 0.02) { if (el.style.visibility !== 'hidden') { el.style.visibility = 'hidden'; el.style.opacity = '0'; } return; }
    proj.copy(world).project(camera);
    if (proj.z > 1 || Math.abs(proj.x) > 1.2 || Math.abs(proj.y) > 1.2) { el.style.visibility = 'hidden'; return; }
    // 小卡的下緣對準物件；被頂列或畫面邊緣擋到時往內收
    const w = el.offsetWidth, h = el.offsetHeight, top = topbar.offsetHeight + 10;
    const x = clamp((proj.x * 0.5 + 0.5) * window.innerWidth, w / 2 + 10, window.innerWidth - w / 2 - 10);
    const y = Math.max((-proj.y * 0.5 + 0.5) * window.innerHeight, top + h);
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    el.style.opacity = vis.toFixed(3);
    el.style.visibility = 'visible';
  }
  // 狀態字跟貨主 App 用同一套說法（正前往裝貨點、已抵達裝貨點、運送中、已抵達卸貨點、運送完成）
  let lastStatus = '';
  function updateHud(s) {
    hud(hudQuote, V(-22, 5.6, -58), bump(s, 0.55, 0.85, 1.35, 1.6));
    hud(hudAccept, heroPos.clone().setY(3.4), bump(s, 2.02, 2.12, 2.4, 2.55));
    let text = '';
    if (s >= 2.3 && s < 2.8) text = '正前往裝貨點';
    else if (s >= 2.8 && s < 3.1) text = '已抵達裝貨點，裝貨中';
    else if (s >= 3.1 && s < 3.72) text = '運送中';
    else if (s >= 3.72 && s < 4.05) text = s < 3.98 ? '已抵達卸貨點，卸貨中' : '第 1 站卸貨完成';
    else if (s >= 4.05 && s < 4.66) text = '運送中';
    else if (s >= 4.66) text = s < 4.95 ? '已抵達卸貨點，卸貨中' : '運送完成';
    if (text && text !== lastStatus) { hudText.textContent = text; lastStatus = text; }
    hud(hudStatus, heroPos.clone().setY(3.6), text ? bump(s, 2.35, 2.45, 5.2, 5.5) : 0);
  }

  /* ── 迴圈 ── */
  const details = $('#details');
  let sCur = 0, first = true, tAcc = 0, frames = 0, slow = 0;
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.06);
    const t = clock.elapsedTime;
    if (!first && details.getBoundingClientRect().top <= 0) return;  // 行程之後，畫布被蓋住了，不用畫
    const sTarget = scrollS();
    sCur = reduceMotion || first ? sTarget : sCur + (sTarget - sCur) * (1 - Math.exp(-dt * 6));
    updateHero(sCur);
    updateCamera(sCur);
    updateRings(sCur, t);
    updateHud(sCur);
    routeLine.geometry.setDrawRange(0, Math.floor(routeIndexCount * smooth(seg(sCur, 1.95, 2.55)) / 36) * 36);
    const pv = bump(sCur, 1.95, 2.3, 5.2, 5.6);
    pinMat.opacity = pv; pins.forEach((m, i) => { m.visible = pv > 0.01; m.position.y = 3.2 + (reduceMotion ? 0 : Math.sin(t * 2 + i) * 0.25); m.rotation.y = reduceMotion ? 0 : t * 0.8; });
    if (!reduceMotion) {
      rotors.forEach((r) => { r.rotation.z += dt * r.userData.speed; });
      redMat.opacity = (Math.sin(t * 3.2) > 0.2) ? 1 : 0.15;
      traffic.forEach((tr) => { tr.u = (tr.u + tr.dir * tr.speed * dt / tr.cv.getLength() + 1) % 1; placeTraffic(tr); });
      trainU += 4.2 * dt / railLen; if (trainU > 1.05) trainU = -0.02; placeTrain();
    }
    renderer.render(scene, camera);
    if (first) { canvas.classList.add('ready'); first = false; }
    // 手機太慢的話降低解析度
    tAcc += dt; frames++;
    if (tAcc > 2) { if (frames / tAcc < 28 && dprCap > 1) { slow++; if (slow >= 2) { dprCap = 1; renderer.setPixelRatio(1); } } tAcc = 0; frames = 0; }
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    measure();
  }
  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  window.addEventListener('load', measure);
  measure();
  updateHero(0);
  frame();
}

main();
