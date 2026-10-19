import type { AppState, Progress } from './state'
import type { RewardStats } from './rewards'

export interface AchStats extends RewardStats {
  reviews: number
  known: number
  streak: number
  bestStreak: number
  level: number
  xp: number
  sentences: number
  custom: number
  mature: number
  perfectSessions: number
  hour: number
  /** v1.6 : minute, jour du mois (1-31), mois (1-12), jour de la semaine (0 = dimanche) — pour les trophées secrets */
  minute: number
  date: number
  month: number
  weekday: number
  /** examens terminés (tous modes) */
  exams: number
  /** niveaux dont l'examen complet est réussi (≥ 70 %) */
  examsPassed: string[]
  examPerfect: boolean
}

/** Rang d'un trophée : il rapporte plus d'XP et brille davantage. */
export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum'
export const TIERS: Record<Tier, { label: string; xp: number; medal: string }> = {
  bronze: { label: 'Bronze', xp: 20, medal: '🥉' },
  silver: { label: 'Argent', xp: 40, medal: '🥈' },
  gold: { label: 'Or', xp: 80, medal: '🥇' },
  platinum: { label: 'Platine', xp: 150, medal: '💎' }
}

export interface Family {
  id: string
  name: string
}
export const FAMILIES: Family[] = [
  { id: 'reviews', name: 'Révisions' },
  { id: 'words', name: 'Vocabulaire' },
  { id: 'listen', name: 'Écoute' },
  { id: 'combo', name: 'Combos' },
  { id: 'quests', name: 'Défis du jour' },
  { id: 'streak', name: 'Séries' },
  { id: 'regular', name: 'Régularité' },
  { id: 'level', name: 'Niveaux' },
  { id: 'exam', name: 'Examens' },
  { id: 'misc', name: 'Moments' },
  { id: 'secret', name: 'Secrets' }
]

export interface Achievement {
  id: string
  name: string
  desc: string
  emoji: string
  tier: Tier
  family: string
  /** caché tant qu'il n'est pas débloqué */
  secret?: boolean
  test: (s: AchStats) => boolean
}

type Def = Omit<Achievement, 'family'>
const fam = (family: string, list: Def[]): Achievement[] => list.map((a) => ({ ...a, family }))

