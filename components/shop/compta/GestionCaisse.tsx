'use client'

// Compta → Caisse (mig 044) : une session PAR CAISSE POS. Ouverture,
// comptage à la fermeture, versement vers la caisse principale.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ouvrirSessionCaisse } from '@/actions/ventes'
import { Button } from '@/components/ui/button'
import ChampNombre from '@/components/ui/ChampNombre'
import { BoutonModale, PiedFormulaire } from '@/components/ui/ModalesPartagees'
import FermetureCaisse from '@/components/shop/compta/FermetureCaisse'
import { Loader2, AlertCircle, Wallet, Lock, Unlock, CheckCircle2 } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import type { CaissePOS } from '@/lib/caisses/acces'

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
    compte_id:       string
    caisse:          { nom: string } | null
    warehouses:      { nom: string } | null
}

const champ = 'w-full px-3 py-2.5 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'

function OuvertureCaisse({ caisses, onFini }: { caisses: CaissePOS[]; onFini: () => void }) {
    const router = useRouter()
    const [caisseId, setCaisseId] = useState(caisses[0]?.id ?? '')
    const [fond, setFond] = useState(0)
    const [note, setNote] = useState('')
    const [erreur, setErreur] = useState('')
    const [enAttente, setEnAttente] = useState(false)

    async function ouvrir() {
        setEnAttente(true); setErreur('')
        const res = await ouvrirSessionCaisse(caisseId, fond, note)
        setEnAttente(false)
        if (res?.erreur) { setErreur(res.erreur); return }
        router.refresh()
        onFini()
    }

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <label htmlFor="caisse-ouv" className="text-sm font-medium text-foreground">Caisse</label>
                <select id="caisse-ouv" value={caisseId} onChange={e => setCaisseId(e.target.value)}
                        disabled={enAttente} className={champ}>
                    {caisses.map(c => <option key={c.id} value={c.id}>{c.nom} · {c.entrepot}</option>)}
                </select>
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Fond de caisse</label>
                <ChampNombre value={fond} onChange={setFond} disabled={enAttente} aria-label="Fond de caisse" className={champ} />
                <p className="text-xs text-muted-foreground">Les espèces déjà dans le tiroir avant la première vente.</p>
            </div>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
                   placeholder="Note (facultative)" disabled={enAttente} className={champ} />
            {erreur && (
                <div role="alert" className="flex items-start gap-2 bg-[var(--rouge-doux)] text-[var(--rouge-texte)] rounded-xl px-3 py-2.5 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{erreur}
                </div>
            )}
            <PiedFormulaire>
                <Button type="button" disabled={enAttente || !caisseId} onClick={ouvrir} className="h-11 px-5 rounded-xl font-semibold">
                    {enAttente ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ouvrir la caisse'}
                </Button>
            </PiedFormulaire>
        </div>
    )
}

export default function GestionCaisse({
    caisses, sessions, attendus, devise, peutOuvrir, peutFermer,
}: {
    caisses:    CaissePOS[]
    sessions:   Session[]
    attendus:   Record<string, number>
    devise:     string
    peutOuvrir: boolean
    peutFermer: boolean
}) {
    const [message, setMessage] = useState('')
    const ouvertes = sessions.filter(s => s.statut === 'ouverte')
    const fermees  = sessions.filter(s => s.statut === 'fermee')
    // Une caisse déjà ouverte ne s'ouvre pas une seconde fois.
    const libres = caisses.filter(c => !ouvertes.some(s => s.compte_id === c.id))

    return (
        <div className="space-y-6">
            {message && (
                <div className="flex items-start gap-2 bg-[var(--primary-soft)] text-[var(--primary-strong)] rounded-xl px-4 py-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />{message}
                </div>
            )}

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Unlock className="w-4 h-4 text-[var(--primary-strong)]" />
                        Caisses ouvertes ({ouvertes.length})
                    </h2>
                    {peutOuvrir && libres.length > 0 && (
                        <BoutonModale libelle="Ouvrir une caisse" variante="primaire" icone={Unlock}
                                      titre="Ouvrir une caisse" description="Le fond du matin sert au comptage de ce soir." taille="sm">
                            {fermer => <OuvertureCaisse caisses={libres} onFini={fermer} />}
                        </BoutonModale>
                    )}
                </div>

                {ouvertes.length === 0 ? (
                    <p className="text-sm text-muted-foreground bg-card border border-border rounded-2xl px-5 py-8 text-center">
                        Aucune caisse ouverte. Ouvrez-en une en début de journée pour pouvoir compter le tiroir le soir.
                    </p>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                        {ouvertes.map(s => (
                            <div key={s.id} className="bg-card border border-border rounded-2xl p-5 space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-foreground">{s.caisse?.nom ?? 'Caisse'}</p>
                                        <p className="text-xs text-muted-foreground">{s.warehouses?.nom}</p>
                                        <p className="text-xs font-mono text-muted-foreground">
                                            {s.public_id} · ouverte le {formatDate(s.ouverte_le)}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs text-muted-foreground">Espèces attendues</p>
                                        <p className="text-lg font-bold text-foreground tabular-nums">{formatMontant(attendus[s.id] ?? 0, devise)}</p>
                                        <p className="text-xs text-muted-foreground">dont {formatMontant(s.fond_initial, devise)} de fond</p>
                                    </div>
                                </div>
                                {peutFermer && (
                                    <BoutonModale libelle="Compter et fermer" icone={Lock}
                                                  titre={`Fermer ${s.caisse?.nom ?? 'la caisse'}`}
                                                  description="Comptez le tiroir ; l'argent peut être versé à la caisse principale.">
                                        {fermer => (
                                            <FermetureCaisse sessionId={s.id} devise={devise}
                                                             onFini={m => { setMessage(m); fermer() }} />
                                        )}
                                    </BoutonModale>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {fermees.length > 0 && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 px-5 py-4 border-b border-border">
                        <Wallet className="w-4 h-4 text-muted-foreground" />
                        Journées fermées
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="border-b border-border bg-[var(--surface2)]">
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
                                        <p className="text-foreground">{formatDate(s.jour)} · {s.caisse?.nom ?? 'Caisse'}</p>
                                        <p className="text-xs text-muted-foreground">{s.warehouses?.nom} · {s.public_id}</p>
                                        {s.note_fermeture && <p className="text-xs text-muted-foreground mt-0.5">{s.note_fermeture}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatMontant(s.attendu_especes ?? 0, devise)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatMontant(s.compte_especes ?? 0, devise)}</td>
                                    <td className={`px-5 py-3 text-right tabular-nums font-medium ${
                                        Math.abs(s.ecart ?? 0) < 0.01 ? 'text-[var(--primary-strong)]' : 'text-accent-foreground'
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
