'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Wallet, Loader2, AlertCircle, RotateCcw, Lock } from 'lucide-react'
import { ouvrirSessionCaisse, rouvrirSessionCaisse } from '@/actions/ventes'
import ChampNombre from '@/components/ui/ChampNombre'

export interface SessionCaissePOS {
    id: string; warehouse_id: string; jour: string; statut: string; fermee_le: string | null
}

// Ce que le comptoir doit faire avant d'encaisser dans cet entrepôt.
export type EtatCaisse =
    | { etat: 'ouverte' }
    | { etat: 'a_ouvrir' }
    | { etat: 'comptee'; session: SessionCaissePOS }
    | { etat: 'oubliee'; session: SessionCaissePOS }

export function etatCaisse(sessions: SessionCaissePOS[], warehouseId: string, jour: string): EtatCaisse {
    const ouverte = sessions.find(s => s.warehouse_id === warehouseId && s.statut === 'ouverte')
    if (ouverte) return ouverte.jour === jour ? { etat: 'ouverte' } : { etat: 'oubliee', session: ouverte }
    const duJour = sessions.find(s => s.warehouse_id === warehouseId && s.jour === jour)
    return duJour ? { etat: 'comptee', session: duJour } : { etat: 'a_ouvrir' }
}

const dateFR = (iso: string) => iso.split('-').reverse().join('/')

// Le rapport de caisse se construit sur les sessions : on ne vend plus
// sans avoir ouvert la caisse du jour (fond du matin).
export default function OuvertureCaissePOS({
    etat, warehouseId, entrepotNom, devise, peutFermerCaisse,
}: {
    etat:             Exclude<EtatCaisse, { etat: 'ouverte' }>
    warehouseId:      string
    entrepotNom:      string
    devise:           string
    peutFermerCaisse: boolean
}) {
    const router = useRouter()
    const [fond,      setFond]      = useState(0)
    const [note,      setNote]      = useState('')
    const [enAttente, setEnAttente] = useState(false)
    const [erreur,    setErreur]    = useState<string>()

    async function agir(action: () => Promise<{ erreur?: string }>) {
        setEnAttente(true); setErreur(undefined)
        const res = await action()
        setEnAttente(false)
        if (res.erreur) { setErreur(res.erreur); return }
        router.refresh()
    }

    const bouton = 'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-[#15335a] hover:bg-[#0f2742] disabled:opacity-50'

    return (
        <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6 space-y-4">

                {etat.etat === 'a_ouvrir' && (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-[#f0f4ff]"><Wallet className="w-5 h-5 text-[#15335a]" /></div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900">Ouvrir la caisse</h2>
                                <p className="text-xs text-gray-500">{entrepotNom} · aujourd&apos;hui</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600">
                            Comptez les espèces présentes dans le tiroir avant la première vente. Ce fond servira
                            au comptage de ce soir.
                        </p>
                        <label className="block space-y-1">
                            <span className="text-xs font-bold text-gray-700">Fond de caisse ({devise})</span>
                            <ChampNombre
                                value={fond}
                                onChange={setFond}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                            />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs font-bold text-gray-700">Note (facultatif)</span>
                            <input
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                            />
                        </label>
                        <button
                            type="button"
                            disabled={enAttente}
                            onClick={() => agir(() => ouvrirSessionCaisse(warehouseId, fond, note))}
                            className={bouton}
                        >
                            {enAttente && <Loader2 className="w-4 h-4 animate-spin" />}
                            Ouvrir la caisse et commencer à vendre
                        </button>
                    </>
                )}

                {etat.etat === 'comptee' && (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-50"><Lock className="w-5 h-5 text-amber-600" /></div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900">Caisse fermée pour aujourd&apos;hui</h2>
                                <p className="text-xs text-gray-500">{entrepotNom}</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600">
                            Le tiroir a déjà été compté. Pour encaisser encore, rouvrez la caisse : le comptage
                            sera annulé (il reste noté) et il faudra recompter avant de partir.
                        </p>
                        <button
                            type="button"
                            disabled={enAttente}
                            onClick={() => agir(() => rouvrirSessionCaisse(etat.session.id))}
                            className={bouton}
                        >
                            {enAttente ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            Rouvrir la caisse
                        </button>
                    </>
                )}

                {etat.etat === 'oubliee' && (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-red-50"><AlertCircle className="w-5 h-5 text-red-600" /></div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900">La caisse du {dateFR(etat.session.jour)} n&apos;a pas été fermée</h2>
                                <p className="text-xs text-gray-500">{entrepotNom}</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600">
                            Elle doit être comptée et fermée avant d&apos;ouvrir celle d&apos;aujourd&apos;hui.
                            {!peutFermerCaisse && ' Demandez à un gestionnaire de la fermer.'}
                        </p>
                        {peutFermerCaisse && (
                            <Link href="/compta/caisse" className={bouton}>
                                Compter et fermer la caisse
                            </Link>
                        )}
                    </>
                )}

                {erreur && (
                    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        {erreur}
                    </div>
                )}
            </div>
        </div>
    )
}
