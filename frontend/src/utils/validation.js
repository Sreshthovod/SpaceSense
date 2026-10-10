import { formatINR } from './format'

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_MB = 10

export const LIMITS = {
  length: [4, 60],
  width: [4, 60],
  height: [7, 15],
  budget: [10000, 5000000],
}

export function validateImage(file) {
  if (!file) return 'Please upload a photo of your room.'
  if (!IMAGE_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image.'
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `Image must be under ${MAX_IMAGE_MB} MB.`
  return ''
}

function checkNumber(value, [min, max], label, unit = '', fmt = (n) => n.toLocaleString('en-IN')) {
  if (value === '' || value == null) return `${label} is required.`
  const n = Number(value)
  if (!Number.isFinite(n)) return `${label} must be a number.`
  if (n < min || n > max) return `${label} must be between ${fmt(min)} and ${fmt(max)}${unit}.`
  return ''
}

export function validateForm(form) {
  const errors = {
    roomType: form.roomType ? '' : 'Choose a room type.',
    length: checkNumber(form.length, LIMITS.length, 'Length', ' ft'),
    width: checkNumber(form.width, LIMITS.width, 'Width', ' ft'),
    height: checkNumber(form.height, LIMITS.height, 'Height', ' ft'),
    style: form.style ? '' : 'Pick a style.',
    budget: checkNumber(form.budget, LIMITS.budget, 'Budget', '', formatINR),
  }
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v))
}
