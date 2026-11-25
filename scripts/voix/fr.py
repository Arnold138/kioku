"""v1.22 — Enregistre la traduction française de chaque mot, phrase et bloc avec la voix Piper « siwis » (gratuite, open source).

Usage : python3 scripts/voix/fr.py <modele.onnx> [textes.json]
Les fichiers vont dans public/fr/<clé>.m4a ; la clé est calculée comme dans src/lib/frvoice.ts.
"""
import json, os, subprocess, sys, tempfile, wave

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'public', 'fr')


def key(text: str) -> str:
    """FNV-1a 32 bits sur les unités UTF-16 (identique au code de l'app) + longueur."""
    t = text.strip()
    h = 0x811C9DC5
    b = t.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f'{h:08x}{len(t) & 0xFF:02x}'


def texts():
    d = lambda f: json.load(open(os.path.join(ROOT, 'src', 'data', f)))
    out = [w['fr'] for w in d('words.json')] + [s['fr'] for s in d('sentences.json')]
    p = os.path.join(ROOT, 'src', 'data', 'chunks.json')
    if os.path.exists(p):
        out += [c['fr'] for c in json.load(open(p))]
    return sorted({t.strip() for t in out if t.strip()})


def main():
    from piper import PiperVoice
    voice = PiperVoice.load(sys.argv[1])
    os.makedirs(OUT, exist_ok=True)
    todo = [t for t in texts() if not os.path.exists(os.path.join(OUT, key(t) + '.m4a'))]
    print(len(todo), 'à enregistrer', flush=True)
    with tempfile.TemporaryDirectory() as tmp:
        for n, t in enumerate(todo):
            wav = os.path.join(tmp, 'a.wav')
            with wave.open(wav, 'wb') as w:
                voice.synthesize_wav(t, w)
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-c:a', 'aac', '-b:a', '32k',
                            os.path.join(OUT, key(t) + '.m4a')], check=True)
            if n % 200 == 0:
                print(n, flush=True)


if __name__ == '__main__':
    main()
