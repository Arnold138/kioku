# Kioku 記憶

Flashcards de japonais avec **répétition espacée** (comme Anki), une interface épurée, une progression motivante (série de jours, XP, niveaux, trophées, niveau de japonais estimé) et une **synchronisation téléphone ↔ PC**.

Application web installable (PWA), hébergée gratuitement sur **GitHub Pages**. Elle fonctionne aussi **hors ligne**.

## Nouveautés de la version 1.10 — FSRS, voix japonaise et oral

- **Nouvel algorithme de révision : FSRS** (celui d'Anki aujourd'hui). Chaque carte a une **mémoire** : combien de temps tu la retiens (stabilité) et à quel point elle te résiste (difficulté). Les cartes faciles s'espacent beaucoup plus vite, les cartes qui te résistent reviennent plus souvent : **moins de révisions inutiles**.
- **Ton historique est repris** : la mémoire de chaque carte déjà apprise est calculée à partir de son intervalle et de sa facilité actuels. Rien n'est réécrit à l'ouverture : chaque carte passe à FSRS à sa prochaine révision.
- Les règles d'avant restent : **Bien** = retenue (au moins 3 jours), **Facile** = au moins 7 jours (souvent plus : FSRS propose 16 jours pour un mot reconnu « Facile » du premier coup), **Difficile** = demi-raté (revient dans la séance, garde au moins la moitié de sa mémoire). **Oublié** fait repartir la carte plus court qu'avant : FSRS la reprogramme selon ce que tu en as vraiment retenu.
- **Mémoire visée** (Réglages → Objectifs) : 85 %, 90 % (par défaut) ou 95 %. À 85 %, les révisions sont nettement plus espacées.
- **Voix japonaise** : le mot est **lu automatiquement quand tu retournes la carte**, avec 🔊 pour réécouter. Nouvelle section *Réglages → Voix japonaise* : lecture au verso, lecture du recto, **vitesse** et **choix de la voix** (sur iPhone, les voix « améliorées » se téléchargent gratuitement).
- **Oral 🗣️** (dans *Réviser librement*) :
  - **Shadowing** : tu écoutes une phrase (ou un mot), tu **t'enregistres** en l'imitant, puis « **Modèle puis moi** » enchaîne les deux pour entendre la différence.
  - **Production orale** : tu vois le sens en français, tu **dis le mot en japonais**, le téléphone vérifie (reconnaissance vocale). S'il se trompe, « En fait, je l'ai bien dit ».
  - Comme l'écoute : **14 XP** (shadowing) ou **18 XP** (production) par réussite, combo jusqu'à ×1,6, +50 XP si 10/10. Ça ne change pas le planning des cartes.
- **Sécurité** : même format de sauvegarde (`kioku:v1`), seulement des champs optionnels ajoutés (mémoire FSRS sur les cartes, réglages de voix) ; l'historique oral est rangé dans les trophées (`o:…`), comme l'écoute. Un appareil pas encore mis à jour continue de fonctionner : si une carte y est révisée, sa mémoire FSRS est recalculée ensuite. Copie `kioku:backup:avant-v1.10` à la première ouverture.

## Nouveautés de la version 1.9.1 — Toute révision réussie compte

- **Bien** ou **Facile** en révision rend la carte **retenue**, même si elle avait été ratée avant : au moins **3 jours** (Facile : 7 jours). Avant, une carte ratée puis réussie repartait à 1-2 jours et ne comptait pas.
- **2e rattrapage** : les cartes réussies en révision mais restées à 1-2 jours (y compris celles de la v1.9) passent en retenues à l'ouverture.
- Rappel : « mots retenus » compte les **mots dans le sens japonais → français**. Les cartes « produire » et les phrases ont leurs propres compteurs.
- Copie de sécurité `kioku:backup:avant-v1.9.1` à la première ouverture.

## Nouveautés de la version 1.9 — Cartes retenues + trophées intermédiaires

- **Reconnue du premier coup = retenue** : une nouvelle carte notée **Bien** est retenue tout de suite et revient dans **3 jours** (**Facile** : 7 jours). Elle ne repasse plus par les étapes de 1 min / 10 min / 1 jour.
- **Rattrapage** : les cartes déjà réussies sans **aucun raté** mais pas encore retenues (en apprentissage, ou à 1-2 jours) passent en **retenues** à l'ouverture (3 jours après leur dernière réponse). Une seule fois, sans toucher aux cartes ratées.
- **49 trophées intermédiaires** : mots tous les 100 jusqu'à 1 000 puis tous les 250 · phrases · révisions tous les 500 jusqu'à 3 000 puis tous les 1 000 · cartes solides · séries · objectifs du jour.
- **Sécurité** : même format de sauvegarde (`kioku:v1`) ; une copie `kioku:backup:avant-v1.9` est faite à la première ouverture. Le rattrapage ne change pas la date de modification des cartes : une vraie réponse plus récente sur un autre appareil gagne toujours à la synchro.

