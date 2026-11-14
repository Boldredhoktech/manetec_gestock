'use client'

import { useState, useCallback, useEffect } from 'react'
import { enregistrerVente } from '@/actions/ventes'
import type { LigneVente, PaiementVente } from '@/actions/ventes'
import PanierPOS from '@/components/shop/pos/PanierPOS'
import RechercheProduitPOS from '@/components/shop/pos/RechercheProduitPOS'
import PaiementPOS from '@/components/shop/pos/PaiementPOS'
import RecuPOS from '@/components/shop/pos/RecuPOS'
import Link from 'next/link'
import {
    Store, ShoppingCart, ArrowLeft,
    ChevronRight, LayoutDashboard, AlertTriangle,
} from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import { useEtatPersistant, usePaniersEnAttente } from '@/hooks/usePanierPersistant'
import PaniersEnAttente from '@/components/shop/pos/PaniersEnAttente'
import { lireClient } from '@/actions/clients'
import { controleIdentifiants } from '@/lib/ventes/identifiants'
import OuvertureCaissePOS, { etatCaisse, type SessionCaissePOS } from '@/components/shop/pos/OuvertureCaissePOS'
import type { ClientChoisi } from '@/lib/clients/client-choisi'
import { getPlanLimites } from '@/lib/constants/plans'
import type { CaissePOS } from '@/lib/caisses/acces'
import Modale from '@/components/ui/Modale'
import FermetureCaisse from '@/components/shop/compta/FermetureCaisse'

type Client = ClientChoisi

interface Props {
    shopId:           string
    vendeurId:        string
    vendeurNom:       string
    boutique:         { nom: string; devise: string; remise_max_pct: number; plan: string }
    entrepots:        { id: string; nom: string; est_defaut: boolean }[]
    /** (mig 044) caisses utilisables par cette personne, et sa caisse. */
    caisses:          CaissePOS[]
    caisseInitialeId: string
    peutAutresEntrepots: boolean
    peutCreerClient:  boolean
    sessionsCaisse:   SessionCaissePOS[]
    jourCaisse:       string
    peutFermerCaisse: boolean
}

export type EtapePOS = 'caisse' | 'paiement' | 'recu'

