'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { reglerRetourVente } from '@/actions/ventes'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

// La partie stock d'un retour était traitée depuis le Lot 4 Stock, sa
// partie financière ne l'était jamais : `reglement` restait à
// « à traiter » et rien ne le faisait avancer.
//
// Décision D2 du module POS : les trois issues sont proposées, avec
// « porter à l'avance du client » par défaut — le remboursement vide le
// tiroir, l'avance fidélise, mais un client qui exige son argent doit
// pouvoir l'obtenir.
const MODES = [
    {
        code: 'avance' as const,
        titre: 'Porter à l’avance du client',
        aide: 'Réutilisable sur un prochain achat. Demande un client identifié.',
    },
    {
        code: 'rembourse' as const,
        titre: 'Rembourser en espèces',
        aide: 'L’argent sort de la caisse : la sortie est enregistrée en dépense.',
    },
    {
        code: 'avoir' as const,
        titre: 'Établir un avoir',
        aide: 'À émettre ensuite depuis la facture du client.',
    },
    {
        code: 'sans_suite' as const,
        titre: 'Sans suite',
        aide: 'La marchandise revient, rien n’est dû au client.',
    },
]

export default function ReglerRetour({
    retourId, montant, devise, aUnClient,
}: {
    retourId:  string
    montant:   number
    devise:    string
    aUnClient: boolean
}) {
    const router = useRouter()

    const [ouvert, setOuvert]       = useState(false)
    const [mode, setMode]           = useState<typeof MODES[number]['code']>('avance')
    const [note, setNote]           = useState('')
    const [erreur, setErreur]       = useState('')
    const [enAttente, setEnAttente] = useState(false)

    async function confirmer() {
        setEnAttente(true)
        setErreur('')

        const res = await reglerRetourVente(retourId, mode, note)
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }

        setOuvert(false)
        setNote('')
        router.refresh()
    }

    if (!ouvert) {
        return (
            <Button type="button" variant="outline" size="sm" className="mt-2"
                    onClick={() => {
                        setOuvert(true)
                        // Sans client, l'avance est impossible : on
                        // propose d'emblée l'issue qui marche.
                        setMode(aUnClient ? 'avance' : 'rembourse')
                    }}>
                Régler ce retour
            </Button>
        )
    }

    return (
        <div className="mt-3 bg-muted/30 border border-border rounded-xl p-3 space-y-2.5">
            <p className="text-xs font-medium text-foreground">
                Que faire des {formatMontant(montant, devise)} ?
            </p>

            {erreur && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-2.5 py-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{erreur}</span>
                </div>
            )}

            <div className="space-y-1.5">
                {MODES.map(m => {
                    const indisponible = m.code === 'avance' && !aUnClient
                    return (
                        <label key={m.code}
                               className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                                   indisponible ? 'opacity-40 cursor-not-allowed' : 'hover:bg-background'
                               } ${mode === m.code ? 'bg-background border border-input' : ''}`}>
                            <input
                                type="radio"
                                name={`mode-${retourId}`}
                                value={m.code}
                                checked={mode === m.code}
                                disabled={indisponible || enAttente}
                                onChange={() => setMode(m.code)}
                                className="mt-0.5 accent-primary"
                            />
                            <span className="min-w-0">
                                <span className="block text-xs font-medium text-foreground">
                                    {m.titre}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    {indisponible
                                        ? 'Impossible : ce retour n’a pas de client identifié.'
                                        : m.aide}
                                </span>
                            </span>
                        </label>
                    )
                })}
            </div>

            <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Note (facultative)"
                disabled={enAttente}
                className="w-full px-2.5 py-1.5 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />

            <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1"
                        disabled={enAttente}
                        onClick={() => { setOuvert(false); setErreur('') }}>
                    Retour
                </Button>
                <Button type="button" size="sm" className="flex-1"
                        disabled={enAttente} onClick={confirmer}>
                    {enAttente
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Régler</>}
                </Button>
            </div>
        </div>
    )
}