## Nouveautés de la version 1.8 — Onglet « Révision »

- L'onglet **Aujourd'hui** s'appelle maintenant **Révision**.
- Nouvel ordre : **Objectif du jour + Défis du jour** dans un seul bloc tout en haut, puis **À étudier**, puis **Mon niveau**.
- Il ne reste que deux lignes : **Réviser librement** et **Examens**. **Écoute** et **Mes decks** sont dans *Réviser librement*, chacun dans sa page avec un retour « ‹ Réviser librement ».
- **Ajout rapide** passe dans l'onglet **Cartes** : bouton **＋** à côté du titre *Bibliothèque*.
- **Progrès** : le temps de pratique s'affiche en heures (« 12 h 30 », ou « 45 min » sous 1 h).
- **iPhone** : marge du haut agrandie et plus d'effet de rebond en haut de page.
- Aucune modification des données ni de la synchro : seulement l'interface.

## Nouveautés de la version 1.7 — « Difficile » = vague souvenir

- **Difficile** veut maintenant dire : *tu n'avais pas le mot, mais tu en avais un vague souvenir*. **Oublié** reste : *ça ne te dit rien du tout*.
- En révision, une carte « Difficile » **revient dans la séance** (10 min), puis repart à **50 % de son intervalle** (« Oublié » : 25 %).
- Elle compte comme un **raté** dans les points faibles, et pour **35 %** dans le pourcentage de cartes retenues.
- Le **combo** n'est pas cassé, mais ne monte pas.
- Les statistiques des jours passés ne sont pas recalculées. Une copie de sécurité « avant v1.7 » est gardée au premier lancement.

## Nouveautés de la version 1.6 — Récompenses

- **Écoute revalorisée** : 15 XP par bonne réponse (mots), 18 (phrases), 20 (dictée), **combo jusqu'à ×1,6**, **+50 XP** pour un 10/10. Une écoute parfaite rapporte ≈ 260 à 330 XP (contre 20 avant).
- **Combo en direct** : bonnes réponses d'affilée, en écoute comme en cartes (XP bonus sur les cartes à partir de 5 d'affilée). Un « Oublié » le remet à zéro.
- **Défis du jour** : 3 missions par jour (cartes · écoute · bonus), les mêmes sur tous tes appareils, +75 XP si les 3 sont réussies.
- **97 trophées** classés en **bronze, argent, or, platine** (20 à 150 XP), rangés par famille, dont **8 trophées secrets**.
- **Bilan d'écoute animé** : détail de l'XP (réponses, combo, sans-faute) qui défile, et tes défis du jour juste en dessous.
- Sauvegarde et synchro inchangées : tout l'historique passe par les trophées (`ach`), comme les examens. Une copie de sécurité « avant v1.6 » est gardée au premier lancement.

## Nouveautés de la version 1.5

- **Séances en manches** : au lieu de tout d'un coup, la séance est coupée en manches de 10 cartes (réglable : 5, 10, 15, 20 ou tout). Les cartes ratées reviennent dans la manche jusqu'à ce que tu les saches, puis une pause avec un petit bilan : « Continuer » ou « Arrêter pour l'instant » (le reste t'attend à la prochaine séance).
- **Astuce visible dès le recto** : un bouton « 💡 Indice » affiche ton astuce avant de retourner la carte, si tu bloques.
- **Correction** : une astuce ajoutée sur une carte encore jamais notée n'était pas gardée. C'est réglé.
- **Sécurité** : même format de sauvegarde (`kioku:v1`), un seul réglage ajouté ; une copie `kioku:backup:avant-v1.5` est faite à la première ouverture.

## Nouveautés de la version 1.4

