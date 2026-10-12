export default function Card({ className = '', spotlight = false, children, ...props }) {
  return (
    <div className={`${spotlight ? 'spotlight ' : ''}rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}
