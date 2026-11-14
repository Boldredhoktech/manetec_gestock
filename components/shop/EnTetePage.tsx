// En-tête de page du nouveau design (lot 1) : fil d'Ariane, titre,
// sous-titre et actions. Les pages refaites aux lots 2 à 5 l'utilisent.

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function EnTetePage({
    titre, sousTitre, ariane, actions,
}: {
    titre:      string
    sousTitre?: string
    /** Ex. [{ label: 'Finances' }, { label: 'Trésorerie', href: '/compta/tresorerie' }] */
    ariane?:    { label: string; href?: string }[]
    actions?:   React.ReactNode
}) {
    return (
        <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 space-y-1">
                {ariane && ariane.length > 0 && (
                    <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {ariane.map((a, i) => (
                            <span key={i} className="flex items-center gap-1">
                                {i > 0 && <ChevronRight className="w-3 h-3" aria-hidden="true" />}
                                {a.href ? <Link href={a.href} className="hover:text-foreground">{a.label}</Link> : <span>{a.label}</span>}
                            </span>
                        ))}
                    </nav>
                )}
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">{titre}</h1>
                {sousTitre && <p className="text-sm text-muted-foreground">{sousTitre}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
        </header>
    )
}
