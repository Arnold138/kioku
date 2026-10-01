# Kioku 記憶

Flashcards de japonais avec **répétition espacée** (comme Anki), une interface épurée, une progression motivante (série de jours, XP, niveaux, trophées, niveau de japonais estimé) et une **synchronisation téléphone ↔ PC**.

Application web installable (PWA), hébergée gratuitement sur **GitHub Pages**. Elle fonctionne aussi **hors ligne**.

## Nouveautés de la version 1.1

- **Accueil** : ton niveau (XP + niveau de japonais estimé) est tout en haut.
- **Réviser librement** : choisis le niveau (N5 / N4 / N3 / phrases / mes cartes), le type de mots (verbes, adjectifs, noms…), un **thème** (météo, nourriture, corps, famille, lieux…) et le nombre de cartes. Trois modes : *Réviser + découvrir*, *Découvrir du nouveau*, *S'entraîner* (cartes déjà vues, **sans toucher au planning ni à l'XP**).
- **Phrases avant la séance** : 0, 1 ou 2 phrases à traduire quand tu appuies sur « Commencer » (réglable sur l'accueil et dans Réglages).
- **Écrire les réponses** : sur les cartes de production, tape le mot en rōmaji (konnichiwa, konnichiha…) ou en kana/kanji ; l'app vérifie et te suggère « Oublié » ou « Bien ».
- **Sécurité** : la sauvegarde garde exactement le même format (clé `kioku:v1`, données `v: 1`) ; seuls deux réglages optionnels ont été ajoutés. Une copie de sécurité locale est faite automatiquement à la première ouverture (Réglages → Données → *Télécharger la copie de sécurité*).

## Ce qu'elle contient

- **1 995 mots** classés par fréquence : N5 complet (676), N4 complet (637) et les 682 mots N3 les plus fréquents.
- **158 phrases** à traduire dans la tête (salutations, quotidien, voyage, travail, oral/YouTube…).
- Chaque carte affiche **kanji + hiragana + rōmaji** ; prononciation audio (voix japonaise du téléphone).
- **5 boutons de réponse** : Oublié · Difficile · Hésitant · Bien · Facile, avec l'intervalle affiché sur chaque bouton.
- **Deux sens** par mot : reconnaissance (JP → FR) puis production (FR → JP, débloquée quand tu reconnais le mot).
- Bouton « **Je connais déjà** » sur les nouvelles cartes, et **Ajout rapide** pour noter un mot vu en vidéo.
- Objectif quotidien, série de jours, XP, niveaux, 27 trophées, niveau estimé (N5 → N3 / A1 → B1), heatmap.
- Mode clair / sombre automatique, export/import de sauvegarde JSON.

### Comment fonctionne la révision (inspiré d'Anki)

| Phase | Règle |
|---|---|
| Nouvelle carte | étapes **1 min → 10 min**, puis 1 jour (« Facile » : 4 jours directement) |
| Révision | nouvel intervalle = ancien × **facilité** (2,5 au départ) |
| Difficile | × 1,2 · facilité −0,15 |
| Hésitant | × (1 + (facilité − 1) / 2) · facilité −0,05 |
| Bien | × facilité |
| Facile | × facilité × 1,3 · facilité +0,15 |
| Oublié | réapprentissage (10 min), facilité −0,20, retour à 25 % de l'ancien intervalle |

Le « jour » change à 4 h du matin (comme Anki). Raccourcis clavier sur PC : `Espace` retourne, `1`–`5` notent, `Z` annule.

---

## Mise en ligne en 3 étapes

### Étape 1 — Créer la base de synchronisation (Supabase, gratuit, ~5 min)

1. Va sur <https://supabase.com> → **Start your project** → connecte-toi (GitHub fonctionne).
2. **New project** : nom `kioku`, choisis un mot de passe de base de données (garde-le de côté), région proche (ex. *West EU*). Attends 1–2 minutes.
3. Menu **SQL Editor** → **New query** → colle le contenu de [`supabase/schema.sql`](supabase/schema.sql) → **Run**. (Tu dois voir « Success ».)
4. Pour éviter la confirmation par e-mail : **Authentication → Providers → Email** → désactive **Confirm email** → Save.
5. Menu **Project Settings → API** : note deux valeurs
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public key** (longue clé commençant par `eyJ…`)

> La clé « anon » est faite pour être publique : la sécurité vient des règles (RLS) du script SQL, qui limitent chaque compte à ses propres données. **Ne mets jamais la clé `service_role` dans l'app.**

### Étape 2 — Mettre le code sur GitHub

1. Crée un dépôt GitHub (ex. `kioku`), public ou privé.
2. Envoie-y le contenu de ce dossier (sans `node_modules` ni `dist`) :
   ```bash
   git init && git add . && git commit -m "Kioku"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/kioku.git
   git push -u origin main
   ```
3. Dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
4. **Settings → Secrets and variables → Actions → onglet Variables → New repository variable** (deux variables) :
   - `VITE_SUPABASE_URL` = ta Project URL
   - `VITE_SUPABASE_ANON_KEY` = ta clé anon public
5. Onglet **Actions** : le workflow « Déploiement sur GitHub Pages » se lance à chaque push (relance-le avec *Run workflow* si besoin). Au bout d'environ 1 minute, ton app est sur `https://TON-PSEUDO.github.io/kioku/`.

> Si tu préfères ne pas utiliser les variables GitHub, tu peux aussi coller l'URL et la clé directement dans l'app : **Réglages → Synchronisation** (à faire sur chaque appareil).

### Étape 3 — L'installer sur ton téléphone

- **iPhone** (Safari) : ouvre l'adresse → bouton Partager → **Sur l'écran d'accueil**.
- **Android** (Chrome) : ouvre l'adresse → menu ⋮ → **Installer l'application**.

Puis dans **Réglages → Synchronisation** : *Créer un compte* (e-mail + mot de passe) sur le téléphone, et *Connexion* avec le même compte sur le PC. La progression se synchronise automatiquement (quelques secondes après chaque séance, et au retour dans l'app).

---

## Développer en local

```bash
npm install
cp .env.example .env.local   # optionnel : clés Supabase
npm run dev                  # http://localhost:5173
npm test                     # tests (répétition espacée, rōmaji, fusion de synchro…)
npm run build                # build de production dans dist/
```

## Structure

```
src/lib/scheduler.ts   moteur de répétition espacée (5 boutons)
src/lib/queue.ts       file du jour (limites, mélange nouvelles/révisions)
src/lib/state.ts       état, fusion multi-appareils, XP, séries
src/lib/sync.ts        synchronisation Supabase
src/lib/level.ts       estimation du niveau
src/lib/achievements.ts trophées
src/lib/romaji.ts      kana → rōmaji
src/data/words.json    1 995 mots · sentences.json  158 phrases · themes.json  thèmes des mots
src/components/        écrans (Accueil, Étude, Cartes, Progrès, Réglages)
```

### Comment marche la synchronisation

Chaque appareil garde tout en local (fonctionne hors ligne) et envoie/récupère un JSON dans Supabase. La fusion est sans conflit : pour chaque carte on garde la version la plus récente, les compteurs du jour sont comptés **par appareil** puis additionnés, les trophées gardent leur première date de déblocage.

## Sources et licences

- Listes de vocabulaire JLPT N5/N4/N3 : projet ouvert *jamsinclair/open-anki-jlpt-decks*.
- Classement par fréquence : données de priorité du dictionnaire **JMdict** © EDRDG (CC BY-SA 4.0).
- Traductions françaises et phrases : rédigées pour ce projet — **relis-les et corrige-les au fil de ta progression** (une carte perso peut toujours être ajoutée ou modifiée).
- Les listes JLPT ne sont pas officielles (le JLPT ne publie pas de liste) : le niveau affiché est une estimation.
