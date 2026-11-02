// v1.15 — Rendu WebGL de la chambre : la peinture elle-même est animée (déformation douce, lumière),
// les améliorations sont les vrais objets peints des tableaux suivants, révélés un par un.
import { ROOM_BULBS, ROOM_COUNTS, roomPos, type Phase, type Weather } from './room'

const VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = vec2(aPos.x*.5+.5, .5-aPos.y*.5); gl_Position = vec4(aPos,0.,1.); }`

const FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uBase, uNext, uReveal, uFx, uWin, uCity, uEyes;
uniform float uProg, uSwap, uT;
uniform float uDay, uDusk, uNight, uRain, uCloud, uEye;
uniform vec3 uSkyTop, uSkyHor, uCityCol, uCloudCol;
const vec4 WIN = vec4(300., 0., 580., 660.);
const vec4 EYE = vec4(320., 1050., 110., 80.);
uniform vec3 uBulb[12];
uniform int uBulbN;
const vec2 IMG = vec2(1136., 1408.);

float g2(vec2 p, vec2 c, vec2 r){ vec2 d = (p - c) / r; return exp(-.5 * dot(d, d)); }
float hash(float n){ return fract(sin(n) * 43758.5453); }
float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
  return mix(mix(hash2(i), hash2(i + vec2(1., 0.)), f.x), mix(hash2(i + vec2(0., 1.)), hash2(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= .5; } return v; }
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }

vec2 warp(vec2 p, float body){
  vec2 d = vec2(0.);
  // respiration (ancrée sur la chaise)
  float br = sin(6.2832 * uT / 4.6);
  float wP = body * g2(p, vec2(640., 640.), vec2(330., 430.));
  float up = max(0., 1050. - p.y);
  d += wP * vec2((p.x - 650.) * .0035 * br, -up * .0075 * br);
  // tête qui suit la musique
  float beat = .6 * sin(6.2832 * uT / 1.3) + .4 * sin(6.2832 * uT / 2.6 + 1.);
  float wH = body * g2(p, vec2(700., 420.), vec2(175., 175.));
  vec2 piv = vec2(690., 615.);
  d += wH * (rot(p - piv, .011 * beat) - (p - piv));
  // main qui écrit (phases d'écriture puis pause)
  float cyc = mod(uT, 4.2);
  float env = smoothstep(0., .4, cyc) * (1. - smoothstep(3., 3.4, cyc));
  float wW = body * g2(p, vec2(905., 925.), vec2(72., 64.));
  d += wW * env * vec2(2.2 * sin(uT * 9.5) + 1.2 * sin(uT * 4.1), 1.3 * sin(uT * 13. + 1.3));
  // chat qui respire (ancré sur le lit), la tête bouge moins
  float cb = sin(6.2832 * uT / 3.7);
  float wC = body * g2(p, vec2(220., 1090.), vec2(215., 125.)) * (1. - .55 * g2(p, vec2(385., 1085.), vec2(70., 70.)));
  float upc = max(0., 1215. - p.y);
  d += wC * vec2((p.x - 220.) * .006 * cb, -upc * .016 * cb);
  // oreille du chat qui tressaille
  float et = mod(uT + 2., 8.3);
  float tw = smoothstep(0., .08, et) * (1. - smoothstep(.12, .35, et));
  vec2 ep = vec2(372., 1012.);
  d += g2(p, vec2(364., 990.), vec2(18., 24.)) * (rot(p - ep, -.2 * tw) - (p - ep));
  return p - d;
}

void main(){
  vec2 p = vUv * IMG;
  vec4 fx = texture2D(uFx, vUv);
  float glass = fx.g;
  vec2 q = warp(p, fx.b);
  // la vitre ondule sous la pluie
  q += uRain * glass * 1.6 * vec2(noise(vec2(p.x * .05, p.y * .02 - uT * 1.5)) - .5,
                          noise(vec2(p.x * .05 + 7., p.y * .02 - uT * 1.5)) - .5);
  vec2 uv = q / IMG;
  vec3 a = texture2D(uBase, uv).rgb;
  vec3 b = texture2D(uNext, uv).rgb;
  vec4 rv = texture2D(uReveal, uv);
  float idx = floor(rv.r * 16. + .5);
  float on = clamp(uProg - (idx - 1.), 0., 1.) * rv.g;
  vec3 col = mix(a, b, on);
  col = mix(col, b, uSwap);
  float gw = glass * (1. - on);

  // yeux du chat : fermés la nuit, clignements le jour
  vec2 ep = (q - EYE.xy) / EYE.zw;
  if (ep.x > 0. && ep.y > 0. && ep.x < 1. && ep.y < 1.){
    vec4 e = texture2D(uEyes, ep);
    col = mix(col, e.rgb, e.a * uEye);
  }

  // lumière de la pièce selon l'heure
  float lum0 = dot(col, vec3(.299, .587, .114));
  float spill = g2(p, vec2(600., 300.), vec2(390., 560.));
  vec3 cd = mix(col, vec3(lum0), .28) * vec3(1.32, 1.25, 1.08) * (1.28 - .14 * uRain) + vec3(.045, .045, .055);
  cd += uSkyHor * spill * .2;
  vec3 cu = col * vec3(1.2, 1.03, .97) * 1.1 + uSkyHor * spill * .14;
  vec3 room = col * uNight + cd * uDay + cu * uDusk;
  col = mix(room, col, gw);

  // la fenêtre : ciel de jour / crépuscule, vitre propre si pas de pluie
  if (gw > .001){
    vec2 wp = (q - WIN.xy) / WIN.zw;
    vec3 clean = texture2D(uWin, wp).rgb;
    vec4 cm = texture2D(uCity, wp);
    vec3 night = mix(clean, col, uRain);
    float hz = clamp(q.y / 660., 0., 1.);
    vec3 sky = mix(uSkyTop, uSkyHor, pow(hz, 1.25));
    float cl = fbm(vec2(q.x * .0045 + uT * .012, q.y * .011));
    sky = mix(sky, uCloudCol, smoothstep(.42, .78, cl) * uCloud * (1. - hz * .5));
    float lc = dot(clean, vec3(.3, .59, .11));
    vec3 city = uCityCol * (.82 + 1.1 * min(lc, .3));
    city = mix(city, uSkyHor, .3 * (1. - hz));
    vec3 dayWin = mix(sky, city, cm.r) + clean * cm.g * uDusk * .9;
    vec3 win = mix(night, dayWin, 1. - uNight);
    col = mix(col, win, gw);
  }

  // lampe qui vit
  float fl = .5 * noise(vec2(uT * 3.1, 0.)) + .5 * noise(vec2(uT * 9.7, 3.)) - .5;
  float warm = clamp((col.r - col.b) * 2.2, 0., 1.);
  float wl = g2(p, vec2(1010., 610.), vec2(420., 420.));
  col *= 1. + fl * .08 * wl * warm;

  // ampoules et bougie qui scintillent
  for (int i = 0; i < 12; i++){
    if (i >= uBulbN) break;
    vec3 bb = uBulb[i];
    vec2 dd = p - bb.xy; float r2 = dot(dd, dd);
    if (r2 > 2500.) continue;
    float fi = float(i);
    float t2 = .5 + .5 * sin(uT * (1.3 + .37 * fi) + fi * 1.7); t2 *= t2;
    col *= 1. + bb.z * (.55 * t2 - .22) * exp(-r2 / 128.);
    col += bb.z * vec3(1., .72, .38) * exp(-r2 / 968.) * .09 * t2;
  }

  // pluie qui coule sur la vitre + lumières de la ville qui scintillent
  if (glass > .01 && uRain > .01){
    float rain = 0.;
    for (int l = 0; l < 2; l++){
      float L = float(l);
      float sc = 7. + L * 5.;
      float xs = p.x + p.y * .08;
      float cid = floor(xs / sc);
      float h = hash(cid * 13.1 + L * 71.);
      float speed = 700. + h * 400. + L * 250.;
      float len = 50. + h * 70.;
      float seg = fract((p.y - uT * speed + h * 2000.) / (len * 6.));
      float streak = smoothstep(0., 1. / 6., seg) * (1. - step(1. / 6., seg));
      float xin = 1. - abs(fract(xs / sc) - .5) * 2.;
      rain += streak * smoothstep(.72, 1., xin) * step(.45, h) * (.6 - L * .25);
    }
    col += vec3(.72, .8, 1.) * rain * (.17 + .08 * (1. - uNight)) * glass * uRain;
  }
  if (glass > .01){
    float lum = dot(col, vec3(.3, .59, .11));
    col *= 1. + glass * uNight * smoothstep(.45, .8, lum) * (noise(p * .08 + uT * .7) - .5) * .28;
  }

  // vapeur du café
  vec2 sp = p - vec2(968., 1045.);
  if (sp.y < 0. && sp.y > -170. && abs(sp.x) < 75.){
    float hg = -sp.y / 170.;
    float wob = (noise(vec2(hg * 3., uT * .4)) - .5) * 40. * hg;
    float xw = abs(sp.x - wob) / (18. + 30. * hg);
    float n = fbm(vec2(sp.x * .03, sp.y * .025 + uT * .6));
    float s = (1. - smoothstep(0., 1., xw)) * smoothstep(0., .15, hg) * (1. - smoothstep(.5, 1., hg)) * smoothstep(.45, .75, n);
    col += vec3(1., .93, .85) * s * .13;
  }

  // poussière dans la lumière de la lampe
  for (int i = 0; i < 9; i++){
    float fi = float(i);
    vec2 c = vec2(870. + hash(fi) * 240., 640. + mod(hash(fi + 9.) * 260. + uT * (5. + hash(fi + 3.) * 7.), 260.));
    c.x += sin(uT * .4 + fi) * 14.;
    vec2 dd = p - c;
    col += vec3(1., .86, .6) * exp(-dot(dd, dd) / 22.) * .2 * wl * (.4 + .6 * uNight) * (.5 + .5 * sin(uT * 1.3 + fi * 2.));
  }

  gl_FragColor = vec4(col, 1.);
}`

