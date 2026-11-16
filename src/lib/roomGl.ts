// v1.16 — Rendu WebGL de la chambre vue de loin : Arnold à son bureau, elle sur le lit avec son téléphone, Yuki.
// La peinture elle-même est animée (déformation douce, lumière) ; les livres sont les vrais livres peints
// du tableau suivant, révélés un par un.
import { ROOM_BULBS, type Phase, type Weather } from './room'

const VS = `attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = vec2(aPos.x*.5+.5, .5-aPos.y*.5); gl_Position = vec4(aPos,0.,1.); }`

const FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uImg, uNext, uReveal, uFx, uWin, uCity;
uniform float uT, uWrite, uPet, uSleep, uThink, uPhone, uProg;
uniform float uDay, uDusk, uNight, uRain, uCloud;
uniform vec3 uSkyTop, uSkyHor, uCityCol, uCloudCol;
const vec4 WIN = vec4(380., 230., 360., 360.);
uniform vec2 uBulb[28];
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
  // — Arnold : respiration, ancrée sur la chaise
  float br = sin(6.2832 * uT / 4.4);
  float wP = body * g2(p, vec2(625., 680.), vec2(120., 140.));
  d += wP * vec2((p.x - 630.) * .004 * br, -max(0., 800. - p.y) * .009 * br);
  // tête : suit la musique, se relève quand il réfléchit
  float beat = .6 * sin(6.2832 * uT / 1.25) + .4 * sin(6.2832 * uT / 2.5 + 1.);
  float wH = body * g2(p, vec2(686., 522.), vec2(72., 78.));
  vec2 piv = vec2(668., 605.);
  d += wH * (rot(p - piv, .012 * beat * (1. - uThink) - .05 * uThink) - (p - piv));
  // main : écrit une ligne de gauche à droite, revient, recommence ; s'arrête quand il réfléchit
  float u = fract(uT / (3.0 - 1.2 * uWrite));
  float sweep = mix(-5., 10., smoothstep(0., .86, u)) * (1. - smoothstep(.86, 1., u)) ;
  float act = (1. - uThink);
  vec2 hm = vec2(sweep + (1.3 + uWrite) * sin(uT * (10. + 5. * uWrite)), (1.1 + .8 * uWrite) * sin(uT * (14. + 6. * uWrite) + 1.3)) * act;
  hm.y -= 3.5 * uThink;
  float wW = body * g2(p, vec2(765., 748.), vec2(34., 30.));
  float wF = body * g2(p, vec2(700., 760.), vec2(62., 26.)) * .45;
  d += (wW + wF) * hm;
  // — Yuki : respiration, oreilles, bout de la queue, tête qui se relève quand on la caresse
  float cb = sin(6.2832 * uT / 3.6);
  float wC = g2(p, vec2(318., 834.), vec2(76., 42.)) * (1. - .6 * g2(p, vec2(389., 826.), vec2(32., 32.)));
  d += wC * vec2((p.x - 318.) * .008 * cb, -max(0., 880. - p.y) * .03 * cb);
  float et = mod(uT + 2., 7.3);
  float tw = smoothstep(0., .08, et) * (1. - smoothstep(.12, .35, et));
  tw = max(tw, uPet * abs(sin(uT * 18.)));
  vec2 e1 = vec2(372., 806.), e2 = vec2(408., 817.);
  d += g2(p, vec2(370., 793.), vec2(9., 11.)) * (rot(p - e1, -.25 * tw) - (p - e1));
  d += g2(p, vec2(413., 808.), vec2(9., 10.)) * (rot(p - e2, .22 * tw) - (p - e2));
  float tf = mod(uT, 5.1);
  float tail = smoothstep(0., .25, tf) * (1. - smoothstep(.3, .9, tf));
  tail = max(tail, uPet * (.5 + .5 * sin(uT * 9.)));
  d += g2(p, vec2(378., 864.), vec2(20., 9.)) * vec2(2.5, -4.5) * tail;
  vec2 hp = vec2(368., 850.);
  d += g2(p, vec2(389., 826.), vec2(29., 29.)) * (rot(p - hp, -.09 * uPet + .012 * sin(uT * .7)) - (p - hp));
  // — elle, sur le lit : respiration, pouce qui fait défiler, petit mouvement de tête
  float wb = sin(6.2832 * uT / 4.9 + 1.);
  d += g2(p, vec2(226., 742.), vec2(58., 40.)) * vec2(0., -3.2 * wb);
  float sc = mod(uT, 3.4); float flick = smoothstep(0., .15, sc) * (1. - smoothstep(.2, .5, sc));
  d += g2(p, vec2(236., 668.), vec2(13., 13.)) * vec2(.6, -3. * flick);
  d += g2(p, vec2(231., 645.), vec2(16., 26.)) * vec2(0., .8 * sin(uT * 1.1));
  vec2 np = vec2(196., 700.);
  d += g2(p, vec2(180., 652.), vec2(40., 44.)) * (rot(p - np, .014 * sin(uT * .5) + .02 * flick) - (p - np));
  // plante suspendue qui se balance à peine
  float wPl = g2(p, vec2(766., 330.), vec2(34., 80.)) * smoothstep(240., 420., p.y);
  d.x += wPl * 2.2 * sin(uT * .9 + p.y * .02);
  return p - d;
}

