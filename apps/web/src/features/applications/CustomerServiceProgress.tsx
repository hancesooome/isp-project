import { Check } from 'lucide-react'

type ServiceJourneyStep = 'application' | 'installation' | 'activation'

const steps: Array<{ id: ServiceJourneyStep; label: string }> = [
  { id: 'application', label: 'Application' },
  { id: 'installation', label: 'Installation' },
  { id: 'activation', label: 'Activation' },
]

export function CustomerServiceProgress({ current }: { current: ServiceJourneyStep }) {
  const currentIndex = steps.findIndex((step) => step.id === current)

  return (
    <ol aria-label="Service setup progress" className="grid grid-cols-3" role="list">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <li aria-current={isCurrent ? 'step' : undefined} className="relative flex flex-col items-center text-center" key={step.id}>
            {index > 0 ? <span aria-hidden="true" className={`absolute top-4 right-1/2 h-px w-full ${isComplete || isCurrent ? 'bg-blue-500' : 'bg-slate-200'}`} /> : null}
            <span className={`relative z-10 flex size-8 items-center justify-center rounded-full border text-xs font-semibold ${isComplete ? 'border-blue-600 bg-blue-600 text-white' : isCurrent ? 'border-blue-600 bg-white text-blue-700 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]' : 'border-slate-300 bg-white text-slate-500'}`}>
              {isComplete ? <Check aria-hidden="true" size={15} /> : index + 1}
            </span>
            <span className={`mt-2 text-xs font-medium ${isCurrent ? 'text-slate-950' : 'text-slate-500'}`}>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
