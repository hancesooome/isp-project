interface LoadingSpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingSpinner({
  className = '',
  size = 'sm',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'size-4',
    md: 'size-5',
    lg: 'size-6',
  }

  return <LoaderCircle aria-hidden="true" className={`animate-spin motion-reduce:animate-none ${sizeClasses[size]} ${className}`} />
}
import { LoaderCircle } from 'lucide-react'
