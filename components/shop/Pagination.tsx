'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Pagination partagée. Elle annonce toujours combien il y a en tout :
// une liste tronquée sans le dire laisse croire qu'on voit tout.
export default function Pagination({
    total, page, parPage, libelle,
}: {
    total:   number
    page:    number
    parPage: number
    /** Nom de ce qu'on compte, au pluriel : « clients », « factures ». */
    libelle: string
}) {
    const pathname     = usePathname()
    const searchParams = useSearchParams()

    const nbPages = Math.max(1, Math.ceil(total / parPage))
    const premier = total === 0 ? 0 : (page - 1) * parPage + 1
    const dernier = Math.min(page * parPage, total)

    function lien(p: number) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', String(p))
        return `${pathname}?${params.toString()}`
    }

    const classeBouton = 'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-input rounded-lg transition-colors'

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
                {total === 0
                    ? `Aucun ${libelle.replace(/s$/, '')}`
                    : `${libelle.charAt(0).toUpperCase()}${libelle.slice(1)} ${premier} à ${dernier} sur ${total}`}
            </p>

            {nbPages > 1 && (
                <div className="flex items-center gap-2">
                    {page > 1 ? (
                        <Link href={lien(page - 1)} className={`${classeBouton} hover:bg-muted`}>
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Précédent
                        </Link>
                    ) : (
                        <span className={`${classeBouton} opacity-40`}>
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Précédent
                        </span>
                    )}

                    <span className="text-xs text-muted-foreground tabular-nums">
                        Page {page} / {nbPages}
                    </span>

                    {page < nbPages ? (
                        <Link href={lien(page + 1)} className={`${classeBouton} hover:bg-muted`}>
                            Suivant
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    ) : (
                        <span className={`${classeBouton} opacity-40`}>
                            Suivant
                            <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}