export default function InterfacePOS({
                                         shopId, vendeurId, vendeurNom,
                                         boutique, entrepots, caisses, caisseInitialeId, peutAutresEntrepots, peutCreerClient,
                                         sessionsCaisse, jourCaisse, peutFermerCaisse,
                                     }: Props) {
    const [etape,             setEtape]             = useState<EtapePOS>('caisse')
    // La caisse choisie est retenue sur l'appareil (le comptoir garde sa caisse).
    const [caisseId,          setCaisseIdBrut]      = useState(caisseInitialeId)
    useEffect(() => {
        try {
            const memo = localStorage.getItem(`manetec:pos:caisse:${shopId}`)
            if (memo && memo !== caisseInitialeId && caisses.some(c => c.id === memo)) setCaisseIdBrut(memo)
        } catch { /* indisponible */ }
    }, [shopId, caisseInitialeId, caisses])
    const caisseActuelle = caisses.find(c => c.id === caisseId) ?? caisses[0]
    const warehouseId    = caisseActuelle.warehouse_id
    const nomEntrepot    = (id: string) => entrepots.find(e => e.id === id)?.nom ?? ''

    // Decision D4 : le panier vit dans le navigateur, jamais en base —
    // il n'engage rien tant qu'il n'est pas encaisse. Une coupure de
    // courant, frequente, ne l'efface plus.
    const [panier, setPanier, viderPanier] =
        useEtatPersistant<LigneVente[]>(`manetec:pos:panier:${shopId}`, [])
    const [clientSelectionne, setClientSelectionne] =
        useEtatPersistant<Client | null>(`manetec:pos:client:${shopId}`, null)
    const [remiseGlobalePct, setRemiseGlobalePct] =
        useEtatPersistant<number>(`manetec:pos:remise:${shopId}`, 0)
    const [noteVente, setNoteVente] =
        useEtatPersistant<string>(`manetec:pos:note:${shopId}`, '')

    function changerCaisse(id: string) {
        const nouvelle = caisses.find(c => c.id === id)
        if (!nouvelle) return
        if (nouvelle.warehouse_id !== warehouseId) setPanier([])
        setCaisseIdBrut(id)
        try { localStorage.setItem(`manetec:pos:caisse:${shopId}`, id) } catch { /* indisponible */ }
    }

    const enAttenteStore = usePaniersEnAttente<LigneVente>(shopId)
    const [erreur,            setErreur]             = useState<string>()
    const [venteResultat,     setVenteResultat]      = useState<{
        sale_id: string; public_id: string
    } | null>(null)
    const [enAttente,         setEnAttente]          = useState(false)
    const [fermetureVisible,  setFermetureVisible]   = useState(false)
    // Le plafond de credit avertit sans bloquer (decision D2 du module
    // Facturation) : la fonction SQL renvoyait deja ces messages, le
    // comptoir ne les lisait pas.
    const [avertissements,    setAvertissements]     = useState<string[]>([])

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

            // (mig 044) le stock d'ici ; à défaut, avec la permission, le
            // mieux fourni des autres entrepôts.
            const niveaux = (produit.stock_levels ?? []) as { quantite: number; warehouse_id?: string }[]
            const ici = niveaux.find(l => !l.warehouse_id || l.warehouse_id === warehouseId)?.quantite ?? 0
            let whLigne = warehouseId
            let stockDispo = ici
            if (ici <= 0 && peutAutresEntrepots) {
                const meilleur = niveaux
                    .filter(l => l.warehouse_id && l.warehouse_id !== warehouseId && l.quantite > 0)
                    .sort((a, b) => b.quantite - a.quantite)[0]
                if (meilleur?.warehouse_id) { whLigne = meilleur.warehouse_id; stockDispo = meilleur.quantite }
            }
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
                warehouse_id:      whLigne,
                entrepot_nom:      nomEntrepot(whLigne),
                stocks:            peutAutresEntrepots
                    ? niveaux.filter(l => l.warehouse_id).map(l => ({ warehouse_id: l.warehouse_id!, quantite: Number(l.quantite) }))
                    : undefined,
            }
            return [...prev, nouvelleLigne]
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [warehouseId, peutAutresEntrepots, entrepots])

    // (mig 044) la ligne sort d'un autre entrepôt.
    const changerEntrepotLigne = useCallback((productId: string, whId: string) => {
        setPanier(prev => prev.map(l => {
            if (l.product_id !== productId) return l
            const dispo = l.stocks?.find(st => st.warehouse_id === whId)?.quantite ?? 0
            const qte = Math.min(l.quantite, Math.max(dispo, 1))
            const remVal = l.prix_unitaire * qte * l.remise_pct / 100
            const montant = l.prix_unitaire * qte - remVal
            return { ...l, warehouse_id: whId, entrepot_nom: nomEntrepot(whId), stock_disponible: dispo,
                     quantite: qte, remise_val: remVal, montant_ligne: montant, montant_tva: montant * l.tva_pct / 100 }
        }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entrepots])

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
        const refusIdentifiant = verifierIdentifiants()
        if (refusIdentifiant) { setErreur(refusIdentifiant); setEtape('caisse'); return }

        setEnAttente(true)
        setErreur(undefined)

        const res = await enregistrerVente({
            shop_id:            shopId,
            caisse_id:          caisseActuelle.id,
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

        setAvertissements(res.avertissements ?? [])
        setVenteResultat({ sale_id: res.sale_id!, public_id: res.public_id! })
        setEtape('recu')
    }

    // IMEI / numéros de série : un par appareil, contrôlé AVANT le
    // paiement (le serveur le refait sur la fiche produit).
    function verifierIdentifiants(): string | null {
        for (const l of panier) {
            const refus = controleIdentifiants(l, l)
            if (refus) return refus
        }
        return null
    }

    function allerAuPaiement() {
        const refus = verifierIdentifiants()
        if (refus) { setErreur(refus); return }
        setErreur(undefined)
        setEtape('paiement')
    }

    // ── Mettre de côté / reprendre ─────────────────────────────
    // Servir un second client sans perdre le premier : le geste le plus
    // courant d'un comptoir, et il n'existait pas.
    function mettreDeCote() {
        if (panier.length === 0) return
        enAttenteStore.mettreEnAttente({
            libelle:   `${panier.length} article(s) · ${formatMontant(montantTotal)}`,
            lignes:    panier,
            clientId:  clientSelectionne?.id ?? null,
            clientNom: clientSelectionne?.nom ?? null,
            remisePct: remiseGlobalePct,
            note:      noteVente,
        })
        viderPanier()
        setClientSelectionne(null)
        setRemiseGlobalePct(0)
        setNoteVente('')
        setErreur(undefined)
    }

    async function reprendrePanier(id: string) {
        const repris = enAttenteStore.reprendre(id)
        if (!repris) return
        setPanier(repris.lignes)
        setRemiseGlobalePct(repris.remisePct)
        setNoteVente(repris.note)
        setClientSelectionne(null)
        setEtape('caisse')
        // Les soldes ont pu changer pendant que le panier attendait.
        if (repris.clientId) setClientSelectionne(await lireClient(repris.clientId))
    }

    // ── Nouvelle vente ─────────────────────────────────────────
    function nouvelleVente() {
        viderPanier()
        setClientSelectionne(null)
        setRemiseGlobalePct(0)
        setNoteVente('')
        setErreur(undefined)
        setAvertissements([])
        setVenteResultat(null)
        setEtape('caisse')
    }

    const caisse = etatCaisse(sessionsCaisse, caisseActuelle.id, jourCaisse)
    const sessionOuverte = sessionsCaisse.find(s => s.compte_id === caisseActuelle.id && s.statut === 'ouverte')

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>

            {/* ── TOPBAR BLEU ROI ───────────────────────────────── */}
            <header
                style={{ background: 'var(--nav)' }}
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
                                {vendeurNom} · {caisseActuelle.nom}
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
                                        ? 'bg-card text-[var(--primary-strong)] shadow-md'
                                        : passe
                                            ? 'bg-white/25 text-white'
                                            : 'bg-white/10 text-white/40'
                                }`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                      actif ? 'bg-primary text-white' : passe ? 'bg-white/50' : 'bg-white/20'
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
                    {/* (mig 044) la caissière ferme sa caisse et verse à la principale */}
                    {caisse.etat === 'ouverte' && sessionOuverte && etape === 'caisse' && panier.length === 0 && (
                        <button type="button" onClick={() => setFermetureVisible(true)}
                                className="px-2.5 py-1.5 bg-white/15 border border-white/20 text-white text-xs font-semibold rounded-lg hover:bg-white/25">
                            Fermer la caisse
                        </button>
                    )}
                    {caisses.length > 1 && etape === 'caisse' && (
                        <select
                            value={caisseActuelle.id}
                            onChange={e => changerCaisse(e.target.value)}
                            aria-label="Caisse"
                            className="max-w-[46vw] px-2.5 py-1.5 bg-white/15 border border-white/20 text-white text-xs font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30"
                        >
                            {caisses.map(c => (
                                <option key={c.id} value={c.id} style={{ color: '#1a1a1a' }}>{c.nom}</option>
                            ))}
                        </select>
                    )}
                </div>
            </header>

            {sessionOuverte && (
                <Modale ouvert={fermetureVisible} onFermer={() => setFermetureVisible(false)}
                        titre={`Fermer ${caisseActuelle.nom}`}
                        description="Comptez le tiroir ; l'argent peut être versé à la caisse principale.">
                    {fermetureVisible && (
                        <FermetureCaisse sessionId={sessionOuverte.id} devise={boutique.devise}
                                         onFini={() => setFermetureVisible(false)} />
                    )}
                </Modale>
            )}

            {/* ── CONTENU SELON ÉTAPE ──────────────────────────── */}
            {etape === 'caisse' && caisse.etat !== 'ouverte' && (
                <OuvertureCaissePOS
                    etat={caisse}
                    caisseId={caisseActuelle.id}
                    entrepotNom={`${caisseActuelle.nom} · ${caisseActuelle.entrepot}`}
                    devise={boutique.devise}
                    peutFermerCaisse={peutFermerCaisse}
                />
            )}

            {etape === 'caisse' && caisse.etat === 'ouverte' && (
                <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">

                    {/* GAUCHE — Recherche produits */}
                    <div
                        className="lg:flex-1 flex flex-col min-h-[55vh] lg:min-h-0 overflow-hidden"
                        style={{ background: 'var(--background)' }}
                    >
                        <PaniersEnAttente
                            paniers={enAttenteStore.paniers}
                            onReprendre={reprendrePanier}
                            onRetirer={enAttenteStore.retirer}
                            onMettreDeCote={mettreDeCote}
                            panierCourantVide={panier.length === 0}
                        />
                        <RechercheProduitPOS
                            warehouseId={warehouseId}
                            tousEntrepots={peutAutresEntrepots && entrepots.length > 1}
                            entrepots={entrepots}
                            afficherImages={getPlanLimites(boutique.plan).images_produits}
                            onAjouter={ajouterAuPanier}
                        />
                    </div>

                    {/* DROITE — Panier */}
                    <div className="w-full lg:w-96 flex flex-col bg-card shadow-xl overflow-hidden border-t lg:border-t-0 lg:border-l border-border">
                        <PanierPOS
                            panier={panier}
                            peutCreerClient={peutCreerClient}
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
                            onValider={allerAuPaiement}
                            warehouseCaisse={warehouseId}
                            entrepots={entrepots}
                            onChangerEntrepot={peutAutresEntrepots ? changerEntrepotLigne : undefined}
                        />
                    </div>
                </div>
            )}

            {etape === 'paiement' && (
                <PaiementPOS
                    montantTotal={montantTotal}
                    caisseId={caisseActuelle.id}
                    devise={boutique.devise}
                    client={clientSelectionne}
                    enAttente={enAttente}
                    erreur={erreur}
                    onValider={validerVente}
                    onRetour={() => setEtape('caisse')}
                />
            )}

            {etape === 'recu' && venteResultat && (
                <div className="flex-1 flex flex-col overflow-auto">
                    {avertissements.length > 0 && (
                        <div className="max-w-lg mx-auto w-full px-4 pt-4">
                            {avertissements.map((a, i) => (
                                <div key={i}
                                     className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-2xl text-sm text-amber-800">
                                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <span>{a}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <RecuPOS
                        saleId={venteResultat.sale_id}
                        publicId={venteResultat.public_id}
                        boutique={boutique}
                        onNouvelleVente={nouvelleVente}
                    />
                </div>
            )}
        </div>
    )
}