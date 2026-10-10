const variants = {
  primary: 'bg-ink text-cream hover:bg-brass focus-visible:outline-ink disabled:opacity-60',
  secondary: 'bg-white text-ink border border-line hover:bg-sand focus-visible:outline-sage-dark',
  ghost: 'text-ink hover:bg-sand focus-visible:outline-sage-dark',
}

export default function Button({ variant = 'primary', className = '', as: Tag = 'button', type = 'button', ...props }) {
  return (
    <Tag
      className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...(Tag === 'button' ? { type, ...props } : props)}
    />
  )
}
