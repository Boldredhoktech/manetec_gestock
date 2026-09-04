'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    creerCategorieDepense,
    modifierCategorieDepense,
    basculerCategorieDepense,
} from '@/actions/comptabilite'
import { Button } from '@/components/ui/button'
import { Loader2, Tags, Pencil, Check, X, EyeOff, RotateCcw } from 'lucide-react'

interface Categorie { id: string; nom: string; est_actif: boolean }
interface Props { categories: Categorie[] }

export default function GestionCategoriesDepense({ categories }: Props) {
    const router = useRouter()

    const [erreur, setErreur]       = useState('')
    const [enAttente, setEnAttente] = useState(false)
    const [editionId, setEditionId] = useState<string | null>(null)
    const [nomEdite, setNomEdite]   = useState('')
    const [nouveau, setNouveau]     = useState('')

    const actives  = categories.filter(c => c.est_actif)
    const retirees = categories.filter(c => !c.est_actif)

    async function lancer(action: () => Promise<{ erreur?: string } | undefined>) {
        setEnAttente(true)
        setErreur('')
        const res = await action()
        setEnAttente(false)
        if (res?.erreur) { setErreur(res.erreur); return false }
        router.refresh()
        return true
    }

    async function ajouter(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const ok = await lancer(() => creerCategorieDepense(formData))
        if (ok) setNouveau('')
    }

    async function renommer(id: string) {
        const ok = await lancer(() => modifierCategorieDepense(id, nomEdite))
        if (ok) setEditionId(null)
    }

    function Puce({ c }: { c: Categorie }) {
        if (editionId === c.id) {
            return (
                <span className="inline-flex items-center gap-1 bg-background border border-input rounded-full pl-2.5 pr-1 py-0.5">
                    <input
                        autoFocus
                        value={nomEdite}
                        onChange={e => setNomEdite(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); renommer(c.id) }
                            if (e.key === 'Escape') setEditionId(null)
                        }}
                        disabled={enAttente}
                        className="bg-transparent text-xs w-28 focus:outline-none"
                    />
                    <button type="button" onClick={() => renommer(c.id)} disabled={enAttente}
                            aria-label="Enregistrer le nom"
                            className="p-1 rounded-full hover:bg-muted text-green-600">
                        <Check className="w-3 h-3" />
                    </button>
                    <button type="button" onClick={() => setEditionId(null)} disabled={enAttente}
                            aria-label="Abandonner"
                            className="p-1 rounded-full hover:bg-muted text-muted-foreground">
                        <X className="w-3 h-3" />
                    </button>
                </span>
            )
        }

        return (
            <span className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium ${
                c.est_actif
                    ? 'bg-muted text-foreground'
                    : 'bg-transparent border border-dashed border-border text-muted-foreground'
            }`}>
                <Tags className="w-3 h-3" />
                {c.nom}
                <button type="button" disabled={enAttente}
                        onClick={() => { setEditionId(c.id); setNomEdite(c.nom) }}
                        aria-label={`Renommer ${c.nom}`}
                        className="p-1 rounded-full hover:bg-background/70 text-muted-foreground">
                    <Pencil className="w-3 h-3" />
                </button>
                <button type="button" disabled={enAttente}
                        onClick={() => lancer(() => basculerCategorieDepense(c.id, !c.est_actif))}
                        aria-label={c.est_actif ? `Retirer ${c.nom}` : `Remettre ${c.nom}`}
                        title={c.est_actif ? 'Retirer de la saisie' : 'Remettre en service'}
                        className="p-1 rounded-full hover:bg-background/70 text-muted-foreground">
                    {c.est_actif ? <EyeOff className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
                </button>
            </span>
        )
    }

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Catégories de dépenses</h2>

            {actives.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {actives.map(c => <Puce key={c.id} c={c} />)}
                </div>
            )}

            {retirees.length > 0 && (
                <div className="space-y-1.5 pt-1">
                    <p className="text-xs text-muted-foreground">
                        Retirées de la saisie — elles restent lisibles sur les dépenses passées.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {retirees.map(c => <Puce key={c.id} c={c} />)}
                    </div>
                </div>
            )}

            <form onSubmit={ajouter} className="flex gap-2 pt-1">
                <input name="nom" type="text" placeholder="Nouvelle catégorie"
                       value={nouveau} onChange={e => setNouveau(e.target.value)}
                       disabled={enAttente} required
                       className="flex-1 px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                <Button type="submit" size="sm" disabled={enAttente}>
                    {enAttente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ajouter'}
                </Button>
            </form>

            {erreur && <p className="text-xs text-destructive">{erreur}</p>}
        </div>
    )
}
