'use client'

import { useState, useCallback } from 'react'
import { enregistrerVente, rechercherProduitsPOS } from '@/actions/ventes'
import type { LigneVente, PaiementVente } from '@/actions/ventes'
import PanierPOS from '@/components/shop/pos/PanierPOS'
import RechercheProduitPOS from '@/components/shop/pos/RechercheProduitPOS'
import PaiementPOS from '@/components/shop/pos/PaiementPOS'
import RecuPOS from '@/components/shop/pos/RecuPOS'
import Link from 'next/link'
import {
    Store, ShoppingCart, ArrowLeft,
    ChevronRight, LayoutDashboard,
} from 'lucide-react'
import { formatMontant } from '@/lib/utils'

interface Client {
    id: string; public_id: string; nom: string
    telephone: string | null
    credit_balance: number; advance_balance: number; change_balance: number
}

interface Props {
    shopId:           string
    vendeurId:        string
    vendeurNom:       string
    boutique:         { nom: string; devise: string; remise_max_pct: number; plan: string }
    entrepots:        { id: string; nom: string; est_defaut: boolean }[]
    entrepotDefautId: string
    clients:          Client[]
}

export type EtapePOS = 'caisse' | 'paiement' | 'recu'

export default function InterfacePOS({
                                         shopId, vendeurId, vendeurNom,
                                         boutique, entrepots, entrepotDefautId, clients,
                                     }: Props) {
    const [etape,             setEtape]             = useState<EtapePOS>('caisse')
    const [warehouseId,       setWarehouseId]        = useState(entrepotDefautId)
    const [clientSelectionne, setClientSelectionne]  = useState<Client | null>(null)
    const [panier,            setPanier]             = useState<LigneVente[]>([])
    const [remiseGlobalePct,  setRemiseGlobalePct]   = useState(0)
    const [noteVente,         setNoteVente]          = useState('')
    const [erreur,            setErreur]             = useState<string>()
    const [venteResultat,     setVenteResultat]      = useState<{
        sale_id: string; public_id: string
    } | null>(null)
    const [enAttente,         setEnAttente]          = useState(false)

    // ── Calculs ───────────────────────────────────────────────
    const montantBrut      = panier.reduce((acc, l) => acc + l.quantite * l.prix_unitaire, 0)
    const remiseLignes     = panier.reduce((acc, l) => acc + l.remise_val, 0)
    const remiseGlobaleVal = (montantBrut - remiseLignes) * remiseGlobalePct / 100
    const montantNet       = montantBrut - remiseLignes - remiseGlobaleVal
    const montantTVA       = panier.reduce((acc, l) => acc + l.montant_tva, 0)
    const montantTotal     = montantNet + montantTVA

    // ── Ajouter au panier ──────────────────────────────────────
    const ajouterAuPanier = useCallback((produit: any) => {
        setPanier(prev => {
            const existant = prev.findIndex(l => l.product_id === produit.id)
            if (existant >= 0) {
                const ligne        = prev[existant]
                const nouvelleQte  = ligne.quantite + 1
                if (nouvelleQte > ligne.stock_disponible) return prev
                const nouvelleLigne = {
                    ...ligne,
                    quantite:      nouvelleQte,
                    montant_ligne: nouvelleQte * ligne.prix_unitaire * (1 - ligne.remise_pct / 100),
                    montant_tva:   nouvelleQte * ligne.prix_unitaire * (ligne.tva_pct / 100),
                }
                return [...prev.slice(0, existant), nouvelleLigne, ...prev.slice(existant + 1)]
            }

            const stockDispo = produit.stock_levels[0]?.quantite ?? 0
            if (stockDispo <= 0) return prev // Règle S1

            const nouvelleLigne: LigneVente = {
                product_id:        produit.id,
                nom:               produit.nom,
                quantite:          1,
                prix_unitaire:     produit.prix_vente,
                remise_pct:        0,
                remise_val:        0,
                montant_ligne:     produit.prix_vente,
                tva_pct:           produit.tva_pct,
                montant_tva:       produit.prix_vente * produit.tva_pct / 100,
                imei:              '',
                note:              '',
                stock_disponible:  stockDispo,
                prix_minimum:      produit.prix_minimum,
                unite:             produit.unite,
                necessite_imei:    produit.necessite_imei ?? false,
                necessite_serie:   produit.necessite_serie ?? false,
            }
            return [...prev, nouvelleLigne]
        })
    }, [])

    const retirerDuPanier = useCallback((productId: string) => {
        setPanier(prev => prev.filter(l => l.product_id !== productId))
    }, [])

    const modifierLigne = useCallback((productId: string, champ: keyof LigneVente, valeur: number | string) => {
        setPanier(prev => prev.map(l => {
            if (l.product_id !== productId) return l
            const updated = { ...l, [champ]: valeur }
            if (champ === 'quantite' || champ === 'remise_pct') {
                const qte    = champ === 'quantite'   ? Number(valeur) : l.quantite
                const remPct = champ === 'remise_pct' ? Number(valeur) : l.remise_pct
                const remVal = l.prix_unitaire * qte * remPct / 100
                updated.remise_val    = remVal
                updated.montant_ligne = l.prix_unitaire * qte - remVal
                updated.montant_tva   = updated.montant_ligne * l.tva_pct / 100
            }
            return updated
        }))
    }, [])

    // ── Valider la vente ───────────────────────────────────────
    async function validerVente(
        paiements:       PaiementVente[],
        creditAccorde:   number,
        advanceUtilise:  number,
        changeUtilise:   number,
        creditUtilise:   number,
        garderMonnaie:   boolean,
        montantRecu:     number,
        montantRendu:    number,
    ) {
        // Validation IMEI
        const imeiManquant = panier.find(l => l.necessite_imei && !l.imei?.trim())
        if (imeiManquant) {
            setErreur(`IMEI manquant pour "${imeiManquant.nom}". Saisissez l'IMEI avant de valider.`)
            return
        }

        setEnAttente(true)
        setErreur(undefined)

        const res = await enregistrerVente({
            shop_id:            shopId,
            warehouse_id:       warehouseId,
            vendeur_id:         vendeurId,
            client_id:          clientSelectionne?.id ?? '',
            items:              panier,
            paiements,
            montant_brut:       montantBrut,
            remise_globale_pct: remiseGlobalePct,
            remise_globale_val: remiseGlobaleVal,
            montant_net:        montantNet,
            montant_tva:        montantTVA,
            montant_total:      montantTotal,
            montant_recu:       montantRecu,
            montant_rendu:      montantRendu,
            credit_utilise:     creditUtilise,
            advance_utilise:    advanceUtilise,
            change_utilise:     changeUtilise,
            credit_accorde:     creditAccorde,
            garder_monnaie:     garderMonnaie,
            note:               noteVente,
        })

        setEnAttente(false)

        if (res.erreur) { setErreur(res.erreur); return }

        setVenteResultat({ sale_id: res.sale_id!, public_id: res.public_id! })
        setEtape('recu')
    }

    // ── Nouvelle vente ─────────────────────────────────────────
    function nouvelleVente() {
        setPanier([])
        setClientSelectionne(null)
        setRemiseGlobalePct(0)
        setNoteVente('')
        setErreur(undefined)
        setVenteResultat(null)
        setEtape('caisse')
    }

    const entrepotActuel = entrepots.find(e => e.id === warehouseId)

    return (
        <div className="min-h-screen flex flex-col" style={{ background: '#f0f4ff' }}>

            {/* ── TOPBAR BLEU ROI ───────────────────────────────── */}
            <header
                style={{ background: 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)' }}
                className="flex items-center justify-between px-4 py-3 shadow-lg shrink-0"
            >
                {/* Gauche : retour + infos */}
                <div className="flex items-center gap-3">
                    <Link href="/admin/dashboard"
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                        <LayoutDashboard className="w-4 h-4 text-white" />
                    </Link>
                    <div className="w-px h-6 bg-white/20" />
                    <div className="flex items-center gap-2.5">
                        <div className="bg-white/20 p-1.5 rounded-lg">
                            <Store className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white leading-none">{boutique.nom}</p>
                            <p className="text-xs text-white/65 mt-0.5">
                                {vendeurNom} · {entrepotActuel?.nom}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Centre : étapes */}
                <div className="hidden sm:flex items-center gap-2">
                    {(['caisse','paiement','recu'] as EtapePOS[]).map((e, i) => {
                        const labels = ['Caisse','Paiement','Reçu']
                        const actif  = etape === e
                        const passe  = ['caisse','paiement','recu'].indexOf(etape) > i
                        return (
                            <div key={e} className="flex items-center gap-2">
                                {i > 0 && (
                                    <ChevronRight className={`w-3.5 h-3.5 ${passe ? 'text-white' : 'text-white/30'}`} />
                                )}
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    actif
                                        ? 'bg-white text-[#15335a] shadow-md'
                                        : passe
                                            ? 'bg-white/25 text-white'
                                            : 'bg-white/10 text-white/40'
                                }`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                      actif ? 'bg-[#15335a] text-white' : passe ? 'bg-white/50' : 'bg-white/20'
                  }`}>
                    {i + 1}
                  </span>
                                    {labels[i]}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Droite : total + entrepôt */}
                <div className="flex items-center gap-3">
                    {panier.length > 0 && etape === 'caisse' && (
                        <div className="flex items-center gap-2 bg-white/15 border border-white/20 px-3 py-1.5 rounded-full">
                            <ShoppingCart className="w-3.5 h-3.5 text-white" />
                            <span className="text-xs font-bold text-white">
                {panier.length} · {formatMontant(montantTotal, boutique.devise)}
              </span>
                        </div>
                    )}
                    {entrepots.length > 1 && etape === 'caisse' && (
                        <select
                            value={warehouseId}
                            onChange={e => { setWarehouseId(e.target.value); setPanier([]) }}
                            className="px-2.5 py-1.5 bg-white/15 border border-white/20 text-white text-xs font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30"
                        >
                            {entrepots.map(e => (
                                <option key={e.id} value={e.id} style={{ color: '#1a1a1a' }}>{e.nom}</option>
                            ))}
                        </select>
                    )}
                </div>
            </header>

            {/* ── CONTENU SELON ÉTAPE ──────────────────────────── */}
            {etape === 'caisse' && (
                <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">

                    {/* GAUCHE — Recherche produits */}
                    <div
                        className="lg:flex-1 flex flex-col min-h-[55vh] lg:min-h-0 overflow-hidden"
                        style={{ background: '#f0f4ff' }}
                    >
                        <RechercheProduitPOS
                            shopId={shopId}
                            warehouseId={warehouseId}
                            onAjouter={ajouterAuPanier}
                        />
                    </div>

                    {/* DROITE — Panier */}
                    <div className="w-full lg:w-96 flex flex-col bg-white shadow-xl overflow-hidden border-t lg:border-t-0 lg:border-l border-gray-200">
                        <PanierPOS
                            panier={panier}
                            clients={clients}
                            clientSelectionne={clientSelectionne}
                            onClientChange={setClientSelectionne}
                            remiseGlobalePct={remiseGlobalePct}
                            onRemiseChange={setRemiseGlobalePct}
                            remiseMax={boutique.remise_max_pct}
                            noteVente={noteVente}
                            onNoteChange={setNoteVente}
                            montantBrut={montantBrut}
                            montantNet={montantNet}
                            montantTVA={montantTVA}
                            montantTotal={montantTotal}
                            devise={boutique.devise}
                            erreur={erreur}
                            onModifierLigne={modifierLigne}
                            onRetirerLigne={retirerDuPanier}
                            onValider={() => setEtape('paiement')}
                        />
                    </div>
                </div>
            )}

            {etape === 'paiement' && (
                <PaiementPOS
                    montantTotal={montantTotal}
                    devise={boutique.devise}
                    client={clientSelectionne}
                    enAttente={enAttente}
                    erreur={erreur}
                    onValider={validerVente}
                    onRetour={() => setEtape('caisse')}
                />
            )}

            {etape === 'recu' && venteResultat && (
                <RecuPOS
                    saleId={venteResultat.sale_id}
                    publicId={venteResultat.public_id}
                    boutique={boutique}
                    onNouvelleVente={nouvelleVente}
                />
            )}
        </div>
    )
}