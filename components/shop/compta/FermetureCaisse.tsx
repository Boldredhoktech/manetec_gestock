'use client'

// Compter et fermer une caisse POS, puis verser vers la caisse
// principale (mig 044, versement proposé à la clôture). Utilisé dans
// Compta → Caisse et au POS (la caissière ferme SA caisse).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fermerSessionCaisse, infosFermetureSession } from '@/actions/ventes'
import { Button } from '@/components/ui/button'
import ChampNombre from '@/components/ui/ChampNombre'
import { PiedFormulaire } from '@/components/ui/ModalesPartagees'
import { AlertCircle, Info, Loader2, ArrowRightLeft } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

type Infos = { attendu: number; solde: number; fond: number; publicId: string; caisse: string; jour: string }

const champ = 'w-full px-3 py-2.5 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'

export default function FermetureCaisse({ sessionId, devise, onFini }: {
    sessionId: string
    devise:    string
    onFini:    (message: string) => void
}) {
    const router = useRouter()
    const [infos, setInfos]       = useState<Infos | null>(null)
    const [erreur, setErreur]     = useState('')
    const [compte, setCompte]     = useState(0)
    const [note, setNote]         = useState('')
    const [verser, setVerser]     = useState(true)
    const [versement, setVersement] = useState(0)
    const [touche, setTouche]     = useState(false)
    const [enAttente, setEnAttente] = useState(false)

    useEffect(() => {
        let actif = true
        infosFermetureSession(sessionId).then(r => {
            if (!actif) return
            if ('erreur' in r) { setErreur(r.erreur); return }
            setInfos(r)
        })
        return () => { actif = false }
    }, [sessionId])

    // Proposition : tout ce que la caisse a enregistré (dans la limite du
    // compté), moins le fond du matin qu'on garde pour demain.
    const plafond   = infos ? Math.max(0, Math.min(compte, infos.solde)) : 0
    const propose   = infos ? Math.max(0, plafond - infos.fond) : 0
    useEffect(() => { if (!touche) setVersement(propose) }, [propose, touche])

    const ecart = infos ? compte - infos.attendu : 0
    const montantVerse = verser ? versement : 0

    async function fermer() {
        setEnAttente(true); setErreur('')
        const res = await fermerSessionCaisse(sessionId, compte, note, montantVerse)
        setEnAttente(false)
        if (res.erreur) { setErreur(res.erreur); return }
        router.refresh()
        onFini(res.virement
            ? `Caisse fermée. ${formatMontant(res.versement ?? 0, devise)} versés à la caisse principale (${res.virement}).`
            : 'Caisse fermée.')
    }

    if (!infos) {
        return erreur
            ? <p role="alert" className="text-sm text-[var(--rouge-texte)]">{erreur}</p>
            : <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Calcul des espèces attendues…</p>
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--surface2)] p-3">
                    <p className="text-xs text-muted-foreground">Espèces attendues</p>
                    <p className="text-lg font-bold tabular-nums">{formatMontant(infos.attendu, devise)}</p>
                    <p className="text-xs text-muted-foreground">dont {formatMontant(infos.fond, devise)} de fond</p>
                </div>
                <div className="rounded-xl bg-[var(--surface2)] p-3">
                    <p className="text-xs text-muted-foreground">Enregistré dans la caisse</p>
                    <p className="text-lg font-bold tabular-nums">{formatMontant(infos.solde, devise)}</p>
                    <p className="text-xs text-muted-foreground">{infos.publicId}</p>
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Espèces comptées dans le tiroir</label>
                <ChampNombre value={compte} onChange={setCompte} disabled={enAttente}
                             aria-label="Espèces comptées" className={champ} />
            </div>

            {compte > 0 && (
                <div className={`rounded-xl px-3 py-2.5 text-sm ${
                    Math.abs(ecart) < 0.01
                        ? 'bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                        : 'bg-accent text-accent-foreground'
                }`}>
                    {Math.abs(ecart) < 0.01
                        ? 'Le compte est juste.'
                        : ecart > 0
                            ? `Excédent de ${formatMontant(ecart, devise)} — plus d'espèces que prévu.`
                            : `Manque ${formatMontant(Math.abs(ecart), devise)} par rapport aux espèces attendues.`}
                </div>
            )}

            <input type="text" value={note} onChange={e => setNote(e.target.value)}
                   placeholder="Explication de l'écart, s'il y en a un" disabled={enAttente} className={champ} />

            {/* Versement vers la caisse principale */}
            <div className="rounded-xl border border-border p-3 space-y-2.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <input type="checkbox" checked={verser} onChange={e => setVerser(e.target.checked)}
                           disabled={enAttente} className="accent-[var(--primary)]" />
                    <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />
                    Verser à la caisse principale
                </label>
                {verser && (
                    <>
                        <ChampNombre value={versement} onChange={v => { setTouche(true); setVersement(v) }}
                                     disabled={enAttente} aria-label="Montant versé" className={champ} />
                        <p className="text-xs text-muted-foreground">
                            Il restera {formatMontant(Math.max(0, infos.solde - versement), devise)} dans la caisse
                            {infos.fond > 0 ? ' (le fond de demain)' : ''}. Maximum : {formatMontant(plafond, devise)}.
                        </p>
                    </>
                )}
            </div>

            <p className="text-xs text-muted-foreground flex items-start gap-2">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>L&apos;écart est constaté, jamais corrigé en silence : il ne se verse pas.</span>
            </p>

            {erreur && (
                <div role="alert" className="flex items-start gap-2 bg-[var(--rouge-doux)] border border-[var(--rouge-texte)]/30 text-[var(--rouge-texte)] rounded-xl px-3 py-2.5 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{erreur}
                </div>
            )}

            <PiedFormulaire>
                <Button type="button" disabled={enAttente || (verser && versement > plafond)} onClick={fermer}
                        className="h-11 px-5 rounded-xl font-semibold">
                    {enAttente ? <Loader2 className="w-4 h-4 animate-spin" />
                        : montantVerse > 0 ? `Fermer et verser ${formatMontant(montantVerse, devise)}` : 'Fermer la caisse'}
                </Button>
            </PiedFormulaire>
        </div>
    )
}
