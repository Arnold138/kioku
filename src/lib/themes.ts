import themesJson from '../data/themes.json'

/** Thèmes de vocabulaire : un mot peut appartenir à plusieurs thèmes. Les listes sont dans src/data/themes.json
 *  (numéros de mots) — modifiables à la main sans toucher à la sauvegarde. */
export const THEMES: Array<{ id: string; label: string; emoji: string }> = [
  { id: 'meteo', label: 'Météo & nature', emoji: '🌦️' },
  { id: 'nourriture', label: 'Nourriture & boissons', emoji: '🍜' },
  { id: 'corps', label: 'Corps & santé', emoji: '🫀' },
  { id: 'famille', label: 'Famille & personnes', emoji: '👨‍👩‍👧' },
  { id: 'temps', label: 'Temps & calendrier', emoji: '🗓️' },
  { id: 'nombres', label: 'Nombres & quantités', emoji: '🔢' },
  { id: 'lieux', label: 'Lieux & transports', emoji: '🚉' },
  { id: 'maison', label: 'Maison & objets', emoji: '🏠' },
  { id: 'ecole_travail', label: 'École, travail & argent', emoji: '💼' },
  { id: 'vetements', label: 'Vêtements & couleurs', emoji: '👕' },
  { id: 'animaux', label: 'Animaux', emoji: '🐈' },
  { id: 'emotions', label: 'Émotions & caractère', emoji: '😊' },
  { id: 'loisirs', label: 'Loisirs & culture', emoji: '🎸' },
  { id: 'tech', label: 'Communication', emoji: '💬' }
]

const SETS: Record<string, Set<string>> = {}
for (const [k, ids] of Object.entries(themesJson as Record<string, number[]>)) SETS[k] = new Set(ids.map((i) => 'w' + i))

export const inTheme = (itemId: string, theme: string): boolean => SETS[theme]?.has(itemId) ?? false
