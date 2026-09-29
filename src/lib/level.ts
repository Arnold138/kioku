// Estimation indicative du niveau de japonais à partir des mots réellement retenus.
// Repères : ≈ 800 mots N5, ≈ 1 500 mots N4 (cumulé), ≈ 3 700 mots N3 (cumulé).
// Le JLPT teste aussi la grammaire, les kanji et l'écoute : c'est une boussole, pas un diplôme.

export interface Milestone {
  id: string
  label: string
  cefr: string
  at: number // nombre de mots connus (dans le deck) pour l'atteindre
}

// Le deck contient 677 mots N5, 638 N4, 685 N3 (fréquents).
export const MILESTONES: Milestone[] = [
  { id: 'start', label: 'Débutant', cefr: 'A0', at: 0 },
  { id: 'n5', label: 'N5 en cours', cefr: 'A1', at: 150 },
  { id: 'n5ok', label: 'N5 solide', cefr: 'A1', at: 540 },
  { id: 'n4', label: 'N4 en cours', cefr: 'A2', at: 1000 },
  { id: 'n4ok', label: 'N4 solide', cefr: 'A2', at: 1190 },
  { id: 'n3', label: 'N3 en cours', cefr: 'B1', at: 1650 },
  { id: 'n3ok', label: 'N3 solide', cefr: 'B1', at: 1860 }
]

export interface LevelEstimate {
  milestone: Milestone
  next: Milestone | null
  pct: number // progression vers le prochain palier (0..1)
  known: number
}

export function estimateLevel(knownWords: number): LevelEstimate {
  let idx = 0
  MILESTONES.forEach((m, i) => {
    if (knownWords >= m.at) idx = i
  })
  const milestone = MILESTONES[idx]
  const next = MILESTONES[idx + 1] ?? null
  const pct = next ? (knownWords - milestone.at) / (next.at - milestone.at) : 1
  return { milestone, next, pct: Math.max(0, Math.min(1, pct)), known: knownWords }
}
