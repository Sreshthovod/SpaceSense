/** Matching for the quick-action palette. */

/**
 * Scores how well `query` matches `text`: every query letter must appear in order. Consecutive letters
 * and word starts score higher. 0 = no match.
 */
export function fuzzyScore(query, text) {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const t = text.toLowerCase()
  // A whole-word or plain substring match beats letters scattered across the text.
  const at = t.indexOf(q)
  if (at !== -1) return 100 + (at === 0 || t[at - 1] === ' ' ? 30 : 0) - at * 0.1
  let score = 0
  let ti = 0
  let streak = 0
  for (const ch of q) {
    if (ch === ' ') continue
    const found = t.indexOf(ch, ti)
    if (found === -1) return 0
    streak = found === ti ? streak + 1 : 0
    score += 1 + streak * 2 + (found === 0 || t[found - 1] === ' ' ? 3 : 0)
    ti = found + 1
  }
  return score
}

export function filterCommands(commands, query) {
  if (!query.trim()) return commands
  return commands
    .map((c, i) => ({ c, i, s: Math.max(fuzzyScore(query, c.label), fuzzyScore(query, `${c.group} ${c.keywords ?? ''}`) * 0.6) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c)
}

export const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