// ⚠️ Ne jamais changer l'`id` d'un trophée existant : c'est lui qui est enregistré dans ta sauvegarde.
export const ACHIEVEMENTS: Achievement[] = [
  ...fam('reviews', [
    { id: 'first', name: 'Premier pas', desc: 'Répondre à ta première carte', emoji: '👣', tier: 'bronze', test: (s) => s.reviews >= 1 },
    { id: 'r50', name: 'Échauffement', desc: '50 cartes révisées', emoji: '🔥', tier: 'bronze', test: (s) => s.reviews >= 50 },
    { id: 'r100', name: 'Centaine', desc: '100 cartes révisées', emoji: '💯', tier: 'bronze', test: (s) => s.reviews >= 100 },
    { id: 'r250', name: 'En rythme', desc: '250 cartes révisées', emoji: '🥁', tier: 'silver', test: (s) => s.reviews >= 250 },
    { id: 'r500', name: 'Bon rythme', desc: '500 cartes révisées', emoji: '🎵', tier: 'silver', test: (s) => s.reviews >= 500 },
    { id: 'r1000', name: 'Marathonien', desc: '1 000 cartes révisées', emoji: '🏃', tier: 'gold', test: (s) => s.reviews >= 1000 },
    { id: 'r1500', name: 'Endurant', desc: '1 500 cartes révisées', emoji: '🚴', tier: 'gold', test: (s) => s.reviews >= 1500 },
    { id: 'r2000', name: 'Deux mille cartes', desc: '2 000 cartes révisées', emoji: '🏊', tier: 'gold', test: (s) => s.reviews >= 2000 },
    { id: 'r2500', name: 'Moulin à cartes', desc: '2 500 cartes révisées', emoji: '🎡', tier: 'gold', test: (s) => s.reviews >= 2500 },
    { id: 'r3000', name: 'Trois mille cartes', desc: '3 000 cartes révisées', emoji: '⛵', tier: 'gold', test: (s) => s.reviews >= 3000 },
    { id: 'r4000', name: 'Quatre mille cartes', desc: '4 000 cartes révisées', emoji: '🚂', tier: 'gold', test: (s) => s.reviews >= 4000 },
    { id: 'r5000', name: 'Infatigable', desc: '5 000 cartes révisées', emoji: '🚀', tier: 'platinum', test: (s) => s.reviews >= 5000 },
    { id: 'r6000', name: 'Six mille cartes', desc: '6 000 cartes révisées', emoji: '🛸', tier: 'platinum', test: (s) => s.reviews >= 6000 },
    { id: 'r7000', name: 'Sept mille cartes', desc: '7 000 cartes révisées', emoji: '🌋', tier: 'platinum', test: (s) => s.reviews >= 7000 },
    { id: 'r8000', name: 'Huit mille cartes', desc: '8 000 cartes révisées', emoji: '🌊', tier: 'platinum', test: (s) => s.reviews >= 8000 },
    { id: 'r9000', name: 'Neuf mille cartes', desc: '9 000 cartes révisées', emoji: '⚡', tier: 'platinum', test: (s) => s.reviews >= 9000 },
    { id: 'r10000', name: 'Légende', desc: '10 000 cartes révisées', emoji: '🐉', tier: 'platinum', test: (s) => s.reviews >= 10000 },
    { id: 'r12000', name: 'Douze mille cartes', desc: '12 000 cartes révisées', emoji: '🌠', tier: 'platinum', test: (s) => s.reviews >= 12000 },
    { id: 'r15000', name: 'Quinze mille cartes', desc: '15 000 cartes révisées', emoji: '🏯', tier: 'platinum', test: (s) => s.reviews >= 15000 },
    { id: 'r20000', name: 'Vingt mille cartes', desc: '20 000 cartes révisées', emoji: '🐲', tier: 'platinum', test: (s) => s.reviews >= 20000 },
    { id: 'perfect', name: 'Sans faute', desc: 'Session de 10+ cartes sans oubli', emoji: '🎯', tier: 'silver', test: (s) => s.perfectSessions >= 1 },
    { id: 'mature25', name: 'Mémoire longue', desc: '25 cartes à plus de 21 jours', emoji: '🧠', tier: 'bronze', test: (s) => s.mature >= 25 },
    { id: 'mature50', name: 'Racines', desc: '50 cartes à plus de 21 jours', emoji: '🪵', tier: 'bronze', test: (s) => s.mature >= 50 },
    { id: 'mature100', name: 'Mémoire d\'éléphant', desc: '100 cartes à plus de 21 jours', emoji: '🐘', tier: 'silver', test: (s) => s.mature >= 100 },
    { id: 'mature200', name: 'Mémoire solide', desc: '200 cartes à plus de 21 jours', emoji: '🧱', tier: 'silver', test: (s) => s.mature >= 200 },
    { id: 'mature300', name: 'Gravé dans le marbre', desc: '300 cartes à plus de 21 jours', emoji: '🗿', tier: 'gold', test: (s) => s.mature >= 300 },
    { id: 'mature500', name: 'Coffre-fort', desc: '500 cartes à plus de 21 jours', emoji: '🔐', tier: 'gold', test: (s) => s.mature >= 500 },
    { id: 'mature750', name: 'Archives', desc: '750 cartes à plus de 21 jours', emoji: '🗄️', tier: 'gold', test: (s) => s.mature >= 750 },
    { id: 'mature1000', name: 'Bibliothèque vivante', desc: '1 000 cartes à plus de 21 jours', emoji: '📜', tier: 'platinum', test: (s) => s.mature >= 1000 }
  ]),
  ...fam('words', [
    { id: 'k10', name: 'Dix mots', desc: '10 mots retenus', emoji: '🌱', tier: 'bronze', test: (s) => s.known >= 10 },
    { id: 'k50', name: 'Cinquante mots', desc: '50 mots retenus', emoji: '🌿', tier: 'bronze', test: (s) => s.known >= 50 },
    { id: 'k100', name: 'Cent mots', desc: '100 mots retenus', emoji: '🌻', tier: 'bronze', test: (s) => s.known >= 100 },
    { id: 'k150', name: 'Vocabulaire vivant', desc: '150 mots retenus', emoji: '🍀', tier: 'silver', test: (s) => s.known >= 150 },
    { id: 'k200', name: 'Deux cents', desc: '200 mots retenus', emoji: '🌷', tier: 'silver', test: (s) => s.known >= 200 },
    { id: 'k300', name: 'Trois cents', desc: '300 mots retenus', emoji: '🌾', tier: 'silver', test: (s) => s.known >= 300 },
    { id: 'k400', name: 'Quatre cents', desc: '400 mots retenus', emoji: '🪴', tier: 'silver', test: (s) => s.known >= 400 },
    { id: 'k500', name: 'Cinq cents', desc: '500 mots retenus', emoji: '🌳', tier: 'gold', test: (s) => s.known >= 500 },
    { id: 'k600', name: 'Six cents', desc: '600 mots retenus', emoji: '🍁', tier: 'gold', test: (s) => s.known >= 600 },
    { id: 'k700', name: 'Sept cents', desc: '700 mots retenus', emoji: '🍂', tier: 'gold', test: (s) => s.known >= 700 },
    { id: 'k750', name: 'Forêt de mots', desc: '750 mots retenus', emoji: '🌲', tier: 'gold', test: (s) => s.known >= 750 },
    { id: 'k800', name: 'Huit cents', desc: '800 mots retenus', emoji: '🌴', tier: 'gold', test: (s) => s.known >= 800 },
    { id: 'k900', name: 'Neuf cents', desc: '900 mots retenus', emoji: '🌵', tier: 'gold', test: (s) => s.known >= 900 },
    { id: 'k1000', name: 'Mille mots', desc: '1 000 mots retenus', emoji: '🏔️', tier: 'gold', test: (s) => s.known >= 1000 },
    { id: 'k1250', name: 'Mille deux cent cinquante', desc: '1 250 mots retenus', emoji: '⛰️', tier: 'gold', test: (s) => s.known >= 1250 },
    { id: 'k1500', name: 'Mille cinq cents', desc: '1 500 mots retenus', emoji: '🏕️', tier: 'platinum', test: (s) => s.known >= 1500 },
    { id: 'k1750', name: 'Mille sept cent cinquante', desc: '1 750 mots retenus', emoji: '🏞️', tier: 'platinum', test: (s) => s.known >= 1750 },
    { id: 'k2000', name: 'Deux mille', desc: '2 000 mots retenus', emoji: '🗻', tier: 'platinum', test: (s) => s.known >= 2000 },
    { id: 'sent10', name: 'Bavard', desc: '10 phrases retenues', emoji: '💬', tier: 'bronze', test: (s) => s.sentences >= 10 },
    { id: 'sent25', name: 'Bavardage', desc: '25 phrases retenues', emoji: '🗨️', tier: 'bronze', test: (s) => s.sentences >= 25 },
    { id: 'sent50', name: 'Conteur', desc: '50 phrases retenues', emoji: '🗣️', tier: 'silver', test: (s) => s.sentences >= 50 },
    { id: 'sent75', name: 'Causeur', desc: '75 phrases retenues', emoji: '📣', tier: 'silver', test: (s) => s.sentences >= 75 },
    { id: 'sent100', name: 'Orateur', desc: '100 phrases retenues', emoji: '🎙️', tier: 'gold', test: (s) => s.sentences >= 100 },
    { id: 'sent150', name: 'Cent cinquante phrases', desc: '150 phrases retenues', emoji: '📖', tier: 'gold', test: (s) => s.sentences >= 150 },
    { id: 'sent200', name: 'Deux cents phrases', desc: '200 phrases retenues', emoji: '📚', tier: 'gold', test: (s) => s.sentences >= 200 },
    { id: 'sent250', name: 'Conteur des mille nuits', desc: '250 phrases retenues', emoji: '🏮', tier: 'platinum', test: (s) => s.sentences >= 250 },
    { id: 'sent300', name: 'Trois cents phrases', desc: '300 phrases retenues', emoji: '🎭', tier: 'platinum', test: (s) => s.sentences >= 300 },
    { id: 'sent400', name: 'Quatre cents phrases', desc: '400 phrases retenues', emoji: '🎬', tier: 'platinum', test: (s) => s.sentences >= 400 },
    { id: 'sent500', name: 'Cinq cents phrases', desc: '500 phrases retenues', emoji: '🏛️', tier: 'platinum', test: (s) => s.sentences >= 500 },
    { id: 'custom1', name: 'Curieux d\'immersion', desc: 'Ajouter une carte perso', emoji: '📺', tier: 'bronze', test: (s) => s.custom >= 1 },
    { id: 'custom20', name: 'Chasseur de mots', desc: '20 cartes perso', emoji: '🏹', tier: 'silver', test: (s) => s.custom >= 20 },
    { id: 'custom100', name: 'Collectionneur', desc: '100 cartes perso', emoji: '🗃️', tier: 'gold', test: (s) => s.custom >= 100 }
  ]),
  ...fam('listen', [
    { id: 'li1', name: 'Première écoute', desc: 'Terminer une écoute', emoji: '🎧', tier: 'bronze', test: (s) => s.listens >= 1 },
    { id: 'li10', name: 'Oreille curieuse', desc: '10 écoutes terminées', emoji: '👂', tier: 'bronze', test: (s) => s.listens >= 10 },
    { id: 'li25', name: 'Oreille attentive', desc: '25 écoutes terminées', emoji: '📻', tier: 'silver', test: (s) => s.listens >= 25 },
    { id: 'li50', name: 'Oreille fine', desc: '50 écoutes terminées', emoji: '🎼', tier: 'gold', test: (s) => s.listens >= 50 },
    { id: 'li100', name: 'Oreille absolue', desc: '100 écoutes terminées', emoji: '🎹', tier: 'platinum', test: (s) => s.listens >= 100 },
    { id: 'lip1', name: 'Oreille d\'or', desc: 'Une écoute à 10/10', emoji: '✨', tier: 'bronze', test: (s) => s.listenPerfect >= 1 },
    { id: 'lip10', name: 'Dix sans faute', desc: '10 écoutes à 10/10', emoji: '🌟', tier: 'silver', test: (s) => s.listenPerfect >= 10 },
    { id: 'lip50', name: 'Virtuose', desc: '50 écoutes à 10/10', emoji: '🎻', tier: 'gold', test: (s) => s.listenPerfect >= 50 },
    { id: 'lid1', name: 'Dictée parfaite', desc: 'Une dictée à 10/10', emoji: '✍️', tier: 'silver', test: (s) => s.dicteePerfect >= 1 },
    { id: 'lid10', name: 'Plume d\'or', desc: '10 dictées à 10/10', emoji: '🖋️', tier: 'gold', test: (s) => s.dicteePerfect >= 10 },
    { id: 'lpp1', name: 'Tout compris', desc: 'Une écoute de phrases à 10/10', emoji: '💡', tier: 'silver', test: (s) => s.phrasePerfect >= 1 },
    { id: 'lok100', name: 'Cent à l\'oreille', desc: '100 bonnes réponses à l\'écoute', emoji: '🔊', tier: 'bronze', test: (s) => s.listenOk >= 100 },
    { id: 'lok500', name: 'Cinq cents à l\'oreille', desc: '500 bonnes réponses à l\'écoute', emoji: '📢', tier: 'silver', test: (s) => s.listenOk >= 500 },
    { id: 'lok2000', name: 'Radio Tokyo', desc: '2 000 bonnes réponses à l\'écoute', emoji: '📡', tier: 'platinum', test: (s) => s.listenOk >= 2000 }
  ]),
  ...fam('combo', [
    { id: 'cb10', name: 'Sur sa lancée', desc: 'Combo de 10 bonnes réponses', emoji: '🔥', tier: 'bronze', test: (s) => s.bestCombo >= 10 },
    { id: 'cb20', name: 'En feu', desc: 'Combo de 20', emoji: '☄️', tier: 'silver', test: (s) => s.bestCombo >= 20 },
    { id: 'cb30', name: 'Inarrêtable', desc: 'Combo de 30', emoji: '🌪️', tier: 'gold', test: (s) => s.bestCombo >= 30 },
    { id: 'cb50', name: 'Machine', desc: 'Combo de 50', emoji: '⚙️', tier: 'gold', test: (s) => s.bestCombo >= 50 },
    { id: 'cb100', name: 'Zone', desc: 'Combo de 100', emoji: '🌀', tier: 'platinum', test: (s) => s.bestCombo >= 100 }
  ]),
  ...fam('quests', [
    { id: 'q1', name: 'Premier défi', desc: 'Réussir un défi du jour', emoji: '🎲', tier: 'bronze', test: (s) => s.challenges >= 1 },
    { id: 'q10', name: 'Relève le défi', desc: '10 défis réussis', emoji: '🏅', tier: 'silver', test: (s) => s.challenges >= 10 },
    { id: 'q50', name: 'Chasseur de défis', desc: '50 défis réussis', emoji: '🎖️', tier: 'gold', test: (s) => s.challenges >= 50 },
    { id: 'q150', name: 'Maître des défis', desc: '150 défis réussis', emoji: '🏆', tier: 'platinum', test: (s) => s.challenges >= 150 },
    { id: 'qall1', name: 'Journée parfaite', desc: 'Les 3 défis le même jour', emoji: '🌈', tier: 'silver', test: (s) => s.challengeDays >= 1 },
    { id: 'qall10', name: 'Dix journées parfaites', desc: 'Les 3 défis, 10 jours', emoji: '🎆', tier: 'gold', test: (s) => s.challengeDays >= 10 },
    { id: 'qrun7', name: 'Semaine parfaite', desc: 'Les 3 défis, 7 jours d\'affilée', emoji: '👑', tier: 'platinum', test: (s) => s.challengeDaysRun >= 7 }
  ]),
  ...fam('streak', [
    { id: 's3', name: 'Série de 3', desc: '3 jours d\'affilée', emoji: '⚡', tier: 'bronze', test: (s) => s.bestStreak >= 3 },
    { id: 's7', name: 'Une semaine', desc: '7 jours d\'affilée', emoji: '📅', tier: 'bronze', test: (s) => s.bestStreak >= 7 },
    { id: 's14', name: 'Quinzaine', desc: '14 jours d\'affilée', emoji: '🌙', tier: 'silver', test: (s) => s.bestStreak >= 14 },
    { id: 's21', name: 'Trois semaines', desc: '21 jours d\'affilée', emoji: '🌗', tier: 'silver', test: (s) => s.bestStreak >= 21 },
    { id: 's30', name: 'Un mois', desc: '30 jours d\'affilée', emoji: '🏮', tier: 'gold', test: (s) => s.bestStreak >= 30 },
    { id: 's45', name: 'Un mois et demi', desc: '45 jours d\'affilée', emoji: '🌕', tier: 'gold', test: (s) => s.bestStreak >= 45 },
    { id: 's60', name: 'Deux mois', desc: '60 jours d\'affilée', emoji: '🎏', tier: 'gold', test: (s) => s.bestStreak >= 60 },
    { id: 's75', name: 'Soixante-quinze jours', desc: '75 jours d\'affilée', emoji: '🎐', tier: 'gold', test: (s) => s.bestStreak >= 75 },
    { id: 's90', name: 'Trois mois', desc: '90 jours d\'affilée', emoji: '🍵', tier: 'gold', test: (s) => s.bestStreak >= 90 },
    { id: 's100', name: 'Centenaire', desc: '100 jours d\'affilée', emoji: '👑', tier: 'platinum', test: (s) => s.bestStreak >= 100 },
    { id: 's150', name: 'Cent cinquante jours', desc: '150 jours d\'affilée', emoji: '🗻', tier: 'platinum', test: (s) => s.bestStreak >= 150 },
    { id: 's200', name: 'Deux cents jours', desc: '200 jours d\'affilée', emoji: '🗾', tier: 'platinum', test: (s) => s.bestStreak >= 200 },
    { id: 's250', name: 'Deux cent cinquante jours', desc: '250 jours d\'affilée', emoji: '🏔️', tier: 'platinum', test: (s) => s.bestStreak >= 250 },
    { id: 's300', name: 'Trois cents jours', desc: '300 jours d\'affilée', emoji: '🌸', tier: 'platinum', test: (s) => s.bestStreak >= 300 },
    { id: 's365', name: 'Une année', desc: '365 jours d\'affilée', emoji: '🎍', tier: 'platinum', test: (s) => s.bestStreak >= 365 },
    { id: 's500', name: 'Cinq cents jours', desc: '500 jours d\'affilée', emoji: '🐲', tier: 'platinum', test: (s) => s.bestStreak >= 500 }
  ]),
  ...fam('regular', [
    { id: 'gd10', name: 'Dix objectifs', desc: 'Objectif du jour atteint 10 fois', emoji: '✅', tier: 'bronze', test: (s) => s.goalDays >= 10 },
    { id: 'gd20', name: 'Vingt objectifs', desc: 'Objectif du jour atteint 20 fois', emoji: '☑️', tier: 'bronze', test: (s) => s.goalDays >= 20 },
    { id: 'gd30', name: 'Trente objectifs', desc: 'Objectif du jour atteint 30 fois', emoji: '📆', tier: 'silver', test: (s) => s.goalDays >= 30 },
    { id: 'gd50', name: 'Cinquante objectifs', desc: 'Objectif du jour atteint 50 fois', emoji: '📌', tier: 'silver', test: (s) => s.goalDays >= 50 },
    { id: 'gd75', name: 'Soixante-quinze objectifs', desc: 'Objectif du jour atteint 75 fois', emoji: '📍', tier: 'silver', test: (s) => s.goalDays >= 75 },
    { id: 'gd100', name: 'Cent objectifs', desc: 'Objectif du jour atteint 100 fois', emoji: '💪', tier: 'gold', test: (s) => s.goalDays >= 100 },
    { id: 'gd150', name: 'Cent cinquante objectifs', desc: 'Objectif du jour atteint 150 fois', emoji: '🎯', tier: 'gold', test: (s) => s.goalDays >= 150 },
    { id: 'gd200', name: 'Deux cents objectifs', desc: 'Objectif du jour atteint 200 fois', emoji: '🏹', tier: 'gold', test: (s) => s.goalDays >= 200 },
    { id: 'gd250', name: 'Discipline de fer', desc: 'Objectif du jour atteint 250 fois', emoji: '⛩️', tier: 'platinum', test: (s) => s.goalDays >= 250 },
    { id: 'gd365', name: 'Une année d\'objectifs', desc: 'Objectif du jour atteint 365 fois', emoji: '🎍', tier: 'platinum', test: (s) => s.goalDays >= 365 },
    { id: 'gd500', name: 'Cinq cents objectifs', desc: 'Objectif du jour atteint 500 fois', emoji: '🏆', tier: 'platinum', test: (s) => s.goalDays >= 500 },
    { id: 'day100', name: 'Grosse journée', desc: '100 cartes en un jour', emoji: '📈', tier: 'silver', test: (s) => s.bestDay >= 100 },
    { id: 'day250', name: 'Journée marathon', desc: '250 cartes en un jour', emoji: '🏋️', tier: 'gold', test: (s) => s.bestDay >= 250 },
    { id: 'weekend', name: 'Week-end studieux', desc: 'Objectif atteint samedi et dimanche', emoji: '🛋️', tier: 'silver', test: (s) => s.weekend },
    { id: 'min60', name: 'Une heure', desc: '1 h de pratique au total', emoji: '⏳', tier: 'bronze', test: (s) => s.minutes >= 60 },
    { id: 'min600', name: 'Dix heures', desc: '10 h de pratique au total', emoji: '⌛', tier: 'silver', test: (s) => s.minutes >= 600 },
    { id: 'min3000', name: 'Cinquante heures', desc: '50 h de pratique au total', emoji: '🕰️', tier: 'gold', test: (s) => s.minutes >= 3000 }
  ]),
  ...fam('level', [
    { id: 'l5', name: 'Niveau 5', desc: 'Atteindre le niveau 5', emoji: '⭐', tier: 'bronze', test: (s) => s.level >= 5 },
    { id: 'l10', name: 'Niveau 10', desc: 'Atteindre le niveau 10', emoji: '🌟', tier: 'silver', test: (s) => s.level >= 10 },
    { id: 'l15', name: 'Niveau 15', desc: 'Atteindre le niveau 15', emoji: '🌠', tier: 'silver', test: (s) => s.level >= 15 },
    { id: 'l20', name: 'Niveau 20', desc: 'Atteindre le niveau 20', emoji: '💫', tier: 'gold', test: (s) => s.level >= 20 },
    { id: 'l25', name: 'Niveau 25', desc: 'Atteindre le niveau 25', emoji: '🪐', tier: 'gold', test: (s) => s.level >= 25 },
    { id: 'l30', name: 'Niveau 30', desc: 'Atteindre le niveau 30', emoji: '☀️', tier: 'platinum', test: (s) => s.level >= 30 },
    { id: 'l40', name: 'Niveau 40', desc: 'Atteindre le niveau 40', emoji: '🌌', tier: 'platinum', test: (s) => s.level >= 40 }
  ]),
  ...fam('exam', [
    { id: 'ex1', name: 'Premier examen', desc: 'Terminer un test', emoji: '📝', tier: 'bronze', test: (s) => s.exams >= 1 },
    { id: 'ex10', name: 'Habitué des tests', desc: '10 tests terminés', emoji: '🗂️', tier: 'silver', test: (s) => s.exams >= 10 },
    { id: 'exN5', name: 'N5 validé', desc: 'Examen N5 complet à 70 % ou plus', emoji: '🌸', tier: 'bronze', test: (s) => s.examsPassed.includes('N5') },
    { id: 'exN4', name: 'N4 validé', desc: 'Examen N4 complet à 70 % ou plus', emoji: '🍃', tier: 'silver', test: (s) => s.examsPassed.includes('N4') },
    { id: 'exN3', name: 'N3 validé', desc: 'Examen N3 complet à 70 % ou plus', emoji: '🎋', tier: 'gold', test: (s) => s.examsPassed.includes('N3') },
    { id: 'exN2', name: 'N2 validé', desc: 'Examen N2 complet à 70 % ou plus', emoji: '⛩️', tier: 'platinum', test: (s) => s.examsPassed.includes('N2') },
    { id: 'exN1', name: 'N1 validé', desc: 'Examen N1 complet à 70 % ou plus', emoji: '🏯', tier: 'platinum', test: (s) => s.examsPassed.includes('N1') },
    { id: 'exPerfect', name: 'Copie parfaite', desc: '100 % à un examen', emoji: '💯', tier: 'gold', test: (s) => s.examPerfect }
  ]),
  ...fam('misc', [
    { id: 'early', name: 'Lève-tôt', desc: 'Réviser avant 8 h', emoji: '🌅', tier: 'bronze', test: (s) => s.hour >= 5 && s.hour < 8 },
    { id: 'night', name: 'Oiseau de nuit', desc: 'Réviser après 22 h', emoji: '🦉', tier: 'bronze', test: (s) => s.hour >= 22 || s.hour < 4 },
    { id: 'xp10k', name: 'Cinq chiffres', desc: '10 000 XP au total', emoji: '🔟', tier: 'gold', test: (s) => s.xp >= 10000 }
  ]),
  ...fam('secret', [
    { id: 'zMidnight', name: 'Minuit pile', desc: 'Réviser entre minuit et minuit cinq', emoji: '🕛', tier: 'gold', secret: true, test: (s) => s.hour === 0 && s.minute < 5 },
    { id: 'zTriple', name: 'Triplé', desc: '3 écoutes parfaites d\'affilée', emoji: '🎰', tier: 'gold', secret: true, test: (s) => s.listenTriple },
    { id: 'zJackpot', name: 'Jackpot', desc: '777 XP ou plus en une journée', emoji: '💰', tier: 'gold', secret: true, test: (s) => s.xpToday >= 777 },
    { id: 'zEars', name: 'Oreilles en feu', desc: '5 écoutes dans la même journée', emoji: '🌶️', tier: 'silver', secret: true, test: (s) => s.listensToday >= 5 },
    { id: 'zPhoenix', name: 'Le retour', desc: 'Reprendre après une pause d\'une semaine', emoji: '🦅', tier: 'silver', secret: true, test: (s) => s.comeback },
    { id: 'zFri13', name: 'Vendredi 13', desc: 'Réviser un vendredi 13', emoji: '🐈‍⬛', tier: 'silver', secret: true, test: (s) => s.weekday === 5 && s.date === 13 },
    { id: 'zNewYear', name: 'Bonne année', desc: 'Réviser un 1er janvier', emoji: '🎍', tier: 'gold', secret: true, test: (s) => s.month === 1 && s.date === 1 },
    { id: 'zTanabata', name: 'Tanabata', desc: 'Réviser le 7 juillet', emoji: '🎋', tier: 'silver', secret: true, test: (s) => s.month === 7 && s.date === 7 }
  ])
]

export function newlyUnlocked(state: AppState, stats: AchStats): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !state.ach[a.id] && a.test(stats))
}

export function buildStats(
  s: {
    reviews: number
    level: number
    xp: number
    streak: number
    bestStreak: number
    perfectSessions: number
    hour: number
    now?: number
    exams?: number
    examsPassed?: string[]
    examPerfect?: boolean
  },
  p: Progress,
  r: RewardStats
): AchStats {
  const d = new Date(s.now ?? Date.now())
  return {
    ...r,
    reviews: s.reviews,
    known: p.wordsKnownR,
    streak: s.streak,
    bestStreak: s.bestStreak,
    level: s.level,
    xp: s.xp,
    sentences: p.sentencesKnown,
    custom: p.customCount,
    mature: p.matureCount,
    perfectSessions: s.perfectSessions,
    hour: s.hour,
    minute: d.getMinutes(),
    date: d.getDate(),
    month: d.getMonth() + 1,
    weekday: d.getDay(),
    exams: s.exams ?? 0,
    examsPassed: s.examsPassed ?? [],
    examPerfect: !!s.examPerfect
  }
}