- **Compteur de ratés** : chaque carte affiche « 🔥 raté N fois » (avant et après l'avoir retournée), y compris les ratés faits pendant l'apprentissage. Le total est dans *Progrès* et dans la fiche de chaque carte.
- **🔥 Mes points faibles**, juste sous « Commencer » : les cartes ratées 3 fois ou plus, ou ratées très récemment, jusqu'à 3 réussites d'affilée. Classées **par type** (verbes, adjectifs, noms…) et **par thème** (nourriture, météo, couleurs…), avec un bouton pour les travailler à part. Ce deck est séparé de ton « À étudier » normal.
- **Une séance ratée n'est pas perdue** : les cartes oubliées entrent automatiquement dans les points faibles, et l'écran de fin de séance les liste avec « Les revoir maintenant ».
- **L'XP compte partout** : *S'entraîner* (Réviser librement), points faibles, phrases de fin de séance, écoute et examens rapportent de l'expérience. En entraînement, un raté compte comme une vraie révision ; une réussite ne repousse pas la date de révision.
- **Phrases naturelles des vidéos** : 2 par jour (réglable) glissées dans « À étudier », choisies parmi celles dont presque tous les mots te sont déjà connus ; 3 autres à la fin de chaque séance, avec les mots que tu viens de voir (« Compris » / « À revoir » les ajoute à tes révisions).
- **Sécurité** : même format de sauvegarde (`kioku:v1`), seulement des champs optionnels ajoutés ; une copie `kioku:backup:avant-v1.4` est faite à la première ouverture.

## Nouveautés de la version 1.3

- **Quota de révisions par jour** (Réglages, 30 par défaut) : les cartes les plus difficiles passent en premier, le reste est reporté à demain. **« Encore 10 révisions »** et **« ⚡ 2 minutes »** (10 cartes) sur l'accueil.
- **Ton niveau, bien visible** : écran *Progrès* avec une feuille de route (ce que tu as atteint, ce qu'il reste à atteindre pour N5 → N3), la couverture par thème, les cartes difficiles et les **prévisions des 7 prochains jours**.
- **L'aide à la lecture s'efface** quand un mot est bien appris : le rōmaji disparaît à 21 jours d'intervalle, le kana à 60 jours (réglable dans Réglages, jamais enregistré dans la sauvegarde).
- **Mots difficiles (leeches)** : après 4 oublis, un mot est signalé ; tu peux lui écrire une **astuce mémo** et le travailler dans une séance dédiée.
- **Écoute** : *écoute → sens* et *dictée*, avec la voix du téléphone.
- **Mots en contexte** : chaque mot montre jusqu'à deux phrases. Les phrases de vidéos (japonais natif) passent d'abord, puis 364 phrases d'exemple écrites pour les mots N5 qui n'en avaient pas (`src/data/examples.json`).
- **Nouveau deck « Vidéo · Seto »** (235 phrases de la vidéo de Ken) — optionnel, à choisir dans *Réviser librement*.
- **Gestes** : glisser la carte vers la droite (je savais) ou la gauche (à revoir), désactivable.
- **Écran de fin de séance** plus clair, avec la progression des niveaux.
- **Sauvegardes** : copie automatique hebdomadaire sur l'appareil (et dans Supabase si tu exécutes `supabase/snapshots.sql`), avec **restauration** depuis Réglages.
- **Sécurité** : même format (`kioku:v1`, `v: 1`), seulement des champs optionnels ajoutés ; une copie `kioku:backup:avant-v1.3` est faite à la première ouverture.

## Nouveautés de la version 1.2

- **Réviser librement, réparé sur iPhone** : la feuille ne dépasse plus de l'écran (la hauteur s'adapte à la barre Safari), le corps défile jusqu'en bas, le bouton **Commencer** reste toujours visible et la croix **✕** permet de fermer à tout moment.
- **Phrases des deux vidéos** (272 phrases, avec kanji + hiragana + rōmaji) : deux decks « Vidéo · Shopping » et « Vidéo · Loisirs », à choisir dans *Réviser librement*. Ils **n'entrent pas** dans tes nouvelles cartes du jour : tu les révises quand tu veux, avec le planning habituel.
- **Écrire la traduction** (Réviser librement → *Façon de répondre*) : tu écris le sens en français, la carte se retourne, tu compares et tu te notes comme d'habitude. Les cartes classiques ne changent pas.
- **Accueil épuré** : l'objectif du jour est une fine barre tout en haut ; *Réviser librement*, *Examens* et *Mes decks* sont trois lignes avec une flèche (les decks s'ouvrent dans une feuille). Les « phrases avant la séance » se règlent maintenant dans Réglages.
- **Examens façon JLPT** (N5 → N1) : choix multiples, **textes à trous**, **mots à écrire** (kana, kanji ou rōmaji), phrases à remettre **dans l'ordre (★)**, lecture. *Test rapide* (≈ 12 questions) ou *Examen complet* (≈ 30 questions, 70 % pour valider). Aide à la lecture réglable (kana + rōmaji / kana / aucune), correction détaillée, « Refaire mes erreurs », XP bonus et 7 nouveaux trophées (34 au total). Tous les niveaux sont ouverts, un niveau est simplement *conseillé* d'après tes mots retenus.
- **Sécurité** : même format de sauvegarde (clé `kioku:v1`, données `v: 1`). Les résultats d'examen sont rangés dans le champ déjà existant des trophées, donc une ancienne version de l'app ne les efface pas lors de la synchro. Une deuxième copie de sécurité locale est faite à la première ouverture de la 1.2.

