'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Users, Search, UserPlus, X, Loader2 } from 'lucide-react'
import { rechercherClients, creerClientRapide } from '@/actions/clients'
import type { ClientChoisi } from '@/lib/clients/client-choisi'
import { useDebounce } from '@/hooks/useDebounce'
import { formatMontant } from '@/lib/utils'

export type { ClientChoisi }

interface Props {
    clientSelectionne: ClientChoisi | null
    onClientChange:    (c: ClientChoisi | null) => void
    peutCreerClient:   boolean
    // « caisse » : bandeau compact du panier, soldes affichés.
    // « formulaire » : champ aux couleurs des formulaires (facture, proforma).
    variante:          'caisse' | 'formulaire'
    // Texte du champ vide : il dit aussi ce que vaut l'absence de client.
    indication:        string
    devise?:           string
}

// Le client se choisissait dans une liste déroulante chargée d'un bloc
// (plafonnée à 200 au comptoir) : au-delà il restait introuvable, et un
// client absent obligeait à quitter l'écran pour le créer.
// Ici la recherche interroge la base, et un client introuvable se crée
// sur place avec ce qui vient d'être tapé.
export default function ChoixClient({
    clientSelectionne, onClientChange, peutCreerClient, variante,
    indication, devise,
}: Props) {
    const [terme,      setTerme]      = useState('')
    const [resultats,  setResultats]  = useState<ClientChoisi[]>([])
    const [cherche,    setCherche]    = useState(false)   // une recherche a abouti pour ce terme
    const [chargement, setChargement] = useState(false)

    const [creation,   setCreation]   = useState(false)
    const [nom,        setNom]        = useState('')
    const [telephone,  setTelephone]  = useState('')
    const [enCours,    setEnCours]    = useState(false)
    const [erreur,     setErreur]     = useState<string>()
    const [existant,   setExistant]   = useState<ClientChoisi>()
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
        setResultats(await rechercherClients(valeur))
        setCherche(true)
        setChargement(false)
    }, [])

    useDebounce(terme, 250, rechercher)

    function choisir(c: ClientChoisi | null) {
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
        const res = await creerClientRapide({ nom, telephone })
        setEnCours(false)
        if (res.client) { choisir(res.client); return }
        setErreur(res.erreur)
        setExistant(res.existant)
    }

    const caisse = variante === 'caisse'
    const st = caisse
        ? {
            champ:   'w-full px-2.5 py-2 bg-white border border-[#15335a]/20 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#15335a]/30 text-gray-700',
            carte:   'bg-white border border-[#15335a]/20 rounded-xl',
            texte:   'text-xs', petit: 'text-[10px]',
            accent:  'text-[#15335a]',
            bouton:  'text-white bg-[#15335a] hover:bg-[#0f2742]',
            neutre:  'text-gray-600 bg-gray-100 hover:bg-gray-200',
            survol:  'hover:bg-[#f0f4ff]', fondCreer: 'bg-[#f0f4ff] hover:bg-[#e2eaff]',
            attenue: 'text-gray-400', fort: 'text-gray-800',
        }
        : {
            champ:   'w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring',
            carte:   'bg-background border border-input rounded-lg',
            texte:   'text-sm', petit: 'text-xs',
            accent:  'text-primary',
            bouton:  'text-primary-foreground bg-primary hover:bg-primary/90',
            neutre:  'text-foreground bg-muted hover:bg-muted/80',
            survol:  'hover:bg-muted', fondCreer: 'bg-muted/50 hover:bg-muted',
            attenue: 'text-muted-foreground', fort: 'text-foreground',
        }

    const contenu = clientSelectionne ? (

        /* Client choisi */
        <>
            <div className={`flex items-center justify-between gap-2 ${caisse ? 'px-2.5 py-2' : 'px-3 py-2'} ${st.carte}`}>
                <div className="min-w-0">
                    <p className={`${st.texte} font-bold ${st.fort} truncate`}>{clientSelectionne.nom}</p>
                    <p className={`${st.petit} ${st.attenue}`}>
                        {clientSelectionne.public_id}{clientSelectionne.telephone ? ` · ${clientSelectionne.telephone}` : ''}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onClientChange(null)}
                    title="Retirer le client"
                    className={`shrink-0 p-1 ${st.attenue} hover:text-red-500 rounded-lg`}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            {caisse && (clientSelectionne.advance_balance > 0 || clientSelectionne.change_balance > 0) && (
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
        <div className={`space-y-1.5 p-2.5 ${st.carte}`}>
            <p className={`${caisse ? 'text-[11px]' : 'text-xs'} font-bold ${st.accent}`}>Nouveau client</p>
            <input
                ref={refNom}
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="Nom *"
                className={st.champ}
            />
            <input
                ref={refTelephone}
                value={telephone}
                onChange={e => setTelephone(e.target.value)}
                placeholder="Téléphone *"
                inputMode="tel"
                className={st.champ}
            />
            {erreur && (
                <div className={`${caisse ? 'text-[11px]' : 'text-xs'} text-red-600 font-medium space-y-1`}>
                    <p>{erreur}</p>
                    {existant && (
                        <button
                            type="button"
                            onClick={() => choisir(existant)}
                            className={`${st.accent} font-bold underline`}
                        >
                            Choisir {existant.nom}
                        </button>
                    )}
                </div>
            )}
            <div className="flex gap-1.5 pt-0.5">
                <button
                    type="button"
                    onClick={fermerCreation}
                    disabled={enCours}
                    className={`flex-1 py-1.5 ${st.texte} font-bold rounded-lg ${st.neutre}`}
                >
                    Annuler
                </button>
                <button
                    type="button"
                    onClick={creer}
                    disabled={enCours || !nom.trim() || !telephone.trim()}
                    className={`flex-[2] flex items-center justify-center gap-1.5 py-1.5 ${st.texte} font-bold rounded-lg disabled:opacity-40 ${st.bouton}`}
                >
                    {enCours && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Créer et sélectionner
                </button>
            </div>
        </div>
    ) : (

        /* Recherche */
        <div className="relative">
            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${st.attenue}`} />
            <input
                value={terme}
                onChange={e => setTerme(e.target.value)}
                placeholder={indication}
                className={`${st.champ} pl-8`}
            />
            {chargement && (
                <Loader2 className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin ${st.attenue}`} />
            )}

            {terme.trim().length >= 2 && cherche && (
                <div className={`absolute z-20 left-0 right-0 mt-1 shadow-lg overflow-hidden ${caisse ? 'bg-white border border-gray-200 rounded-xl' : 'bg-card border border-border rounded-lg'}`}>
                    <div className="max-h-56 overflow-y-auto divide-y divide-border">
                        {resultats.map(c => (
                            <button
                                type="button"
                                key={c.id}
                                onClick={() => choisir(c)}
                                className={`w-full text-left px-3 py-2 ${st.survol}`}
                            >
                                <p className={`${st.texte} font-bold ${st.fort}`}>{c.nom}</p>
                                <p className={`${st.petit} ${st.attenue}`}>
                                    {c.public_id}{c.telephone ? ` · ${c.telephone}` : ''}
                                </p>
                            </button>
                        ))}
                        {resultats.length === 0 && (
                            <p className={`px-3 py-2 ${st.texte} ${st.attenue}`}>Aucun client trouvé.</p>
                        )}
                    </div>
                    {peutCreerClient && (
                        <button
                            type="button"
                            onClick={ouvrirCreation}
                            className={`w-full flex items-center gap-1.5 px-3 py-2 ${st.texte} font-bold ${st.accent} ${st.fondCreer} border-t border-border`}
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            Créer client « {terme.trim()} »
                        </button>
                    )}
                </div>
            )}
        </div>
    )

    if (!caisse) return contenu

    return (
        <div className="px-3 py-2.5 bg-[#f0f4ff] border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-1.5 mb-1.5">
                <Users className="w-3.5 h-3.5 text-[#15335a]" />
                <span className="text-xs font-bold text-[#15335a]">Client</span>
            </div>
            {contenu}
        </div>
    )
}
