import type { ButtonHTMLAttributes } from 'react'

import { buttonClassName, type ButtonSize, type ButtonVariant } from './button-styles'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize
  variant?: ButtonVariant
}

export function Button({ className, size, type = 'button', variant, ...props }: ButtonProps) {
  return <button className={buttonClassName({ className, size, variant })} type={type} {...props} />
}