> Les examens sont des questions **originales** inspirées du format officiel (pas de copie des sujets JLPT) ; il n'y a pas d'épreuve d'écoute, et le seuil de 70 % est celui de l'app, pas le barème officiel.

## Nouveautés de la version 1.1

- **Accueil** : ton niveau (XP + niveau de japonais estimé) est tout en haut.
- **Réviser librement** : choisis le niveau (N5 / N4 / N3 / phrases / mes cartes), le type de mots (verbes, adjectifs, noms…), un **thème** (météo, nourriture, corps, famille, lieux…) et le nombre de cartes. Trois modes : *Réviser + découvrir*, *Découvrir du nouveau*, *S'entraîner* (cartes déjà vues, **sans toucher au planning ni à l'XP**).
- **Phrases avant la séance** : 0, 1 ou 2 phrases à traduire quand tu appuies sur « Commencer » (réglable dans Réglages).
- **Écrire les réponses** : sur les cartes de production, tape le mot en rōmaji (konnichiwa, konnichiha…) ou en kana/kanji ; l'app vérifie et te suggère « Oublié » ou « Bien ».
- **Sécurité** : la sauvegarde garde exactement le même format (clé `kioku:v1`, données `v: 1`) ; seuls deux réglages optionnels ont été ajoutés. Une copie de sécurité locale est faite automatiquement à la première ouverture (Réglages → Données → *Télécharger la copie de sécurité*).

## Ce qu'elle contient

- **1 995 mots** classés par fréquence : N5 complet (676), N4 complet (637) et les 682 mots N3 les plus fréquents.
- **158 phrases** à traduire dans la tête (salutations, quotidien, voyage, travail, oral/YouTube…) + **272 phrases de vidéos** (decks optionnels).
- Chaque carte affiche **kanji + hiragana + rōmaji** ; prononciation audio (voix japonaise du téléphone).
- **5 boutons de réponse** : Oublié · Difficile · Hésitant · Bien · Facile, avec l'intervalle affiché sur chaque bouton.
- **Deux sens** par mot : reconnaissance (JP → FR) puis production (FR → JP, débloquée quand tu reconnais le mot).
- Bouton « **Je connais déjà** » sur les nouvelles cartes, et **Ajout rapide** pour noter un mot vu en vidéo.
- Objectif quotidien, série de jours, XP, niveaux, 34 trophées, niveau estimé (N5 → N3 / A1 → B1), heatmap.
- Mode clair / sombre automatique, export/import de sauvegarde JSON.

### Comment fonctionne la révision (FSRS, comme Anki)

Depuis la v1.10, chaque carte a une **stabilité** (le nombre de jours au bout duquel tu as encore 90 % de chances de t'en souvenir) et une **difficulté** (1 à 10). La carte revient le jour où tes chances de t'en souvenir tombent à ta **mémoire visée** (90 % par défaut).

| Réponse | Effet |
|---|---|
| Nouvelle carte | étapes **1 min → 10 min** ; reconnue du premier coup : **Bien** ≥ 3 jours, **Facile** ≥ 7 jours |
| Hésitant | la stabilité augmente un peu, la carte devient plus difficile |
| Bien | la stabilité augmente (plus la carte est facile et plus tu étais près de l'oublier, plus elle augmente) · au moins 3 jours |
| Facile | grosse hausse de la stabilité, la carte devient plus facile · au moins 7 jours |
| Difficile | demi-raté : réapprentissage (10 min), la carte garde au moins la moitié de sa stabilité |
| Oublié | réapprentissage (10 min), la stabilité repart de ce que tu as retenu |

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
src/lib/fsrs.ts        formules FSRS-5 (stabilité, difficulté, intervalle)
src/lib/oral.ts        oral : choix des cartes, vérification de la réponse orale, XP
src/lib/mic.ts         micro : enregistrement et reconnaissance vocale
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
- Algorithme FSRS-5 : projet ouvert *open-spaced-repetition* (paramètres par défaut).
- Classement par fréquence : données de priorité du dictionnaire **JMdict** © EDRDG (CC BY-SA 4.0).
- Traductions françaises et phrases : rédigées pour ce projet — **relis-les et corrige-les au fil de ta progression** (une carte perso peut toujours être ajoutée ou modifiée).
- Les listes JLPT ne sont pas officielles (le JLPT ne publie pas de liste) : le niveau affiché est une estimation.
