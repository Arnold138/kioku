# Découpe les phrases en blocs (kana alignés sur les kanji). À lancer depuis la racine : python3 scripts/blocks/blocks.py (pip install pykakasi)
import json, re, sys, functools
S = json.load(open('src/data/sentences.json'))
V = json.load(open('src/data/video.json'))
items = [('s%d' % s['id'], s['jp'], s['kana']) for s in S] + [(v['id'], v['jp'], v['kana']) for v in V]
GR = set('は が を に で と も の か ね よ へ や から まで より って じゃ ば し です ます でした ました ません でしょう だ だった じゃない ない た て ください ですか ますか ね な な の よね けど けれど ので のに たら ても でも って'.split())
def k2h(s): return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)
PUNCT = set('、。，．,.!?！？「」『』（）()・…〜~ー　 ：:；;"\'“”')
def chunks(kana):
    t = kana.split()
    out = []
    for w in t:
        if out and (w in GR or (len(w) == 1 and w != 'ー')): out[-1] += w
        else: out.append(w)
    while len(out) > 7:
        i = min(range(len(out) - 1), key=lambda i: len(out[i]) + len(out[i + 1]))
        out[i:i + 2] = [out[i] + out[i + 1]]
    return out
def kind(c):
    if 'ぁ' <= c <= 'ゖ' or 'ァ' <= c <= 'ヺ': return 'k'
    if c == 'ー': return 'k'
    if c in PUNCT: return 'p'
    return 'x'  # kanji, latin, digits
import pykakasi
KK = pykakasi.kakasi()
UNIT = re.compile(r'[A-Za-z0-9０-９Ａ-Ｚａ-ｚ]+')
COST = {1: .8, 2: .3, 3: .6, 4: 1.2}
def align(jp, kana, ends=()):
    """Nombre de kana lus par chaque caractère de jp (coût minimal), sans couper un kanji entre deux blocs."""
    kh = k2h(kana); E = set(ends)
    seg = {}  # début de segment kakasi → (longueur, lecture)
    p = 0
    for x in KK.convert(jp):
        if re.search(r'[一-鿿々]', x['orig']): seg[p] = (len(x['orig']), k2h(x['hira']))
        p += len(x['orig'])
    unit = {m.start(): m.end() for m in UNIT.finditer(jp)}
    cross = lambda j, n: any(j < e < j + n for e in E)
    @functools.lru_cache(None)
    def m(i, j):
        if i == len(jp): return (0., ()) if j == len(kh) else (1e9, None)
        best = (1e9, None)
        def tryit(cost, ni, nj, cons):
            nonlocal best
            r = m(ni, nj)
            if r[1] is not None and cost + r[0] < best[0]: best = (cost + r[0], cons + r[1])
        c = jp[i]; t = kind(c)
        if i in seg:
            L, R = seg[i]
            if kh.startswith(R, j) and not cross(j, len(R)):
                # le segment entier : lecture exacte → on répartit (kanji d'abord, okurigana ensuite)
                cons = [0] * L; rest = len(R)
                tail = 0
                while tail < L and kind(jp[i + L - 1 - tail]) == 'k': tail += 1
                for q in range(L - tail, L): cons[q] = 1
                rest -= tail
                kan = L - tail
                for q in range(kan): cons[q] = rest // kan + (1 if q < rest % kan else 0)
                if all(cons[q] > 0 for q in range(kan)) and not any(cross(j + sum(cons[:q]), cons[q]) for q in range(L)):
                    tryit(0., i + L, j + len(R), tuple(cons))
        if i in unit:
            e = unit[i]; L = e - i
            for n in range(1, 15):
                if j + n > len(kh): break
                if cross(j, n): break
                tryit(.3, e, j + n, (n,) + (0,) * (L - 1))
            return best
        if t == 'p':
            tryit(0., i + 1, j, (0,))
        elif t == 'k':
            if j < len(kh) and (k2h(c) == kh[j] or c == 'ー'): tryit(0., i + 1, j + 1, (1,))
        else:
            for n in range(1, 5):
                if j + n > len(kh) or cross(j, n): break
                tryit(COST[n], i + 1, j + n, (n,))
        return best
    r = m(0, 0)[1]
    return r
out = {}; fail = []
for iid, jp, kana in items:
    ch = chunks(kana)
    ends = []; s = 0
    for c in ch: s += len(c); ends.append(s)
    a = align(jp, ''.join(ch), tuple(ends))
    if a is None:
        # un kanji lu à cheval sur deux blocs : on fusionne ces blocs
        a0 = align(jp, ''.join(ch))
        if a0 is None: fail.append(iid); continue
        j = 0; merge = set()
        for n in a0:
            for e in ends:
                if j < e < j + n: merge.add(ends.index(e))
            j += n
        nc = []
        for i, c in enumerate(ch):
            if nc and (i - 1) in merge: nc[-1] += c
            else: nc.append(c)
        ch = nc; ends = []; s = 0
        for c in ch: s += len(c); ends.append(s)
        a = align(jp, ''.join(ch), tuple(ends))
        if a is None: fail.append(iid); continue
    blocks = []; cur = ''; pos = 0; bi = 0
    for c, n in zip(jp, a):
        if n and pos >= ends[bi] and bi < len(ch) - 1:
            blocks.append(cur); cur = ''; bi += 1
        cur += c; pos += n
    blocks.append(cur)
    if len(blocks) != len(ch): fail.append(iid); continue
    segs = []; p = 0
    for x in KK.convert(jp): segs.append((p, p + len(x['orig']))); p += len(x['orig'])
    bl = [[b, c] for b, c in zip(blocks, ch)]
    changed = True
    while changed:
        changed = False
        pos = 0
        for q in range(len(bl) - 1):
            pos += len(bl[q][0])
            a_, b_ = bl[q][0][-1], bl[q + 1][0][0]
            if kind(a_) == 'x' and kind(b_) == 'x' and any(s0 < pos < s1 for s0, s1 in segs):
                bl[q:q + 2] = [[bl[q][0] + bl[q + 1][0], bl[q][1] + bl[q + 1][1]]]
                changed = True; break
    out[iid] = bl
json.dump(out, open('scripts/blocks/blocks-auto.json', 'w'), ensure_ascii=False)
print(len(out), 'ok', len(fail), 'fail', fail[:40])