type V3 = [number, number, number]
type Pal = [V3, V3, V3, V3] // haut du ciel, horizon, ville, nuages
const PAL: Record<'day' | 'dusk', Record<'clear' | 'cloud' | 'rain', Pal>> = {
  day: {
    clear: [[0.36, 0.58, 0.86], [0.8, 0.88, 0.95], [0.52, 0.58, 0.7], [0.97, 0.97, 0.99]],
    cloud: [[0.55, 0.6, 0.68], [0.83, 0.85, 0.88], [0.5, 0.53, 0.6], [0.9, 0.9, 0.93]],
    rain: [[0.42, 0.46, 0.54], [0.67, 0.7, 0.75], [0.4, 0.43, 0.5], [0.6, 0.62, 0.67]],
  },
  dusk: {
    clear: [[0.22, 0.2, 0.46], [0.98, 0.6, 0.42], [0.3, 0.21, 0.36], [0.96, 0.58, 0.52]],
    cloud: [[0.27, 0.24, 0.4], [0.8, 0.54, 0.52], [0.27, 0.21, 0.32], [0.6, 0.45, 0.52]],
    rain: [[0.24, 0.22, 0.36], [0.66, 0.48, 0.5], [0.24, 0.2, 0.3], [0.48, 0.4, 0.48]],
  },
}
const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const mixPal = (A: Pal, B: Pal, t: number): Pal => A.map((a, i) => mix3(a, B[i], t)) as Pal
const palette = (kind: 'day' | 'dusk', w: Weather): Pal => mixPal(mixPal(PAL[kind].clear, PAL[kind].cloud, Math.min(1, w.cloud)), PAL[kind].rain, w.rain)

