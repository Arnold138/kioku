import type { AppState, Progress } from './state'

export interface AchStats {
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
}

export interface Achievement {
  id: string
  name: string
  desc: string
  emoji: string
  test: (s: AchStats) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: 'Premier pas', desc: 'Répondre à ta première carte', emoji: '👣', test: (s) => s.reviews >= 1 },
  { id: 'r50', name: 'Échauffement', desc: '50 cartes révisées', emoji: '🔥', test: (s) => s.reviews >= 50 },
  { id: 'r250', name: 'En rythme', desc: '250 cartes révisées', emoji: '🥁', test: (s) => s.reviews >= 250 },
  { id: 'r1000', name: 'Marathonien', desc: '1 000 cartes révisées', emoji: '🏃', test: (s) => s.reviews >= 1000 },
  { id: 'r5000', name: 'Infatigable', desc: '5 000 cartes révisées', emoji: '🚀', test: (s) => s.reviews >= 5000 },
  { id: 'k10', name: 'Dix mots', desc: '10 mots retenus', emoji: '🌱', test: (s) => s.known >= 10 },
  { id: 'k50', name: 'Cinquante mots', desc: '50 mots retenus', emoji: '🌿', test: (s) => s.known >= 50 },
  { id: 'k150', name: 'Vocabulaire vivant', desc: '150 mots retenus', emoji: '🍀', test: (s) => s.known >= 150 },
  { id: 'k500', name: 'Cinq cents', desc: '500 mots retenus', emoji: '🌳', test: (s) => s.known >= 500 },
  { id: 'k1000', name: 'Mille mots', desc: '1 000 mots retenus', emoji: '🏔️', test: (s) => s.known >= 1000 },
  { id: 'k2000', name: 'Deux mille', desc: '2 000 mots retenus', emoji: '🗻', test: (s) => s.known >= 2000 },
  { id: 's3', name: 'Série de 3', desc: '3 jours d\'affilée', emoji: '⚡', test: (s) => s.bestStreak >= 3 },
  { id: 's7', name: 'Une semaine', desc: '7 jours d\'affilée', emoji: '📅', test: (s) => s.bestStreak >= 7 },
  { id: 's14', name: 'Quinzaine', desc: '14 jours d\'affilée', emoji: '🌙', test: (s) => s.bestStreak >= 14 },
  { id: 's30', name: 'Un mois', desc: '30 jours d\'affilée', emoji: '🏮', test: (s) => s.bestStreak >= 30 },
  { id: 's100', name: 'Centenaire', desc: '100 jours d\'affilée', emoji: '👑', test: (s) => s.bestStreak >= 100 },
  { id: 'l5', name: 'Niveau 5', desc: 'Atteindre le niveau 5', emoji: '⭐', test: (s) => s.level >= 5 },
  { id: 'l10', name: 'Niveau 10', desc: 'Atteindre le niveau 10', emoji: '🌟', test: (s) => s.level >= 10 },
  { id: 'l20', name: 'Niveau 20', desc: 'Atteindre le niveau 20', emoji: '💫', test: (s) => s.level >= 20 },
  { id: 'sent10', name: 'Bavard', desc: '10 phrases retenues', emoji: '💬', test: (s) => s.sentences >= 10 },
  { id: 'sent50', name: 'Conteur', desc: '50 phrases retenues', emoji: '🗣️', test: (s) => s.sentences >= 50 },
  { id: 'mature25', name: 'Mémoire longue', desc: '25 cartes à plus de 21 jours', emoji: '🧠', test: (s) => s.mature >= 25 },
  { id: 'perfect', name: 'Sans faute', desc: 'Session de 10+ cartes sans oubli', emoji: '🎯', test: (s) => s.perfectSessions >= 1 },
  { id: 'custom1', name: 'Curieux d\'immersion', desc: 'Ajouter une carte perso', emoji: '📺', test: (s) => s.custom >= 1 },
  { id: 'custom20', name: 'Chasseur de mots', desc: '20 cartes perso', emoji: '🏹', test: (s) => s.custom >= 20 },
  { id: 'early', name: 'Lève-tôt', desc: 'Réviser avant 8 h', emoji: '🌅', test: (s) => s.hour >= 5 && s.hour < 8 },
  { id: 'night', name: 'Oiseau de nuit', desc: 'Réviser après 22 h', emoji: '🦉', test: (s) => s.hour >= 22 || s.hour < 4 }
]

export function newlyUnlocked(state: AppState, stats: AchStats): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !state.ach[a.id] && a.test(stats))
}

export function buildStats(
  s: { reviews: number; level: number; xp: number; streak: number; bestStreak: number; perfectSessions: number; hour: number },
  p: Progress
): AchStats {
  return {
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
    hour: s.hour
  }
}