void main(){
  vec2 p = vUv * IMG;
  vec4 fx = texture2D(uFx, vUv);
  float glass = fx.g;
  vec2 q = warp(p, fx.b);
  q += uRain * glass * 1.4 * vec2(noise(vec2(p.x * .06, p.y * .025 - uT * 1.5)) - .5, noise(vec2(p.x * .06 + 7., p.y * .025 - uT * 1.5)) - .5);
  vec2 uv = q / IMG;
  vec3 col = texture2D(uImg, uv).rgb;
  // pile de livres (uProg = 0..6) : le livre du dessus, avec sa couverture, descend ;
  // les livres du bas du tableau suivant apparaissent dessous. Les lignes entre livres suivent la perspective.
  if (uProg > 0.) {
    float nn = max(uProg, 1.);
    float u = q.y - (q.x < 287. ? .24 * (q.x - 287.) : -.58 * (q.x - 287.));
    vec2 sq = u < 1165. - 24.5 * (nn - 1.) ? q - vec2(0., 24.5 * (6. - nn)) : q;
    float on = texture2D(uReveal, sq / IMG).g * min(uProg, 1.);
    col = mix(col, texture2D(uNext, sq / IMG).rgb, on);
  }

  // yeux de Yuki : fermés quand elle dort, clignement quand elle est réveillée
  float bl = mod(uT, 4.7); float blink = smoothstep(0., .07, bl) * (1. - smoothstep(.1, .22, bl));
  float closeC = max(uSleep * (1. - uPet), blink * (1. - uSleep * (1. - uPet)));
  float eyes = max(g2(q, vec2(370., 823.), vec2(5.2, 3.6)), g2(q, vec2(392., 832.), vec2(5.4, 3.6)));
  col = mix(col, vec3(.085, .055, .075), clamp(eyes * 1.5, 0., 1.) * closeC);
  float lid = max(g2(q, vec2(370., 824.5), vec2(5.5, 1.1)), g2(q, vec2(392., 833.5), vec2(5.6, 1.1)));
  col = mix(col, vec3(.03, .02, .03), lid * closeC * .9);
  // clignement d'Arnold
  float mb = mod(uT + 1.3, 5.6); float mblink = smoothstep(0., .06, mb) * (1. - smoothstep(.09, .2, mb));
  vec3 skin = texture2D(uImg, (q + vec2(-2., 12.)) / IMG).rgb;
  col = mix(col, skin * .86, g2(q, vec2(704., 542.), vec2(5., 2.6)) * mblink * .9);

  // elle : clignement, et lumière du téléphone sur le visage (allumé la nuit, éteint le jour)
  float wbk = mod(uT + 2.9, 4.3); float wblink = smoothstep(0., .06, wbk) * (1. - smoothstep(.09, .2, wbk));
  vec3 wskin = texture2D(uImg, (q + vec2(3., 11.)) / IMG).rgb;
  col = mix(col, wskin * .9, max(g2(q, vec2(166., 652.), vec2(5., 2.4)), g2(q, vec2(191., 644.), vec2(5., 2.4))) * wblink * .9);
  float face = g2(q, vec2(186., 664.), vec2(42., 46.));
  float scr = g2(q, vec2(229., 640.), vec2(8.5, 16.));
  float scroll = floor(uT / 1.7); float pulse = .5 + .5 * hash(scroll) ; pulse = mix(pulse, .5 + .5 * hash(scroll + 1.), smoothstep(.8, 1., fract(uT / 1.7)));
  col += vec3(.10, .15, .26) * face * uPhone * (.25 + .75 * pulse) * (.35 + dot(col, vec3(.4)));
  col += vec3(.14, .19, .32) * scr * uPhone * (.3 + .5 * pulse);
  vec3 warmSkin = vec3(dot(col, vec3(.45, .35, .2))) * vec3(1.18, .88, .78) * .82;
  col = mix(col, warmSkin, face * (1. - uPhone) * .75);
  col = mix(col, vec3(.05, .045, .08), scr * (1. - uPhone) * .95);

  // lumière de la pièce selon l'heure
  float lum0 = dot(col, vec3(.299, .587, .114));
  float spill = g2(p, vec2(560., 400.), vec2(320., 460.));
  vec3 cd = mix(col, vec3(lum0), .28) * vec3(1.32, 1.25, 1.08) * (1.3 - .14 * uRain) + vec3(.045, .045, .055);
  cd += uSkyHor * spill * .2;
  vec3 cu = col * vec3(1.2, 1.03, .97) * 1.1 + uSkyHor * spill * .14;
  vec3 room = col * uNight + cd * uDay + cu * uDusk;
  col = mix(room, col, glass);
  // la fenêtre : ciel de jour / crépuscule, vitre sans pluie si beau temps
  if (glass > .001){
    vec2 wp = (q - WIN.xy) / WIN.zw;
    vec3 clean = texture2D(uWin, wp).rgb;
    vec4 cm = texture2D(uCity, wp);
    vec3 night = mix(clean, col, uRain);
    float hz = clamp((q.y - 230.) / 330., 0., 1.);
    vec3 sky = mix(uSkyTop, uSkyHor, pow(hz, 1.25));
    float cl = fbm(vec2(q.x * .009 + uT * .02, q.y * .02));
    sky = mix(sky, uCloudCol, smoothstep(.42, .78, cl) * uCloud * (1. - hz * .5));
    float lc = dot(clean, vec3(.3, .59, .11));
    vec3 city = uCityCol * (.82 + 1.1 * min(lc, .3));
    city = mix(city, uSkyHor, .3 * (1. - hz));
    vec3 dayWin = mix(sky, city, cm.r) + clean * cm.g * uDusk * .9;
    col = mix(col, mix(night, dayWin, 1. - uNight), glass);
  }

  // lampe qui vit
  float fl = .5 * noise(vec2(uT * 3.1, 0.)) + .5 * noise(vec2(uT * 9.7, 3.)) - .5;
  float warm = clamp((col.r - col.b) * 2.2, 0., 1.);
  float wl = g2(p, vec2(800., 640.), vec2(300., 300.));
  col *= 1. + fl * .09 * wl * warm;

  // guirlandes et bougies
  for (int i = 0; i < 28; i++){
    if (i >= uBulbN) break;
    vec2 dd = p - uBulb[i]; float r2 = dot(dd, dd);
    if (r2 > 1600.) continue;
    float fi = float(i);
    float t2 = .5 + .5 * sin(uT * (1.2 + .31 * fi) + fi * 1.7); t2 *= t2;
    col *= 1. + (.7 * t2 - .25) * exp(-r2 / 60.);
    col += vec3(1., .7, .36) * exp(-r2 / 420.) * .10 * t2;
  }

  // pluie + ville qui scintille
  if (glass > .01 && uRain > .01){
    float rain = 0.;
    for (int l = 0; l < 2; l++){
      float L = float(l); float sc = 5. + L * 4.;
      float xs = p.x + p.y * .08; float cid = floor(xs / sc);
      float h = hash(cid * 13.1 + L * 71.);
      float speed = 520. + h * 300. + L * 200.; float len = 36. + h * 50.;
      float seg = fract((p.y - uT * speed + h * 2000.) / (len * 6.));
      float streak = smoothstep(0., 1. / 6., seg) * (1. - step(1. / 6., seg));
      float xin = 1. - abs(fract(xs / sc) - .5) * 2.;
      rain += streak * smoothstep(.7, 1., xin) * step(.45, h) * (.6 - L * .25);
    }
    col += vec3(.72, .8, 1.) * rain * (.17 + .08 * (1. - uNight)) * glass * uRain;
  }
  if (glass > .01){
    float lum = dot(col, vec3(.3, .59, .11));
    col *= 1. + glass * uNight * smoothstep(.3, .7, lum) * (noise(p * .1 + uT * .7) - .5) * .4;
  }

  // vapeur du café
  vec2 sp = p - vec2(836., 772.);
  if (sp.y < 0. && sp.y > -95. && abs(sp.x) < 42.){
    float hg = -sp.y / 95.;
    float wob = (noise(vec2(hg * 3., uT * .4)) - .5) * 24. * hg;
    float xw = abs(sp.x - wob) / (9. + 16. * hg);
    float n = fbm(vec2(sp.x * .05, sp.y * .04 + uT * .6));
    float s = (1. - smoothstep(0., 1., xw)) * smoothstep(0., .15, hg) * (1. - smoothstep(.5, 1., hg)) * smoothstep(.42, .72, n);
    col += vec3(1., .93, .85) * s * .15;
  }
  // poussière dans la lumière
  for (int i = 0; i < 8; i++){
    float fi = float(i);
    vec2 c = vec2(720. + hash(fi) * 170., 590. + mod(hash(fi + 9.) * 150. + uT * (4. + hash(fi + 3.) * 5.), 150.));
    c.x += sin(uT * .4 + fi) * 9.;
    vec2 dd = p - c;
    col += vec3(1., .86, .6) * exp(-dot(dd, dd) / 8.) * .2 * (.4 + .6 * uNight) * (.5 + .5 * sin(uT * 1.3 + fi * 2.));
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
  base: HTMLImageElement
  next: HTMLImageElement
  reveal: HTMLImageElement
  fx: HTMLImageElement
  win: HTMLImageElement
  city: HTMLImageElement
}

export interface RoomRenderer {
  /** Nombre de livres posés (0 → ROOM_TOTAL) ; les nouveaux apparaissent en fondu. */
  setBooks(n: number, instant?: boolean): void
  setEnv(env: Phase & Weather, instant?: boolean): void
  /** Arnold écrit plus vite pendant quelques secondes (bonne réponse, toucher). */
  writeBurst(sec?: number): void
  /** On caresse Yuki : elle ouvre les yeux, relève la tête, remue la queue. */
  pet(sec?: number): void
  frame(t: number, dt: number): void
  destroy(): void
}

type Env = Phase & Weather
const UNIFORMS = ['uImg', 'uNext', 'uReveal', 'uFx', 'uWin', 'uCity', 'uT', 'uWrite', 'uPet', 'uSleep', 'uThink', 'uPhone', 'uProg',
  'uDay', 'uDusk', 'uNight', 'uRain', 'uCloud', 'uSkyTop', 'uSkyHor', 'uCityCol', 'uCloudCol', 'uBulb', 'uBulbN'] as const

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
  const tex = (im: HTMLImageElement, unit: number, u: WebGLUniformLocation | null) => {
    const t = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1i(u, unit)
    textures.push(t)
  }
  tex(img.base, 0, U.uImg); tex(img.next, 1, U.uNext); tex(img.reveal, 2, U.uReveal)
  tex(img.fx, 3, U.uFx); tex(img.win, 4, U.uWin); tex(img.city, 5, U.uCity)
  const bulbs = new Float32Array(56)
  ROOM_BULBS.slice(0, 28).forEach((b, i) => { bulbs[i * 2] = b[0]; bulbs[i * 2 + 1] = b[1] })
  gl.uniform2fv(U.uBulb, bulbs)
  gl.uniform1i(U.uBulbN, Math.min(28, ROOM_BULBS.length))

  const env: { cur: Env; target: Env } = {
    cur: { day: 0, dusk: 0, night: 1, rain: 1, cloud: 0.9 },
    target: { day: 0, dusk: 0, night: 1, rain: 1, cloud: 0.9 },
  }
  const s = { books: 0, booksT: 0, write: 0, writeT: 0, pet: 0, petT: 0, think: 0, thinkT: 0, nextThink: 9, t: 0 }
  const ease = (cur: number, target: number, k: number, dt: number) => cur + (target - cur) * Math.min(1, dt * k)

  function advance(dt: number) {
    const t = s.t
    if (s.books < s.booksT) s.books = Math.min(s.booksT, s.books + dt / 0.9)
    s.write = ease(s.write, t < s.writeT ? 1 : 0, 4, dt)
    s.pet = ease(s.pet, t < s.petT ? 1 : 0, 3, dt)
    if (t > s.nextThink) { s.thinkT = t + 2.4; s.nextThink = t + 11 + Math.random() * 8 }
    s.think = ease(s.think, t < s.thinkT && t > s.writeT ? 1 : 0, 3, dt)
    const f = Math.min(1, dt * 1.6)
    for (const key of Object.keys(env.cur) as Array<keyof Env>) env.cur[key] += (env.target[key] - env.cur[key]) * f
  }

  function draw(t: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const k = Math.min(1, 1136 / (canvas.clientWidth * dpr || 1)) // jamais plus fin que la peinture
    const w = Math.round(canvas.clientWidth * dpr * k)
    const h = Math.round(canvas.clientHeight * dpr * k)
    if (!w || !h) return
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
    gl.viewport(0, 0, w, h)
    const e = env.cur
    const pal = mixPal(palette('day', e), palette('dusk', e), e.dusk / Math.max(1e-3, e.day + e.dusk))
    gl.uniform1f(U.uT, t)
    gl.uniform1f(U.uWrite, s.write); gl.uniform1f(U.uPet, s.pet); gl.uniform1f(U.uThink, s.think)
    gl.uniform1f(U.uSleep, e.night)                         // Yuki dort la nuit
    gl.uniform1f(U.uPhone, Math.min(1, e.night + 0.6 * e.dusk)) // l'écran éclaire son visage la nuit
    gl.uniform1f(U.uProg, s.books)
    gl.uniform1f(U.uDay, e.day); gl.uniform1f(U.uDusk, e.dusk); gl.uniform1f(U.uNight, e.night)
    gl.uniform1f(U.uRain, e.rain); gl.uniform1f(U.uCloud, e.cloud)
    gl.uniform3fv(U.uSkyTop, pal[0]); gl.uniform3fv(U.uSkyHor, pal[1]); gl.uniform3fv(U.uCityCol, pal[2]); gl.uniform3fv(U.uCloudCol, pal[3])
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  return {
    setBooks(n, instant) {
      s.booksT = n
      if (instant || n < s.books) s.books = n
    },
    setEnv(v, instant) {
      Object.assign(env.target, v)
      if (instant) Object.assign(env.cur, env.target)
    },
    writeBurst(sec = 3) { s.writeT = s.t + sec },
    pet(sec = 3.5) { s.petT = s.t + sec },
    frame(t, dt) { s.t = t; advance(dt); draw(t) },
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
