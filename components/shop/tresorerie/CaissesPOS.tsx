'use client'

// Caisses POS (mig 044) : création dans la limite du forfait, et
// caissières d'une caisse (une caisse par personne).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Store, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BoutonModale, PiedFormulaire } from '@/components/ui/ModalesPartagees'
import { creerCaissePOS, affecterCaissieres } from '@/actions/tresorerie'

const champ = 'w-full px-3 py-2.5 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'

function Erreur({ texte }: { texte: string }) {
    if (!texte) return null
    return (
        <div role="alert" className="flex items-start gap-2 bg-[var(--rouge-doux)] border border-[var(--rouge-texte)]/30 text-[var(--rouge-texte)] rounded-xl px-3 py-2.5 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{texte}
        </div>
    )
}

function FormulaireCaissePOS({ entrepots, onFini }: { entrepots: { id: string; nom: string }[]; onFini: () => void }) {
    const router = useRouter()
    const [erreur, setErreur] = useState('')
    const [enAttente, demarrer] = useTransition()
    const [warehouseId, setWarehouseId] = useState(entrepots[0]?.id ?? '')
    return (
        <form className="space-y-4" action={fd => demarrer(async () => {
            setErreur('')
            const res = await creerCaissePOS(fd)
            if ('erreur' in res) { setErreur(res.erreur); return }
            router.refresh(); onFini()
        })}>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Entrepôt *</span>
                <select name="warehouseId" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={champ}>
                    {entrepots.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
                <span className="block text-xs text-muted-foreground">Les ventes de cette caisse sortent le stock de cet entrepôt.</span>
            </label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Nom de la caisse *</span>
                <input name="nom" required minLength={2} maxLength={80} className={champ}
                       defaultValue={`Caisse 2 — ${entrepots.find(e => e.id === warehouseId)?.nom ?? ''}`} key={warehouseId} />
            </label>
            <Erreur texte={erreur} />
            <PiedFormulaire>
                <Button type="submit" disabled={enAttente} className="h-11 px-5 rounded-xl font-semibold">
                    {enAttente ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer la caisse'}
                </Button>
            </PiedFormulaire>
        </form>
    )
}

export function BoutonNouvelleCaissePOS({ entrepots, utilisees, quota }: {
    entrepots: { id: string; nom: string }[]; utilisees: number; quota: number
}) {
    const illimite = quota >= 999999
    const plein = !illimite && utilisees >= quota
    if (plein) {
        return (
            <span title="Passez à un forfait supérieur pour ajouter des caisses."
                  className="h-11 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2 border border-dashed border-border text-muted-foreground">
                <Store className="w-4 h-4" aria-hidden="true" />Caisses POS : {utilisees}/{quota} (forfait)
            </span>
        )
    }
    return (
        <BoutonModale libelle="Nouvelle caisse POS" icone={Store} titre="Nouvelle caisse POS" taille="sm"
                      description={illimite ? 'Caisses illimitées avec votre forfait.' : `${utilisees} sur ${quota} caisses POS de votre forfait.`}>
            {fermer => <FormulaireCaissePOS entrepots={entrepots} onFini={fermer} />}
        </BoutonModale>
    )
}

function FormulaireCaissieres({ compteId, utilisateurs, onFini }: {
    compteId: string
    utilisateurs: { id: string; nom: string; role: string; caisseActuelle: string | null; ici: boolean }[]
    onFini: () => void
}) {
    const router = useRouter()
    const [coches, setCoches] = useState(new Set(utilisateurs.filter(u => u.ici).map(u => u.id)))
    const [erreur, setErreur] = useState('')
    const [enAttente, demarrer] = useTransition()
    const basculer = (id: string) => setCoches(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Une personne n&apos;a qu&apos;une caisse : la cocher ici la retire de son ancienne caisse.
                Les administrateurs choisissent leur caisse au POS.
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border">
                {utilisateurs.map(u => (
                    <li key={u.id}>
                        <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted">
                            <input type="checkbox" checked={coches.has(u.id)} onChange={() => basculer(u.id)}
                                   className="w-4 h-4 accent-[var(--primary)]" />
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm font-medium truncate">{u.nom}</span>
                                <span className="block text-xs text-muted-foreground">
                                    {u.role}{u.caisseActuelle && !u.ici ? ` · actuellement : ${u.caisseActuelle}` : ''}
                                </span>
                            </span>
                        </label>
                    </li>
                ))}
                {utilisateurs.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Aucun utilisateur actif.</li>}
            </ul>
            <Erreur texte={erreur} />
            <PiedFormulaire>
                <Button type="button" disabled={enAttente} className="h-11 px-5 rounded-xl font-semibold"
                        onClick={() => demarrer(async () => {
                            setErreur('')
                            const res = await affecterCaissieres(compteId, [...coches])
                            if ('erreur' in res) { setErreur(res.erreur); return }
                            router.refresh(); onFini()
                        })}>
                    {enAttente ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
                </Button>
            </PiedFormulaire>
        </div>
    )
}

export function BoutonCaissieres(props: { compteId: string; nomCaisse: string; utilisateurs: Parameters<typeof FormulaireCaissieres>[0]['utilisateurs'] }) {
    return (
        <BoutonModale libelle="Caissières" icone={Users} titre={`Caissières — ${props.nomCaisse}`}
                      description="Qui vend sur cette caisse.">
            {fermer => <FormulaireCaissieres compteId={props.compteId} utilisateurs={props.utilisateurs} onFini={fermer} />}
        </BoutonModale>
    )
}
