'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Users, Search, UserPlus, X, Loader2 } from 'lucide-react'
import { rechercherClientsPOS } from '@/actions/ventes'
import { creerClientPOS } from '@/actions/clients'
import { useDebounce } from '@/hooks/useDebounce'
import { formatMontant } from '@/lib/utils'

export interface ClientPOS {
    id: string; public_id: string; nom: string; telephone: string | null
    credit_balance: number; advance_balance: number; change_balance: number
}

interface Props {
    clientSelectionne: ClientPOS | null
    onClientChange:    (c: ClientPOS | null) => void
    peutCreerClient:   boolean
    devise:            string
}

// Le client se cherchait dans une liste déroulante chargée au démarrage
// et plafonnée à 200 : au-delà, il existait mais restait introuvable, et
// un client absent obligeait à quitter la caisse pour le créer.
// Désormais la recherche interroge la base, et un client introuvable se
// crée sur place avec ce que le caissier vient de taper.
export default function ChoixClientPOS({ clientSelectionne, onClientChange, peutCreerClient, devise }: Props) {
    const [terme,      setTerme]      = useState('')
    const [resultats,  setResultats]  = useState<ClientPOS[]>([])
    const [cherche,    setCherche]    = useState(false)   // une recherche a abouti pour ce terme
    const [chargement, setChargement] = useState(false)

    const [creation,   setCreation]   = useState(false)
    const [nom,        setNom]        = useState('')
    const [telephone,  setTelephone]  = useState('')
    const [enCours,    setEnCours]    = useState(false)
    const [erreur,     setErreur]     = useState<string>()
    const [existant,   setExistant]   = useState<ClientPOS>()
    const refNom       = useRef<HTMLInputElement>(null)
    const refTelephone = useRef<HTMLInputElement>(null)

    // Le curseur va au champ qui reste à remplir.
    useEffect(() => {
        if (creation) (nom.trim() ? refTelephone : refNom).current?.focus()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [creation])

    const rechercher = useCallback(async (valeur: string) => {
        if (valeur.trim().length < 2) { setResultats([]); setCherche(false); return }
        setChargement(true)
        const data = await rechercherClientsPOS(valeur)
        setResultats(data as ClientPOS[])
        setCherche(true)
        setChargement(false)
    }, [])

    useDebounce(terme, 250, rechercher)

    function choisir(c: ClientPOS | null) {
        onClientChange(c)
        setTerme(''); setResultats([]); setCherche(false)
        fermerCreation()
    }

    // Ce qui a été tapé pré-remplit le bon champ : des chiffres sont un
    // numéro, le reste un nom.
    function ouvrirCreation() {
        const saisi = terme.trim()
        const estNumero = /^\+?[\d\s.-]+$/.test(saisi)
        setNom(estNumero ? '' : saisi)
        setTelephone(estNumero ? saisi : '')
        setErreur(undefined); setExistant(undefined)
        setCreation(true)
    }

    function fermerCreation() {
        setCreation(false); setErreur(undefined); setExistant(undefined)
    }

    async function creer() {
        setEnCours(true); setErreur(undefined); setExistant(undefined)
        const res = await creerClientPOS({ nom, telephone })
        setEnCours(false)
        if (res.client) { choisir(res.client as ClientPOS); return }
        setErreur(res.erreur)
        setExistant(res.existant as ClientPOS | undefined)
    }

    const champ = 'w-full px-2.5 py-2 bg-white border border-[#15335a]/20 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#15335a]/30 text-gray-700'

    return (
        <div className="px-3 py-2.5 bg-[#f0f4ff] border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-1.5 mb-1.5">
                <Users className="w-3.5 h-3.5 text-[#15335a]" />
                <span className="text-xs font-bold text-[#15335a]">Client</span>
            </div>

            {/* Client choisi */}
            {clientSelectionne ? (
                <>
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2 bg-white border border-[#15335a]/20 rounded-xl">
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{clientSelectionne.nom}</p>
                            <p className="text-[10px] text-gray-400">
                                {clientSelectionne.public_id}{clientSelectionne.telephone ? ` · ${clientSelectionne.telephone}` : ''}
                            </p>
                        </div>
                        <button
                            onClick={() => onClientChange(null)}
                            title="Revenir au client anonyme"
                            className="shrink-0 p-1 text-gray-400 hover:text-red-500 rounded-lg"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    {(clientSelectionne.advance_balance > 0 || clientSelectionne.change_balance > 0) && (
                        <div className="flex gap-2 mt-1.5">
                            {clientSelectionne.advance_balance > 0 && (
                                <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                    Avance : {formatMontant(clientSelectionne.advance_balance, devise)}
                                </span>
                            )}
                            {clientSelectionne.change_balance > 0 && (
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                    Monnaie : {formatMontant(clientSelectionne.change_balance, devise)}
                                </span>
                            )}
                        </div>
                    )}
                </>
            ) : creation ? (

                /* Création express */
                <div className="space-y-1.5 bg-white border border-[#15335a]/20 rounded-xl p-2.5">
                    <p className="text-[11px] font-bold text-[#15335a]">Nouveau client</p>
                    <input
                        value={nom}
                        onChange={e => setNom(e.target.value)}
                        ref={refNom}
                        placeholder="Nom *"
                        className={champ}
                    />
                    <input
                        value={telephone}
                        onChange={e => setTelephone(e.target.value)}
                        ref={refTelephone}
                        placeholder="Téléphone *"
                        inputMode="tel"
                        className={champ}
                    />
                    {erreur && (
                        <div className="text-[11px] text-red-600 font-medium space-y-1">
                            <p>{erreur}</p>
                            {existant && (
                                <button
                                    onClick={() => choisir(existant)}
                                    className="text-[#15335a] font-bold underline"
                                >
                                    Choisir {existant.nom}
                                </button>
                            )}
                        </div>
                    )}
                    <div className="flex gap-1.5 pt-0.5">
                        <button
                            onClick={fermerCreation}
                            disabled={enCours}
                            className="flex-1 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={creer}
                            disabled={enCours || !nom.trim() || !telephone.trim()}
                            className="flex-[2] flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold text-white bg-[#15335a] hover:bg-[#0f2742] disabled:opacity-40 rounded-lg"
                        >
                            {enCours && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Créer et sélectionner
                        </button>
                    </div>
                </div>
            ) : (

                /* Recherche */
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        value={terme}
                        onChange={e => setTerme(e.target.value)}
                        placeholder="Client anonyme — chercher nom ou téléphone"
                        className={`${champ} pl-8`}
                    />
                    {chargement && (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />
                    )}

                    {terme.trim().length >= 2 && cherche && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                                {resultats.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => choisir(c)}
                                        className="w-full text-left px-3 py-2 hover:bg-[#f0f4ff]"
                                    >
                                        <p className="text-xs font-bold text-gray-800">{c.nom}</p>
                                        <p className="text-[10px] text-gray-400">
                                            {c.public_id}{c.telephone ? ` · ${c.telephone}` : ''}
                                        </p>
                                    </button>
                                ))}
                                {resultats.length === 0 && (
                                    <p className="px-3 py-2 text-xs text-gray-400">Aucun client trouvé.</p>
                                )}
                            </div>
                            {peutCreerClient && (
                                <button
                                    onClick={ouvrirCreation}
                                    className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#15335a] bg-[#f0f4ff] hover:bg-[#e2eaff] border-t border-gray-200"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    Créer client « {terme.trim()} »
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
