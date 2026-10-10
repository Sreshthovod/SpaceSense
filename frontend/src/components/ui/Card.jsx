export default function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}
