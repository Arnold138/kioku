# Découpe une phrase en mots à toucher (fugashi + unidic-lite). Utilisé par gloss.py.
import json, sys, fugashi
T = fugashi.Tagger()
def h(s): return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)
COPULA = {'です', 'でした', 'でしょう', 'だ', 'だろう', 'だっ', 'でし', 'じゃ', 'で'}
SUFFIX = {'語', '人', 'さん', 'ちゃん', 'くん', '様', '屋', '中'}
FIX = {'日本': 'にほん', '明日': 'あした', '私': 'わたし', '今日': 'きょう', '何時': 'なんじ', '一緒': 'いっしょ'}
COUNTERS = {'時', '分', '時間', '回', '人', '年', '歳', '枚', 'つ', '個', '本', '杯', '階', '月', '日', '円', '台', 'か月', '週間', 'メートル', '度'}
MERGE = [('こう', 'いう'), ('そう', 'いう'), ('どう', 'いう'), ('ああ', 'いう'), ('しょう', 'が', 'ない'), ('宅', '急便'), ('申し訳', 'ありません'), ('バイ', 'バイ')]
PART = {'格助詞', '係助詞', '副助詞', '終助詞', '準体助詞'}
def units(jp):
    """Mots à toucher : un mot plein + ses terminaisons (て, ます, た, ない…) ; particules à part."""
    out = []
    for w in T(jp):
        f = w.feature
        if f.pos1 in ('補助記号', '空白'): continue
        r = h(f.kana) if f.kana and f.kana != '*' else h(w.surface)
        if all('ァ' <= c <= 'ヺ' or c == 'ー' for c in w.surface): r = w.surface
        r = FIX.get(w.surface, r)
        attach = out and ((f.pos1 in ('助動詞', '接尾辞') and (w.surface not in COPULA or (f.lemma == 'た' and out[-1]['pos'] in ('動詞', '形容詞'))))
                          or (f.pos1 == '助詞' and f.pos2 == '接続助詞' and w.surface in ('て', 'で', 'ば'))
                          or (w.surface in SUFFIX and (out[-1]['m'][-1].feature.pos2 == '固有名詞' or w.surface in ('さん', 'ちゃん', 'くん', '様'))) or out[-1]['pos'] == '接頭辞'
                          or (f.pos2 == '数詞' and out[-1]['m'][-1].feature.pos2 == '数詞')
                          or (w.surface in COUNTERS and out[-1]['m'][-1].feature.pos2 == '数詞'))
        if attach and (out[-1]['pos'] not in ('助詞',) or out[-1]['pos'] == '接頭辞'):
            if out[-1]['pos'] == '接頭辞': out[-1]['pos'] = f.pos1
            out[-1]['s'] += w.surface; out[-1]['r'] += r; out[-1]['m'].append(w)
        else:
            out.append({'s': w.surface, 'r': r, 'pos': f.pos1, 'm': [w]})
    # の + で / に après un verbe ou un adjectif : ので (« comme »), のに (« alors que »)
    i = 1
    while i < len(out) - 1:
        if out[i]['s'] == 'の' and out[i + 1]['s'] in ('で', 'に') and (out[i - 1]['pos'] in ('動詞', '形容詞', '助動詞') or out[i - 1]['s'].endswith('な')):
            out[i] = {'s': 'の' + out[i + 1]['s'], 'r': 'の' + out[i + 1]['r'], 'pos': '助詞', 'm': out[i]['m'] + out[i + 1]['m']}
            del out[i + 1]
        i += 1
    # mots écrits en plusieurs morceaux : katakana collés (オン ライン), expressions figées
    kata = lambda t: all('ァ' <= c <= 'ヺ' or c == 'ー' for c in t)
    i = 0
    while i < len(out) - 1:
        a, b = out[i], out[i + 1]
        if kata(a['s']) and kata(b['s']) and a['pos'] == b['pos'] == '名詞':
            out[i] = {'s': a['s'] + b['s'], 'r': a['r'] + b['r'], 'pos': '名詞', 'm': a['m'] + b['m']}; del out[i + 1]; continue
        for seq in MERGE:
            if [x['s'] for x in out[i:i + len(seq)]] == list(seq):
                out[i] = {'s': ''.join(seq), 'r': ''.join(x['r'] for x in out[i:i + len(seq)]), 'pos': '名詞', 'm': sum((x['m'] for x in out[i:i + len(seq)]), [])}
                del out[i + 1:i + len(seq)]
                break
        i += 1
    return out
if __name__ == '__main__':
    for jp in sys.argv[1:]: print(' '.join(u['r'] for u in units(jp)), '|', ' / '.join(u['s'] for u in units(jp)))
