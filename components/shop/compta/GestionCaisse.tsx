'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ouvrirSessionCaisse, fermerSessionCaisse } from '@/actions/ventes'
import { Button } from '@/components/ui/button'
import ChampNombre from '@/components/ui/ChampNombre'
import {
    Loader2, AlertCircle, Wallet, Lock, Unlock, Info,
} from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'

interface Session {
    id:              string
    public_id:       string
    jour:            string
    statut:          string
    fond_initial:    number
    compte_especes:  number | null
    attendu_especes: number | null
    ecart:           number | null
    note_ouverture:  string | null
    note_fermeture:  string | null
    ouverte_le:      string
    fermee_le:       string | null
    warehouses:      { nom: string } | null
}

export default function GestionCaisse({
    entrepots, sessions, attendus, devise, peutOuvrir, peutFermer,
}: {
    entrepots:  { id: string; nom: string; est_defaut: boolean }[]
    sessions:   Session[]
    attendus:   Record<string, number>
    devise:     string
    peutOuvrir: boolean
    peutFermer: boolean
}) {
    const router = useRouter()

    const [erreur, setErreur]       = useState('')
    const [enAttente, setEnAttente] = useState(false)

    // Ouverture
    const [ouvertureVisible, setOuvertureVisible] = useState(false)
    const [entrepotId, setEntrepotId] = useState(
        entrepots.find(e => e.est_defaut)?.id ?? entrepots[0]?.id ?? '',
    )
    const [fond, setFond] = useState(0)
    const [noteOuv, setNoteOuv] = useState('')

    // Fermeture
    const [fermetureId, setFermetureId] = useState<string | null>(null)
    const [compte, setCompte] = useState(0)
    const [noteFerm, setNoteFerm] = useState('')

    const ouvertes = sessions.filter(s => s.statut === 'ouverte')
    const fermees  = sessions.filter(s => s.statut === 'fermee')

    // Un entrepôt qui a déjà sa caisse ouverte ne peut pas en rouvrir
    // une : deux tiroirs pour un comptoir n'auraient aucun sens.
    const entrepotsLibres = entrepots.filter(
        e => !ouvertes.some(s => s.warehouses?.nom === e.nom),
    )

    async function ouvrir() {
        setEnAttente(true)
        setErreur('')

        const res = await ouvrirSessionCaisse(entrepotId, fond, noteOuv)
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }

        setOuvertureVisible(false)
        setFond(0)
        setNoteOuv('')
        router.refresh()
    }

    async function fermer(sessionId: string) {
        setEnAttente(true)
        setErreur('')

        const res = await fermerSessionCaisse(sessionId, compte, noteFerm)
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }

        setFermetureId(null)
        setCompte(0)
        setNoteFerm('')
        router.refresh()
    }

    return (
        <div className="space-y-6">

            {erreur && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{erreur}</span>
                </div>
            )}

            {/* Caisses ouvertes */}
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Unlock className="w-4 h-4 text-green-600" />
                        Caisses ouvertes ({ouvertes.length})
                    </h2>
                    {peutOuvrir && entrepotsLibres.length > 0 && !ouvertureVisible && (
                        <Button type="button" size="sm"
                                onClick={() => {
                                    setEntrepotId(entrepotsLibres[0].id)
                                    setOuvertureVisible(true)
                                }}>
                            Ouvrir une caisse
                        </Button>
                    )}
                </div>

                {ouvertureVisible && (
                    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                        <h3 className="text-sm font-semibold text-foreground">Ouvrir la caisse</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label htmlFor="entrepot" className="text-sm font-medium text-foreground">
                                    Entrepôt
                                </label>
                                <select id="entrepot" value={entrepotId}
                                        onChange={e => setEntrepotId(e.target.value)}
                                        disabled={enAttente}
                                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                                    {entrepotsLibres.map(e => (
                                        <option key={e.id} value={e.id}>{e.nom}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">
                                    Fond de caisse
                                </label>
                                <ChampNombre
                                    value={fond} onChange={setFond} disabled={enAttente}
                                    aria-label="Fond de caisse"
                                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                                <p className="text-xs text-muted-foreground">
                                    Les espèces déjà dans le tiroir avant la première vente.
                                </p>
                            </div>
                        </div>

                        <input type="text" value={noteOuv}
                               onChange={e => setNoteOuv(e.target.value)}
                               placeholder="Note (facultative)" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />

                        <div className="flex gap-2">
                            <Button type="button" variant="outline" className="flex-1"
                                    disabled={enAttente}
                                    onClick={() => { setOuvertureVisible(false); setErreur('') }}>
                                Annuler
                            </Button>
                            <Button type="button" className="flex-1" disabled={enAttente} onClick={ouvrir}>
                                {enAttente
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : 'Ouvrir'}
                            </Button>
                        </div>
                    </div>
                )}

                {ouvertes.length === 0 && !ouvertureVisible ? (
                    <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl px-5 py-8 text-center">
                        Aucune caisse ouverte. Ouvrez-en une en début de journée pour pouvoir
                        compter le tiroir le soir.
                    </p>
                ) : (
                    ouvertes.map(s => {
                        const attendu = attendus[s.id] ?? 0
                        const enFermeture = fermetureId === s.id
                        const ecartPrevu  = compte - attendu

                        return (
                            <div key={s.id} className="bg-card border border-border rounded-xl p-5 space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">
                                            {s.warehouses?.nom ?? 'Entrepôt'}
                                        </p>
                                        <p className="text-xs font-mono text-muted-foreground">
                                            {s.public_id} · ouverte le {formatDate(s.ouverte_le)}
                                        </p>
                                        {s.note_ouverture && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {s.note_ouverture}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs text-muted-foreground">Espèces attendues</p>
                                        <p className="text-lg font-bold text-foreground tabular-nums">
                                            {formatMontant(attendu, devise)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            dont {formatMontant(s.fond_initial, devise)} de fond
                                        </p>
                                    </div>
                                </div>

                                {peutFermer && (
                                    enFermeture ? (
                                        <div className="border-t border-border pt-4 space-y-3">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-foreground">
                                                    Espèces comptées dans le tiroir
                                                </label>
                                                <ChampNombre
                                                    value={compte} onChange={setCompte} disabled={enAttente}
                                                    aria-label="Espèces comptées"
                                                    className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                                            </div>

                                            {compte > 0 && (
                                                <div className={`rounded-lg px-3 py-2.5 text-sm ${
                                                    Math.abs(ecartPrevu) < 0.01
                                                        ? 'bg-green-50 border border-green-200 text-green-800'
                                                        : 'bg-amber-50 border border-amber-200 text-amber-800'
                                                }`}>
                                                    {Math.abs(ecartPrevu) < 0.01
                                                        ? 'Le compte est juste.'
                                                        : ecartPrevu > 0
                                                            ? `Excédent de ${formatMontant(ecartPrevu, devise)} — plus d'espèces que prévu.`
                                                            : `Manque ${formatMontant(Math.abs(ecartPrevu), devise)} par rapport aux espèces attendues.`}
                                                </div>
                                            )}

                                            <input type="text" value={noteFerm}
                                                   onChange={e => setNoteFerm(e.target.value)}
                                                   placeholder="Explication de l'écart, s'il y en a un"
                                                   disabled={enAttente}
                                                   className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />

                                            <p className="text-xs text-muted-foreground flex items-start gap-2">
                                                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                                <span>
                                                    L&apos;écart est constaté, jamais corrigé en silence :
                                                    c&apos;est lui qui a de la valeur.
                                                </span>
                                            </p>

                                            <div className="flex gap-2">
                                                <Button type="button" variant="outline" className="flex-1"
                                                        disabled={enAttente}
                                                        onClick={() => { setFermetureId(null); setErreur('') }}>
                                                    Retour
                                                </Button>
                                                <Button type="button" className="flex-1"
                                                        disabled={enAttente} onClick={() => fermer(s.id)}>
                                                    {enAttente
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : 'Fermer la caisse'}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <Button type="button" variant="outline" size="sm"
                                                className="border-t border-border"
                                                onClick={() => {
                                                    setFermetureId(s.id)
                                                    setCompte(0)
                                                    setErreur('')
                                                }}>
                                            <Lock className="w-4 h-4 mr-2" />
                                            Compter et fermer
                                        </Button>
                                    )
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Historique */}
            {fermees.length > 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 px-5 py-4 border-b border-border">
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                        Journées fermées
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="border-b border-border bg-muted/40">
                                <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Journée</th>
                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Attendu</th>
                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Compté</th>
                                <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">Écart</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                            {fermees.map(s => (
                                <tr key={s.id}>
                                    <td className="px-5 py-3">
                                        <p className="text-foreground">{formatDate(s.jour)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {s.warehouses?.nom ?? 'Entrepôt'} · {s.public_id}
                                        </p>
                                        {s.note_fermeture && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {s.note_fermeture}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                                        {formatMontant(s.attendu_especes ?? 0, devise)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                                        {formatMontant(s.compte_especes ?? 0, devise)}
                                    </td>
                                    <td className={`px-5 py-3 text-right tabular-nums font-medium ${
                                        Math.abs(s.ecart ?? 0) < 0.01
                                            ? 'text-green-600'
                                            : 'text-amber-700'
                                    }`}>
                                        {(s.ecart ?? 0) > 0 ? '+' : ''}{formatMontant(s.ecart ?? 0, devise)}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
