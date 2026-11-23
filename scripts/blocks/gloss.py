# Écrit src/data/gloss.json : pour chaque phrase, les mots à toucher avec forme de base, lecture, sens et grammaire.
# À lancer depuis la racine : python3 scripts/blocks/gloss.py  (pip install fugashi unidic-lite)
import json, re, sys
sys.path.insert(0, 'scripts/blocks')
from words import units, h

W = json.load(open('src/data/words.json'))
S = json.load(open('src/data/sentences.json')); V = json.load(open('src/data/video.json'))
byjp, byk, bykall = {}, {}, {}
for w in W:
    byjp.setdefault(w['jp'], w); byk.setdefault(w['kana'], w); bykall.setdefault(w['kana'], []).append(w)
LEX = {}
for line in open('scripts/blocks/lex.txt'):
    if '=' not in line: continue
    k, v = line.rstrip('\n').split('=', 1)
    fr, _, rd = v.partition('|')
    LEX[k] = (fr, rd)

PARTICLE = {
    'は': 'particule du thème : « quant à… »', 'が': 'particule du sujet (ou « mais » en fin de phrase)', 'を': 'particule du complément d\'objet',
    'に': 'particule : lieu, moment, destination ou personne visée', 'で': 'particule : lieu de l\'action ou moyen (« en, avec »)',
    'へ': 'particule de direction : « vers »', 'と': 'particule : « avec », « et » ou citation (« que… »)', 'も': 'particule : « aussi, même »',
    'の': 'particule : « de » (possession) ou « celui qui… »', 'か': 'particule de question (ou « ou bien »)', 'ね': 'fin de phrase : « hein, n\'est-ce pas »',
    'よ': 'fin de phrase : « je te dis », insiste', 'から': '« depuis » ou « parce que »', 'まで': '« jusqu\'à »', 'より': '« que » (comparaison)',
    'けど': '« mais »', 'けれど': '« mais »', 'ので': '« comme, parce que »', 'のに': '« alors que »', 'って': 'familier : « c\'est… » / « on dit que »',
    'し': '« et en plus »', 'や': '« et » (liste incomplète)', 'ながら': '« tout en… »', 'な': 'familier (fin de phrase)', 'ん': 'explication (= の) : « c\'est que… »',
    'かな': '« je me demande »', 'じゃ': '= では', 'だけ': '« seulement »', 'ぐらい': '« environ »', 'くらい': '« environ »', 'など': '« etc., par exemple »',
    'とか': '« par exemple, ou »', 'でも': '« même, ou bien »', 'しか': '« ne… que » (avec négatif)', 'ば': '« si »', 'たり': '« faire des choses comme… »', 'かも': '« peut-être »',
}
WHOLE = {'ように': '« de façon à, pour » (〜ようにする : faire en sorte de ; 〜ようになる : en arriver à)', 'こういう': 'ce genre de, comme ça', 'そういう': 'ce genre de', 'どういう': 'quel genre de', 'ああいう': 'ce genre de (là-bas)', 'しょうがない': 'on n\'y peut rien', '宅急便': 'livraison à domicile', '申し訳ありません': 'je suis vraiment désolé', 'バイバイ': 'bye-bye',
         'オンライン': 'en ligne', 'クレジットカード': 'carte bancaire', 'グーグルマップ': 'Google Maps', 'チェックイン': 'enregistrement (hôtel)'}
INTERJ = {'え': 'hein ? / oh !', 'お': 'oh !', 'あ': 'ah !', 'ああ': 'ah !', 'うん': 'oui (familier)', 'ええ': 'oui / hein ?', 'へえ': 'ah bon ?', 'ほら': 'regarde !', 'よし': 'bon, allez !'}
COUNTER = {'歳': 'ans (âge)', '枚': 'objets plats (billets, feuilles)', '時': 'heure', '分': 'minutes', '回': 'fois', '人': 'personnes', 'つ': 'objets', '年': 'années', '個': 'objets', '本': 'objets longs', '杯': 'verres, bols', '階': 'étage', '月': 'mois', '日': 'jour', '円': 'yens', '台': 'machines, véhicules', 'か月': 'mois', '週間': 'semaines', '時間': 'heures', 'メートル': 'mètres'}
COPULA = {'じゃ': '« ce n\'est pas » (avec ない)', 'で': '« c\'est… et » (forme en て de です)', 'です': '« c\'est » (poli)', 'でした': '« c\'était » (poli)', 'でしょう': '« probablement »', 'だ': '« c\'est » (familier)', 'だった': '« c\'était » (familier)',
          'じゃない': '« ce n\'est pas »', 'でしょ': '« n\'est-ce pas »', 'だろう': '« probablement »'}

