# Ajoute les variantes écrites à la main (var_*.txt) et écrit src/data/blocks.json. À lancer après blocks.py, depuis la racine.
import json
B = json.load(open('scripts/blocks/blocks-auto.json'))
rows = []
for line in open('scripts/blocks/var_s.txt'):
    p = line.rstrip('\n').split('|')
    o, n = p[1].split('>'); ok, nk = p[2].split('>'); rows.append((p[0], o, n, ok, nk, p[3]))
for f in ('scripts/blocks/var_v1.txt', 'scripts/blocks/var_v2.txt', 'scripts/blocks/var_v3.txt'):
    for line in open(f):
        p = line.rstrip('\n').split('|'); rows.append(tuple(p))
# v1.20 : lecture des blocs avec les espaces entre les mots (pour un rōmaji lisible : « kore wa », pas « koreha »)
SENT = {('s%d' % x['id']): x['kana'] for x in json.load(open('src/data/sentences.json'))}
SENT.update({x['id']: x['kana'] for x in json.load(open('src/data/video.json'))})
def spaced(iid, bl):
    toks = SENT.get(iid, '').split()
    out, t = [], 0
    for jp, ka in bl:
        got = []
        while t < len(toks) and ''.join(got) != ka and len(''.join(got)) < len(ka):
            got.append(toks[t]); t += 1
        out.append([jp, ka, ' '.join(got)] if ''.join(got) == ka and len(got) > 1 else [jp, ka])
    return out
out = {k: {'b': spaced(k, v)} for k, v in B.items()}
bad = []
for iid, o, n, ok, nk, fr in rows:
    o = o.replace(' / ', ''); ok = ok.replace(' / ', ''); n = n.replace(' / ', ''); nk = nk.replace(' / ', '')
    if iid not in B or not fr or o == n: bad.append((iid, 'skip')); continue
    bl = B[iid]
    jp = ''.join(b[0] for b in bl); ka = ''.join(b[1] for b in bl)
    a = jp.find(o); ak = ka.find(ok)
    if a < 0 or ak < 0: bad.append((iid, 'introuvable', o, ok, ka)); continue
    # blocs couverts (jp) et (kana) doivent être les mêmes
    def rng(parts, s, e):
        pos = 0; i0 = i1 = None
        for i, x in enumerate(parts):
            if i0 is None and s < pos + len(x): i0 = i
            if e <= pos + len(x): i1 = i; break
            pos += len(x)
        return i0, i1
    r1 = rng([b[0] for b in bl], a, a + len(o)); r2 = rng([b[1] for b in bl], ak, ak + len(ok))
    if r1 != r2: bad.append((iid, 'blocs différents', r1, r2)); continue
    i, j = r1
    bj = ''.join(b[0] for b in bl[i:j + 1]); bk = ''.join(b[1] for b in bl[i:j + 1])
    sp = ' '.join(b[2] if len(b) > 2 else b[1] for b in out[iid]['b'][i:j + 1])
    v = {'i': i, 'j': j, 'jp': bj.replace(o, n, 1), 'kana': bk.replace(ok, nk, 1), 'fr': fr}
    if ok in sp: v['sp'] = sp.replace(ok, nk, 1)
    out[iid]['v'] = v
json.dump(out, open('src/data/blocks.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'variantes', sum('v' in x for x in out.values()), 'phrases', len(out))
for b in bad: print(b)