export interface RoomImages {
  states: HTMLImageElement[]
  reveal: HTMLImageElement[]
  fx: HTMLImageElement[]
  win: HTMLImageElement[]
  eyes: HTMLImageElement[]
  city: HTMLImageElement
}

export interface RoomRenderer {
  setStep(step: number, instant?: boolean): void
  setEnv(env: Phase & Weather, instant?: boolean): void
  /** Avance l'animation de dt secondes et dessine l'instant t. */
  frame(t: number, dt: number): void
  destroy(): void
}

type Env = Phase & Weather
const UNIFORMS = ['uBase', 'uNext', 'uReveal', 'uFx', 'uWin', 'uCity', 'uEyes', 'uProg', 'uSwap', 'uT', 'uBulb', 'uBulbN',
  'uDay', 'uDusk', 'uNight', 'uRain', 'uCloud', 'uEye', 'uSkyTop', 'uSkyHor', 'uCityCol', 'uCloudCol'] as const

export function createRoom(canvas: HTMLCanvasElement, img: RoomImages): RoomRenderer | null {
  const ctx = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false })
  if (!ctx) return null
  const gl: WebGLRenderingContext = ctx
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader')
    return s
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS))
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link')
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const U = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>
  for (const n of UNIFORMS) U[n] = gl.getUniformLocation(prog, n)

  const textures: WebGLTexture[] = []
  const tex = (im: HTMLImageElement) => {
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    textures.push(t)
    return t
  }
  const T = {
    s: img.states.map(tex), r: img.reveal.map(tex), fx: img.fx.map(tex),
    win: img.win.map(tex), eyes: img.eyes.map(tex), city: tex(img.city),
  }

  const env: { cur: Env; target: Env } = {
    cur: { day: 0, dusk: 0, night: 1, rain: 1, cloud: 0.9 },
    target: { day: 0, dusk: 0, night: 1, rain: 1, cloud: 0.9 },
  }
  const st = { k: 0, p: 0, swap: 0, target: { k: 0, p: 0 } }
  let blinkAt = 3
  let blinkLen = 0.18

  function eyeClose(t: number) {
    const e = env.cur
    if (t > blinkAt + blinkLen) { blinkAt = t + 2.5 + Math.random() * 4; blinkLen = e.dusk > 0.5 ? 0.5 : 0.18 }
    const b = t >= blinkAt ? Math.sin(Math.PI * Math.min(1, (t - blinkAt) / blinkLen)) : 0
    return Math.max(e.night, b * (1 - e.night))
  }

  function advance(dt: number) {
    const tg = st.target
    const speed = dt / 0.9
    if (st.k < tg.k) {
      if (st.p < ROOM_COUNTS[st.k]) st.p = Math.min(ROOM_COUNTS[st.k], st.p + speed)
      else { st.swap = Math.min(1, st.swap + dt / 1.1); if (st.swap >= 1) { st.k++; st.p = 0; st.swap = 0 } }
    } else if (st.k === tg.k && st.p < tg.p) st.p = Math.min(tg.p, st.p + speed)
    const f = Math.min(1, dt * 1.6)
    for (const key of Object.keys(env.cur) as Array<keyof Env>) env.cur[key] += (env.target[key] - env.cur[key]) * f
  }

  const bulbs = new Float32Array(36)
  function draw(t: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.round(canvas.clientWidth * dpr)
    const h = Math.round(canvas.clientHeight * dpr)
    if (!w || !h) return
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
    gl.viewport(0, 0, w, h)
    const k = Math.min(st.k, 3)
    const last = k >= ROOM_COUNTS.length
    const bind = (unit: number, t2: WebGLTexture, u: WebGLUniformLocation | null) => {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t2); gl.uniform1i(u, unit)
    }
    bind(0, T.s[k], U.uBase)
    bind(1, T.s[last ? k : k + 1], U.uNext)
    bind(2, T.r[last ? 0 : k], U.uReveal)
    bind(3, T.fx[k], U.uFx)
    bind(4, T.win[k], U.uWin)
    bind(5, T.city, U.uCity)
    bind(6, T.eyes[k], U.uEyes)
    const e = env.cur
    const pal = mixPal(palette('day', e), palette('dusk', e), e.dusk / Math.max(1e-3, e.day + e.dusk))
    gl.uniform1f(U.uDay, e.day); gl.uniform1f(U.uDusk, e.dusk); gl.uniform1f(U.uNight, e.night)
    gl.uniform1f(U.uRain, e.rain); gl.uniform1f(U.uCloud, e.cloud); gl.uniform1f(U.uEye, eyeClose(t))
    gl.uniform3fv(U.uSkyTop, pal[0]); gl.uniform3fv(U.uSkyHor, pal[1]); gl.uniform3fv(U.uCityCol, pal[2]); gl.uniform3fv(U.uCloudCol, pal[3])
    gl.uniform1f(U.uProg, last ? 0 : st.p)
    gl.uniform1f(U.uSwap, last ? 0 : st.swap)
    gl.uniform1f(U.uT, t)
    const bl = ROOM_BULBS[k].slice(0, 12)
    bulbs.fill(0)
    bl.forEach((b, i) => {
      const on = b[2] === 0 ? 1 : Math.max(0, Math.min(1, st.p - (b[2] - 1)))
      bulbs[i * 3] = b[0]; bulbs[i * 3 + 1] = b[1]; bulbs[i * 3 + 2] = last ? 1 : Math.max(on, st.swap)
    })
    gl.uniform3fv(U.uBulb, bulbs)
    gl.uniform1i(U.uBulbN, bl.length)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  return {
    setStep(step, instant) {
      st.target = roomPos(step)
      if (instant || st.target.k < st.k || (st.target.k === st.k && st.target.p < st.p)) {
        st.k = st.target.k; st.p = st.target.p; st.swap = 0
      }
    },
    setEnv(v, instant) {
      Object.assign(env.target, v)
      if (instant) Object.assign(env.cur, env.target)
    },
    frame(t, dt) { advance(dt); draw(t) },
    destroy() {
      textures.forEach((x) => gl.deleteTexture(x))
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    },
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('image ' + src))
    i.src = src
  })
}
