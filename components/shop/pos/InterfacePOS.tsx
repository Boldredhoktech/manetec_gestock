'use client'

import { useState, useCallback } from 'react'
import { enregistrerVente, rechercherProduitsPOS } from '@/actions/ventes'
import type { LigneVente, PaiementVente } from '@/actions/ventes'
import PanierPOS from '@/components/shop/pos/PanierPOS'
import RechercheProduitPOS from '@/components/shop/pos/RechercheProduitPOS'
import PaiementPOS from '@/components/shop/pos/PaiementPOS'
import RecuPOS from '@/components/shop/pos/RecuPOS'
import { Store, ShoppingCart, Receipt } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

interface Client {
    id: string
    public_id: string
    nom: string
    telephone: string | null
    credit_balance: number
    advance_balance: number
    change_balance: number
}

interface Props {
    shopId:          string
    vendeurId:       string
    vendeurNom:      string
    boutique:        { nom: string; devise: string; remise_max_pct: number; plan: string }
    entrepots:       { id: string; nom: string; est_defaut: boolean }[]
    entrepotDefautId: string
    clients:         Client[]
}

export type EtapePOS = 'caisse' | 'paiement' | 'recu'

export default function InterfacePOS({
                                         shopId, vendeurId, vendeurNom,
                                         boutique, entrepots, entrepotDefautId, clients,
                                     }: Props) {
    const [etape, setEtape] = useState<EtapePOS>('caisse')
    const [warehouseId, setWarehouseId] = useState(entrepotDefautId)
    const [clientSelectionne, setClientSelectionne] = useState<Client | null>(null)
    const [panier, setPanier] = useState<LigneVente[]>([])
    const [remiseGlobalePct, setRemiseGlobalePct] = useState(0)
    const [noteVente, setNoteVente] = useState('')
    const [erreur, setErreur] = useState<string>()
    const [venteResultat, setVenteResultat] = useState<{
        sale_id: string; public_id: string
    } | null>(null)
    const [enAttente, setEnAttente] = useState(false)

    // ── Calculs ────────────────────────────────────────────────
    const montantBrut = panier.reduce((acc, l) => acc + l.quantite * l.prix_unitaire, 0)
    const remiseLignes = panier.reduce((acc, l) => acc + l.remise_val, 0)
    const remiseGlobaleVal = (montantBrut - remiseLignes) * remiseGlobalePct / 100
    const montantNet = montantBrut - remiseLignes - remiseGlobaleVal
    const montantTVA = panier.reduce((acc, l) => acc + l.montant_tva, 0)
    const montantTotal = montantNet + montantTVA

    // ── Ajouter produit au panier ──────────────────────────────
    const ajouterAuPanier = useCallback((produit: {
        id: string; nom: string; prix_vente: number;
        prix_minimum: number | null; tva_pct: number;
        remise_max_pct: number | null; unite: string;
        stock_levels: { quantite: number }[]
    }) => {
        setPanier(prev => {
            const existant = prev.findIndex(l => l.product_id === produit.id)
            if (existant >= 0) {
                const ligne = prev[existant]
                const nouvelleQte = ligne.quantite + 1
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
                product_id:       produit.id,
                nom:              produit.nom,
                quantite:         1,
                prix_unitaire:    produit.prix_vente,
                remise_pct:       0,
                remise_val:       0,
                montant_ligne:    produit.prix_vente,
                tva_pct:          produit.tva_pct,
                montant_tva:      produit.prix_vente * produit.tva_pct / 100,
                imei:             '',
                note:             '',
                stock_disponible: stockDispo,
                prix_minimum:     produit.prix_minimum,
                unite:            produit.unite,
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
                const qte     = champ === 'quantite' ? Number(valeur) : l.quantite
                const remPct  = champ === 'remise_pct' ? Number(valeur) : l.remise_pct
                const remVal  = l.prix_unitaire * qte * remPct / 100
                updated.remise_val    = remVal
                updated.montant_ligne = l.prix_unitaire * qte - remVal
                updated.montant_tva   = updated.montant_ligne * l.tva_pct / 100
            }
            return updated
        }))
    }, [])

    // ── Valider la vente ───────────────────────────────────────
    async function validerVente(
        paiements: PaiementVente[],
        creditAccorde: number,
        advanceUtilise: number,
        changeUtilise: number,
        creditUtilise: number,
        garderMonnaie: boolean,
        montantRecu: number,
        montantRendu: number,
    ) {
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

        if (res.erreur) {
            setErreur(res.erreur)
            return
        }

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

    // ── Rendu ──────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background flex flex-col">

            {/* Header POS */}
            <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="bg-primary/10 p-1.5 rounded-lg">
                        <Store className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-foreground leading-none">
                            {boutique.nom}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {vendeurNom} · {entrepots.find(e => e.id === warehouseId)?.nom}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {panier.length > 0 && etape === 'caisse' && (
                        <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-medium">
                            <ShoppingCart className="w-3.5 h-3.5" />
                            {panier.length} article(s) · {formatMontant(montantTotal, boutique.devise)}
                        </div>
                    )}
                    {entrepots.length > 1 && etape === 'caisse' && (
                        <select
                            value={warehouseId}
                            onChange={e => {
                                setWarehouseId(e.target.value)
                                setPanier([])
                            }}
                            className="px-2 py-1.5 bg-background border border-input rounded-lg text-xs focus:outline-none"
                        >
                            {entrepots.map(e => (
                                <option key={e.id} value={e.id}>{e.nom}</option>
                            ))}
                        </select>
                    )}
                </div>
            </header>

            {/* Contenu selon l'étape */}
            {etape === 'caisse' && (
                <div className="flex-1 flex overflow-hidden">

                    {/* Gauche : Recherche produits */}
                    <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
                        <RechercheProduitPOS
                            shopId={shopId}
                            warehouseId={warehouseId}
                            onAjouter={ajouterAuPanier}
                        />
                    </div>

                    {/* Droite : Panier */}
                    <div className="w-96 flex flex-col overflow-hidden">
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