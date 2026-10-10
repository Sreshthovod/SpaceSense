const KNOWN = ['modern-indian', 'minimalist', 'scandinavian', 'contemporary-luxury']

export function styleScene(id) {
  return KNOWN.includes(id) ? `/images/style-${id}.jpg` : '/images/after.jpg'
}

export function moodClass(mood, lighting) {
  const parts = []
  if (lighting === 'evening') parts.push('mood-evening')
  else parts.push('mood-day')
  if (mood === 'cool') parts.push('mood-cool')
  else parts.push('mood-warm')
  return parts.join(' ')
}