def form(ms):
    """Forme d'un verbe ou adjectif d'après ses terminaisons."""
    aux = [m.feature.lemma if m.feature.pos1 == '助動詞' else (m.feature.orthBase if m.feature.orthBase not in ('*', None) else m.surface) for m in ms]
    surf = ''.join(m.surface for m in ms)
    tags = []
    if 'ます' in aux:
        if 'ん' in aux or 'ぬ' in aux or 'ず' in aux: tags.append('négatif poli' + (' au passé' if 'です' in aux or 'た' in aux else ''))
        elif 'う' in aux: tags.append('proposition polie : « faisons… »')
        elif 'た' in aux: tags.append('passé poli')
        else: tags.append('forme polie')
    else:
        if 'ない' in aux and 'た' in aux: tags.append('négatif passé')
        elif 'なけれ' in surf or 'なきゃ' in surf: tags.append('« si ne… pas » (→ devoir)')
        elif 'ない' in aux: tags.append('négatif')
        elif 'たい' in aux: tags.append('« avoir envie de »' + (' (passé)' if 'た' in aux[aux.index('たい') + 1:] else ''))
        elif 'た' in aux or 'だ' in aux[1:]: tags.append('passé')
        if ('う' in aux or 'よう' in aux) and 'ます' not in aux: tags.append('volonté : « allons… / je vais… »')
    if surf.endswith('ず') or surf.endswith('ずに'): tags.append('« sans… » (négatif écrit)')
    if any(a in ('れる', 'られる') for a in aux): tags.append('passif, possible ou respect')
    if any(a in ('せる', 'させる') for a in aux): tags.append('« faire faire »')
    if surf.endswith(('て', 'で')) and ms[-1].feature.pos1 == '助詞': tags.append('forme en て : relie à la suite')
    if surf.endswith('ば'): tags.append('« si… »')
    if 'たい' in aux and 'ます' in aux: tags.append('« avoir envie de »')
    return ' · '.join(dict.fromkeys(tags))

def pattern(us, i):
    """Tournures qui tiennent sur plusieurs mots."""
    u = us[i]; nxt = [x['s'] for x in us[i + 1:i + 4]]
    nl = [x['m'][0].feature.orthBase for x in us[i + 1:i + 3]]
    prev = [x['s'] for x in us[max(0, i - 2):i]]
    if u['s'] in ('なりません', 'ならない', 'ならなかった') and i and us[i - 1]['s'].endswith('ば'): return '〜なければならない : « il faut, devoir »'
    if prev == ['こと', 'に'] and u['m'][0].feature.orthBase in ('為る', 'する'): return '〜ことにする : « décider de »'
    if u['s'] == 'できる' and nxt[:1] == ['だけ']: return 'できるだけ : « autant que possible »'
    if u['s'] == '方' and nxt[:2] == ['が', 'いい']: return '〜方がいい : « il vaut mieux »'
    if u['s'].startswith('思') and prev[-1:] == ['と']: return '〜と思う : « je pense que »'
    if not u['s'].endswith(('て', 'で')):
        if u['s'].endswith(('なければ', 'なきゃ')): return '〜なければならない : « devoir »'
        return ''
    if nxt[:2] == ['も', 'いい'] or (nxt and nxt[0] == 'も' and len(nxt) > 1 and nxt[1].startswith('いい')): return '〜てもいい(ですか) : « avoir le droit de » / « puis-je… ? »'
    if nxt and nxt[0].startswith('ください'): return '〜てください : « faites…, s\'il vous plaît »'
    if nl and nl[0] in ('居る', 'いる'): return '〜ている : action en cours ou état'
    if nl and nl[0] in ('仕舞う', 'しまう'): return '〜てしまう : faire complètement, ou par mégarde (regret)'
    if nl and nl[0] in ('貰える', 'もらえる', '貰う', 'もらう'): return '〜てもらう : se faire rendre un service (〜てもらえますか : « pourriez-vous… ? »)'
    if nl and nl[0] in ('見る', 'みる'): return '〜てみる : « essayer de »'
    if nl and nl[0] in ('来る', 'くる'): return '〜てくる : aller faire (et revenir), ou un changement qui arrive peu à peu'
    return ''

