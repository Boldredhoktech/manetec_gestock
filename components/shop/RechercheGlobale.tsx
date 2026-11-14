'use client'

// Recherche globale (nouveau design, lot 1) : Ctrl+K (ou ⌘K), ou le bouton
// « Rechercher » de la barre latérale, ouvre une liste de toutes les pages
// auxquelles l'utilisateur a droit ; on tape quelques lettres, Entrée ouvre.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, CornerDownLeft } from 'lucide-react'
import Modale from '@/components/ui/Modale'
import { NAVIGATION_BOUTIQUE } from '@/lib/constants/navigation'
import { usePermission } from '@/hooks/usePermission'
import { useSessionBoutique } from '@/hooks/useSession'
import { getPlanLimites } from '@/lib/constants/plans'

export const EVENEMENT_RECHERCHE = 'manetec:recherche'

const cle = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function RechercheGlobale() {
    const router = useRouter()
    const { session } = useSessionBoutique()
    const { peutFaire } = usePermission()
    const [ouvert, setOuvert] = useState(false)
    const [terme, setTerme] = useState('')
    const [index, setIndex] = useState(0)
    const champ = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const touche = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOuvert(o => !o) }
        }
        const ouvrir = () => setOuvert(true)
        window.addEventListener('keydown', touche)
        window.addEventListener(EVENEMENT_RECHERCHE, ouvrir)
        return () => { window.removeEventListener('keydown', touche); window.removeEventListener(EVENEMENT_RECHERCHE, ouvrir) }
    }, [])

    useEffect(() => { if (ouvert) { setTerme(''); setIndex(0); setTimeout(() => champ.current?.focus(), 50) } }, [ouvert])

    const limites = getPlanLimites(session?.shop_plan ?? 'starter')
    // Recalculée à chaque rendu : les permissions arrivent après le premier.
    const pages = NAVIGATION_BOUTIQUE.flatMap(g => g.items
        .filter(i => (!i.permission || peutFaire(i.permission)) && (!i.plan || limites[i.plan]))
        .map(i => ({ ...i, groupe: g.groupe })))

    const resultats = pages.filter(p => !terme.trim() || cle(`${p.label} ${p.groupe}`).includes(cle(terme.trim()))).slice(0, 12)

    function aller(i: number) {
        const p = resultats[i]
        if (!p) return
        setOuvert(false)
        if (p.nouvelOnglet) window.open(p.href, '_blank', 'noopener'); else router.push(p.href)
    }

    if (!session) return null
    return (
        <Modale ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Aller à…" taille="md">
            <label className="flex items-center gap-2.5 h-12 px-3.5 rounded-xl border-2 border-primary bg-card">
                <Search className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <input ref={champ} value={terme} aria-label="Rechercher une page"
                       onChange={e => { setTerme(e.target.value); setIndex(0) }}
                       onKeyDown={e => {
                           if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, resultats.length - 1)) }
                           if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
                           if (e.key === 'Enter') { e.preventDefault(); aller(index) }
                       }}
                       placeholder="Produits, trésorerie, factures…"
                       className="flex-1 min-w-0 bg-transparent outline-none text-base text-foreground placeholder:text-muted-foreground" />
            </label>
            <ul role="listbox" aria-label="Pages" className="mt-3 space-y-1">
                {resultats.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune page ne correspond.</li>}
                {resultats.map((p, i) => {
                    const Icone = p.icone
                    return (
                        <li key={p.href} role="option" aria-selected={i === index}>
                            <button type="button" onMouseEnter={() => setIndex(i)} onClick={() => aller(i)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left ${i === index ? 'bg-[var(--primary-soft)] text-[var(--primary-strong)]' : 'hover:bg-muted'}`}>
                                <Icone className="w-4 h-4 shrink-0" aria-hidden="true" />
                                <span className="flex-1 font-medium text-sm">{p.label}</span>
                                <span className="text-xs text-muted-foreground">{p.groupe}</span>
                                {i === index && <CornerDownLeft className="w-3.5 h-3.5" aria-hidden="true" />}
                            </button>
                        </li>
                    )
                })}
            </ul>
        </Modale>
    )
}
