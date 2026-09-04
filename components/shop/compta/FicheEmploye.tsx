'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { modifierEmploye, basculerEmploye } from '@/actions/comptabilite'
import { formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import ChampNombre from '@/components/ui/ChampNombre'
import {
    Loader2, AlertCircle, Pencil, CheckCircle, UserMinus, UserCheck, FileText,
} from 'lucide-react'
import HistoriqueCorrections, { type EntreeHistorique } from './HistoriqueCorrections'

export interface CompteBoutique {
    id:          string
    nom_complet: string
    identifiant: string
}

interface Employe {
    id:            string
    user_id:       string | null
    nom_complet:   string
    poste:         string | null
    salaire_base:  number
    telephone:     string | null
    date_embauche: string | null
    est_actif:     boolean
    desactive_le:  string | null
    created_at:    string
}

interface Versement {
    id:            string
    public_id:     string
    periode_mois:  number
    periode_annee: number
    montant_net:   number
    date_paiement: string
    est_annule:    boolean
}

const MOIS_LABELS = [
    '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export default function FicheEmploye({
    employe, versements, historique, comptes,
}: {
    employe:    Employe
    versements: Versement[]
    historique: EntreeHistorique[]
    comptes:    CompteBoutique[]
}) {
    const router = useRouter()

    const [edition, setEdition]     = useState(false)
    const [erreur, setErreur]       = useState('')
    const [message, setMessage]     = useState('')
    const [enAttente, setEnAttente] = useState(false)
    const [salaire, setSalaire]     = useState(employe.salaire_base)

    const aujourdhui = new Date().toISOString().split('T')[0]

    async function enregistrer(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setEnAttente(true)
        setErreur('')
        setMessage('')

        const formData = new FormData(e.currentTarget)
        formData.set('id', employe.id)

        const res = await modifierEmploye(formData)
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }

        setEdition(false)
        setMessage(res?.aucunChangement ? 'Aucune modification à enregistrer.' : 'Fiche modifiée.')
        router.refresh()
    }

    async function basculer() {
        setEnAttente(true)
        setErreur('')

        const res = await basculerEmploye(employe.id, !employe.est_actif)
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }

        setMessage(employe.est_actif
            ? 'Employé désactivé : il ne figure plus dans la liste de paie.'
            : 'Employé réintégré à la liste de paie.')
        router.refresh()
    }

    const totalVerse = versements
        .filter(v => !v.est_annule)
        .reduce((somme, v) => somme + v.montant_net, 0)

    return (
        <div className="space-y-5">

            {!employe.est_actif && (
                <div className="flex items-start gap-3 bg-muted border border-border rounded-lg px-4 py-3 text-sm">
                    <UserMinus className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                        <p className="font-medium text-foreground">
                            Employé désactivé{employe.desactive_le ? ` le ${formatDate(employe.desactive_le)}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Il ne figure plus dans la liste de paie. Les versements déjà faits
                            restent au rapport : désactiver range un employé sorti, cela n&apos;efface
                            pas ce qu&apos;on lui a versé.
                        </p>
                    </div>
                </div>
            )}

            {message && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-2.5 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    {message}
                </div>
            )}

            {erreur && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{erreur}</span>
                </div>
            )}

            {edition ? (
                <form onSubmit={enregistrer} className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-foreground">Modifier la fiche</h2>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Nom complet <span className="text-destructive">*</span>
                        </label>
                        <input name="nomComplet" type="text" required defaultValue={employe.nom_complet}
                               disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">Poste</label>
                            <input name="poste" type="text" defaultValue={employe.poste ?? ''}
                                   disabled={enAttente}
                                   className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">Téléphone</label>
                            <input name="telephone" type="tel" defaultValue={employe.telephone ?? ''}
                                   disabled={enAttente}
                                   className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">Salaire de base</label>
                            <ChampNombre
                                name="salaireBase" value={salaire} onChange={setSalaire}
                                disabled={enAttente}
                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-foreground">Date d&apos;embauche</label>
                            <input name="dateEmbauche" type="date" max={aujourdhui}
                                   defaultValue={employe.date_embauche ?? ''} disabled={enAttente}
                                   className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Compte utilisateur
                        </label>
                        <select name="userId" defaultValue={employe.user_id ?? ''} disabled={enAttente}
                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                            <option value="">— Aucun —</option>
                            {comptes.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.nom_complet} · {c.identifiant}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                            Relie cette fiche de paie au compte avec lequel la personne se connecte.
                            Facultatif, mais c&apos;est ce lien qui permettra plus tard de rapprocher
                            ce qu&apos;un vendeur encaisse de ce qu&apos;il coûte.
                        </p>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Changer le salaire de base ne touche à aucun versement déjà enregistré :
                        il sert de proposition aux prochains.
                    </p>

                    <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1"
                                disabled={enAttente} onClick={() => setEdition(false)}>
                            Annuler
                        </Button>
                        <Button type="submit" className="flex-1" disabled={enAttente}>
                            {enAttente
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</>
                                : 'Enregistrer'
                            }
                        </Button>
                    </div>
                </form>
            ) : (
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <div>
                        <p className="text-xs text-muted-foreground">Salaire de base</p>
                        <p className="text-2xl font-bold text-foreground tabular-nums">
                            {formatMontant(employe.salaire_base)}
                        </p>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm border-t border-border pt-4">
                        <div>
                            <dt className="text-xs text-muted-foreground">Poste</dt>
                            <dd className="text-foreground">{employe.poste ?? '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Téléphone</dt>
                            <dd className="text-foreground">{employe.telephone ?? '—'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Embauché le</dt>
                            <dd className="text-foreground">
                                {employe.date_embauche ? formatDate(employe.date_embauche) : '—'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Total versé</dt>
                            <dd className="text-foreground tabular-nums">{formatMontant(totalVerse)}</dd>
                        </div>
                    </dl>

                    <div className="flex gap-2 border-t border-border pt-4">
                        <Button type="button" className="flex-1" disabled={enAttente}
                                onClick={() => setEdition(true)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Modifier
                        </Button>
                        <Button type="button" variant="outline" className="flex-1"
                                disabled={enAttente} onClick={basculer}>
                            {enAttente ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                employe.est_actif
                                    ? <><UserMinus className="w-4 h-4 mr-2" />Désactiver</>
                                    : <><UserCheck className="w-4 h-4 mr-2" />Réintégrer</>
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* Derniers versements */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Derniers versements</h2>
                {versements.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun versement enregistré.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {versements.map(v => (
                            <li key={v.id} className="flex items-center justify-between py-2 text-sm">
                                <div>
                                    <p className="text-foreground">
                                        {MOIS_LABELS[v.periode_mois]} {v.periode_annee}
                                        {v.est_annule && (
                                            <span className="ml-2 text-xs text-destructive font-medium">
                                                Annulé
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Versé le {formatDate(v.date_paiement)} · {v.public_id}
                                    </p>
                                </div>
                                <span className="flex items-center gap-2 shrink-0">
                                    <span className={`font-medium tabular-nums ${
                                        v.est_annule ? 'text-muted-foreground line-through' : 'text-foreground'
                                    }`}>
                                        {formatMontant(v.montant_net)}
                                    </span>
                                    <a href={`/api/v1/pdf/bulletin-paie/${v.id}`}
                                       target="_blank" rel="noopener noreferrer"
                                       aria-label={`Bulletin de paie ${v.public_id}`}
                                       title="Bulletin de paie"
                                       className="p-1 rounded hover:bg-muted text-muted-foreground">
                                        <FileText className="w-3.5 h-3.5" />
                                    </a>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <HistoriqueCorrections entrees={historique} />
        </div>
    )
}
