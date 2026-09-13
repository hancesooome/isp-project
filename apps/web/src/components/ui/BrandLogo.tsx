import conekBlack from '../../img/conek-black.png'
import conekWhite from '../../img/conek-white.png'
import conekIcon from '../../img/icon.png'

interface BrandLogoProps {
  className?: string
  iconOnly?: boolean
  inverse?: boolean
}

export function BrandLogo({ className = '', iconOnly = false, inverse = false }: BrandLogoProps) {
  return (
    <img
      alt={iconOnly ? 'Conek' : 'Conek ISP Management System'}
      className={`block object-contain ${className}`}
      src={iconOnly ? conekIcon : inverse ? conekWhite : conekBlack}
    />
  )
}
