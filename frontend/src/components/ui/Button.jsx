const variants = {
  primary: 'bg-sage text-white hover:bg-sage-dark disabled:opacity-60',
  secondary: 'bg-white text-ink border border-line hover:bg-sand',
  ghost: 'text-ink hover:bg-sand',
}

export default function Button({ variant = 'primary', className = '', as: Tag = 'button', ...props }) {
  return (
    <Tag
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...(Tag === 'button' ? { type: 'button', ...props } : props)}
    />
  )
}
