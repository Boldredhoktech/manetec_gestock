'use client'

// ═══════════════════════════════════════════════════════════════
// Modales du nouveau design (lot 3) — trois briques :
//   • ModaleUrl      : ouverte quand l'adresse porte `?<param>` ; une
//                      action serveur qui redirige après succès la ferme
//                      d'elle-même (création, modification) ;
//   • BoutonModale   : un bouton qui ouvre une modale (actions d'une fiche) ;
//   • PiedFormulaire : les boutons d'un formulaire ; dans une modale, ils
//                      restent collés en bas, toujours visibles.
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Modale, { useDansModale } from '@/components/ui/Modale'
import { cn } from '@/lib/utils'

type Taille = 'sm' | 'md' | 'lg'

export function ModaleUrl({ param, titre, description, taille = 'md', children }: {
    param: string; titre: string; description?: string; taille?: Taille; children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const sp = useSearchParams()
    const ouvert = sp.has(param)
    function fermer() {
        const reste = new URLSearchParams(sp.toString())
        reste.delete(param)
        const q = reste.toString()
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    }
    return (
        <Modale ouvert={ouvert} onFermer={fermer} titre={titre} description={description} taille={taille}>
            {ouvert && children}
        </Modale>
    )
}

import { classeBouton, type VarianteBouton } from '@/components/ui/classe-bouton'
export { classeBouton }

export function BoutonModale({ libelle, icone: Icone, variante = 'secondaire', titre, description, taille = 'md', pleineLargeur, children }: {
    libelle: string; icone?: React.ElementType; variante?: VarianteBouton
    titre: string; description?: string; taille?: Taille; pleineLargeur?: boolean
    /** Le contenu, ou une fonction qui reçoit `fermer`. */
    children: React.ReactNode | ((fermer: () => void) => React.ReactNode)
}) {
    const [ouvert, setOuvert] = useState(false)
    const fermer = () => setOuvert(false)
    return (
        <>
            <button type="button" onClick={() => setOuvert(true)} className={cn(classeBouton(variante), pleineLargeur && 'w-full')}>
                {Icone && <Icone className="w-4 h-4" aria-hidden="true" />}{libelle}
            </button>
            <Modale ouvert={ouvert} onFermer={fermer} titre={titre} description={description} taille={taille}>
                {ouvert && (typeof children === 'function' ? children(fermer) : children)}
            </Modale>
        </>
    )
}

/** Boutons d'un formulaire : collés en bas quand le formulaire est dans une modale. */
export function PiedFormulaire({ children, className }: { children: React.ReactNode; className?: string }) {
    const dansModale = useDansModale()
    return (
        <div className={cn(
            dansModale
                ? 'sticky -bottom-5 z-10 -mx-5 sm:-mx-6 mt-5 px-5 sm:px-6 py-4 bg-[var(--surface2)] border-t border-border shadow-[0_20px_0_0_var(--surface2)] flex flex-wrap justify-end gap-2.5'
                : 'flex flex-wrap gap-2.5',
            className,
        )}>
            {children}
        </div>
    )
}
