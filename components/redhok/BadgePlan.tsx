import { cn } from '@/lib/utils'

interface Props {
    plan: string
    className?: string
}

const STYLES: Record<string, string> = {
    starter:    'bg-slate-100 text-slate-700 border-slate-200',
    pro:        'bg-amber-100 text-amber-700 border-amber-200',
    enterprise: 'bg-purple-100 text-purple-700 border-purple-200',
}

const LABELS: Record<string, string> = {
    starter:    'Starter',
    pro:        'Pro',
    enterprise: 'Enterprise',
}

export default function BadgePlan({ plan, className }: Props) {
    return (
        <span
            className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
                STYLES[plan] ?? 'bg-muted text-muted-foreground border-border',
                className
            )}
        >
      {LABELS[plan] ?? plan}
    </span>
    )
}