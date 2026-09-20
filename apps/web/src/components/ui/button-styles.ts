export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger'
export type ButtonSize = 'md' | 'lg'

interface ButtonStyleOptions {
  className?: string
  size?: ButtonSize
  variant?: ButtonVariant
}

export function buttonClassName({
  className = '',
  size = 'md',
  variant = 'primary',
}: ButtonStyleOptions = {}) {
  const sizes = {
    md: 'min-h-11 px-4 text-sm',
    lg: 'min-h-12 px-5 text-sm',
  }
  const variants = {
    primary: 'public-primary-button text-white shadow-lg shadow-blue-950/10 hover:brightness-110',
    secondary: 'border border-slate-900/12 bg-white text-slate-900 shadow-sm hover:border-slate-900/20 hover:bg-slate-50',
    tertiary: 'text-slate-700 hover:bg-slate-900/5 hover:text-slate-950',
    danger: 'border border-red-300 bg-white text-red-800 hover:bg-red-50',
  }

  return `inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${sizes[size]} ${variants[variant]} ${className}`
}
