import { useState } from 'react'
import { HelpCircle } from 'lucide-react'

interface TooltipProps {
  text: string
  children?: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export function Tooltip({ text, children, side = 'top', className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  }

  const arrowClasses = {
    top: 'top-full border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-dark-600',
    bottom: 'bottom-full border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-dark-600',
    left: 'left-full border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-dark-600',
    right: 'right-full border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-dark-600',
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className={`inline-flex items-center justify-center ${className}`}
      >
        {children || <HelpCircle className="w-4 h-4 text-gray-400 hover:text-accent-green transition-colors" />}
      </button>

      {isVisible && (
        <div
          className={`absolute z-50 px-3 py-2 text-xs text-gray-200 bg-dark-600 rounded-lg whitespace-nowrap pointer-events-none ${positionClasses[side]} shadow-lg`}
        >
          {text}
          <div className={`absolute w-2 h-2 ${arrowClasses[side]}`} />
        </div>
      )}
    </div>
  )
}

export function InlineTooltip({ text, label }: { text: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span>{label}</span>
      <Tooltip text={text} />
    </div>
  )
}