LEX_R = {('方', 'ほう'): 'côté, option (この方 : celui-ci)', ('方', 'かた'): 'personne (poli) ; manière de'}
def meaning(lem, lk, surf, rd='', ulem=''):
    if surf in LEX: return LEX[surf]
    if ulem and ulem in byjp and ulem != lem and not re.search(r'[一-鿿]', lem): return (byjp[ulem]['fr'], '')
    if not re.search(r'[一-鿿]', lem) and lk in bykall:
        c = [w for w in bykall[lk] if w['jp'] in (lem, ulem)] or [w for w in bykall[lk] if w['jp'] == w['kana']]
        if c and lem not in LEX: return (c[0]['fr'], '')
    if (surf, rd) in LEX_R: return (LEX_R[(surf, rd)], '')
    if surf in LEX: return LEX[surf]
    if surf in byjp: return (byjp[surf]['fr'], '')
    if lem in LEX: return LEX[lem]
    w = byjp.get(lem) or (byk.get(lk) if lk and not re.search(r'[一-鿿]', lem) else None) or byjp.get(surf)
    if w: return (w['fr'], '')
    return ('', '')

out = {}
miss = set()
for key, jp in [('s%d' % s['id'], s['jp']) for s in S] + [(v['id'], v['jp']) for v in V]:
    us = units(jp)
    rows = []
    for i, u in enumerate(us):
        ms = u['m']
        head = next((m for m in ms if m.feature.pos1 != '接頭辞'), ms[0])
        f = head.feature
        if f.pos1 == '助詞':
            rows.append([u['s'], u['r'], '', '', PARTICLE.get(u['s'], 'particule'), '']); continue
        if u['s'] in WHOLE:
            rows.append([u['s'], u['r'], '', '', WHOLE[u['s']], '']); continue
        if f.pos1 == '感動詞' and u['s'] in INTERJ:
            rows.append([u['s'], u['r'], '', '', INTERJ[u['s']], '']); continue
        if f.pos1 == '助動詞' and u['s'] in COPULA:
            note = '〜じゃないですか : « n\'est-ce pas ? » (familier)' if u['s'] == 'じゃ' and i + 1 < len(us) and us[i + 1]['s'] == 'ない' else ''
            rows.append([u['s'], u['r'], '', '', COPULA[u['s']], note]); continue
        lem = f.orthBase if f.orthBase not in ('*', None) else head.surface
        lk = h(f.kanaBase) if f.kanaBase not in ('*', None) else ''
        fr, rd = meaning(lem, lk, u['s'], u['r'], f.lemma if f.lemma not in ('*', None) else '')
        if rd: lk = rd
        if not fr and not re.fullmatch(r'[0-9０-９A-Za-zＡ-Ｚａ-ｚ\s]+', lem): miss.add(lem)
        rest = ms[ms.index(head) + 1:]
        if f.pos2 == '数詞' and any(m.feature.pos1 == '接尾辞' or m.surface in COUNTER for m in rest):
            k = next(j for j, m in enumerate(rest) if m.feature.pos1 == '接尾辞' or m.surface in COUNTER)
            num = head.surface + ''.join(m.surface for m in rest[:k]); c = ''.join(m.surface for m in rest[k:])
            fr = f'{num} (nombre) + {c} : ' + COUNTER.get(c, 'compteur')
            rest = []
        if u['s'].endswith('たち') and f.pos1 in ('名詞', '代名詞'): fr += ' (たち : pluriel)'
        g = form([head] + rest) if f.pos1 in ('動詞', '形容詞') or rest else ''
        p = pattern(us, i)
        if p.startswith('〜なければ'): g = ''
        g = ' · '.join(x for x in (g, p) if x)
        # forme de base seulement si elle diffère de ce qui est écrit
        base = lem if lem != u['s'] and f.pos1 in ('動詞', '形容詞', '形状詞') else ''
        if base and head.surface != lem and lem.startswith(('取る',)): base = '撮る'
        rows.append([u['s'], u['r'], base, lk if base else '', fr, g])
    out[key] = [r[:max(i for i, x in enumerate(r) if x) + 1] for r in rows]
json.dump(out, open('src/data/gloss.json', 'w'), ensure_ascii=False, separators=(',', ':'))
audit = {}
for rows in out.values():
    for r in rows:
        if len(r) > 4 and r[4] and not r[4].startswith(('particule', '«', 'fin de')): audit.setdefault(r[2] or r[0], r[4])
open('/home/claude/v17b/audit.txt', 'w').write('\n'.join(f'{k}={v}' for k, v in sorted(audit.items())))
print(len(out), 'phrases ; sans sens :', len(miss), sorted(miss)[:80])
