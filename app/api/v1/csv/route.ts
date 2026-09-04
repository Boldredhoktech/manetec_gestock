// app/api/v1/csv/route.ts
// ═══════════════════════════════════════════════════════════════
// L'export CSV des rapports qui sont des listes (décision D3).
//
// Une seule route pour les cinq : elles relisent EXACTEMENT les mêmes
// fonctions de données que les PDF. Deux chemins de lecture pour un
// même rapport, ce serait rouvrir la porte que le Lot 2 vient de
// fermer — un CSV qui finirait par ne plus dire la même chose que le
// document imprimé.
//
// Chaque rapport garde la permission que sa route PDF exige : un
// vendeur ne contourne pas le rapport de paie en demandant le CSV.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import {
    gardeRouteBoutique, periodeDepuisURL, estRefus,
} from '@/lib/auth/garde-route'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { versCSV, reponseCSV, type ColonneCSV } from '@/lib/csv/serialiser'
import {
    getDonneesRapportVentes, getDonneesRapportClients,
    getDonneesRapportMouvements, getDonneesFacturesImpayees,
    getDonneesRapportRetours,
} from '@/actions/rapports'

// Un code de base n'est pas une donnee lisible : « completee » ou
// « a_traiter » dans une colonne de tableur oblige le lecteur a
// deviner. Les memes libelles que sur le PDF.
const LIBELLE_STATUT_VENTE: Record<string, string> = {
    completee: 'Conclue', annulee: 'Annulée', remboursee: 'Remboursée',
}

const LIBELLE_REGLEMENT: Record<string, string> = {
    a_traiter: 'À traiter', avance: 'Porté en avance', avoir: 'Avoir émis',
    rembourse: 'Remboursé', sans_suite: 'Sans suite',
}

const PERMISSION_PAR_RAPPORT: Record<string, string> = {
    ventes:     PERMISSIONS.VENTES_VOIR,
    clients:    PERMISSIONS.CLIENTS_VOIR,
    mouvements: PERMISSIONS.STOCK_VOIR,
    impayees:   PERMISSIONS.FACTURES_VOIR,
    retours:    PERMISSIONS.VENTES_VOIR,
}

export async function GET(request: NextRequest) {
    const rapport = request.nextUrl.searchParams.get('rapport') ?? ''
    const permission = PERMISSION_PAR_RAPPORT[rapport]

    if (!permission) {
        return new NextResponse(
            "Ce rapport n'a pas d'export CSV : seules les listes en ont un.",
            { status: 400 },
        )
    }

    const garde = await gardeRouteBoutique({
        permissions: [PERMISSIONS.RAPPORTS_GENERER, permission],
        exigePlanRapports: true,
    })
    if (garde.refus) return garde.refus

    const periode = periodeDepuisURL(request.nextUrl.searchParams, 'debut-mois')
    if (estRefus(periode)) return periode

    const { shopId } = garde
    const { debut, fin } = periode

    try {
        switch (rapport) {
            case 'ventes': {
                const d = await getDonneesRapportVentes(shopId, debut, fin)
                const colonnes: ColonneCSV<typeof d.ventes[number]>[] = [
                    { entete: 'N° vente',  valeur: v => v.public_id },
                    { entete: 'Date',      valeur: v => v.date },
                    { entete: 'Client',    valeur: v => v.client_nom ?? 'Anonyme' },
                    { entete: 'Vendeur',   valeur: v => v.vendeur_nom },
                    { entete: 'Articles',  valeur: v => v.nb_articles },
                    { entete: 'Montant',   valeur: v => v.montant_total },
                    { entete: 'Statut',    valeur: v => LIBELLE_STATUT_VENTE[v.statut] ?? v.statut },
                ]
                return reponseCSV(versCSV(colonnes, d.ventes), `ventes-${debut}-${fin}.csv`)
            }

            case 'clients': {
                const d = await getDonneesRapportClients(shopId)
                const colonnes: ColonneCSV<typeof d.clients[number]>[] = [
                    { entete: 'Identifiant',       valeur: c => c.public_id },
                    { entete: 'Nom',               valeur: c => c.nom },
                    { entete: 'Téléphone',         valeur: c => c.telephone },
                    { entete: 'Crédit dû',         valeur: c => c.credit_balance },
                    { entete: 'Plafond de crédit', valeur: c => c.plafond_credit },
                    { entete: 'Au-delà du plafond', valeur: c => c.depasse_plafond },
                    { entete: 'Avance',            valeur: c => c.advance_balance },
                    { entete: 'Monnaie laissée',   valeur: c => c.change_balance },
                    { entete: 'Nb achats',         valeur: c => c.nb_achats },
                    { entete: 'CA total',          valeur: c => c.ca_total },
                ]
                return reponseCSV(versCSV(colonnes, d.clients), 'clients.csv')
            }

            case 'mouvements': {
                const d = await getDonneesRapportMouvements(shopId, debut, fin)
                const colonnes: ColonneCSV<typeof d.mouvements[number]>[] = [
                    { entete: 'N° mouvement', valeur: m => m.public_id },
                    { entete: 'Date',         valeur: m => m.date },
                    { entete: 'Type',         valeur: m => m.type_mouvement },
                    { entete: 'Produit',      valeur: m => m.produit_nom },
                    { entete: 'Entrepôt',     valeur: m => m.entrepot_nom },
                    { entete: 'Quantité',     valeur: m => m.quantite },
                    { entete: 'Avant',        valeur: m => m.quantite_avant },
                    { entete: 'Après',        valeur: m => m.quantite_apres },
                    { entete: 'Référence',    valeur: m => m.reference },
                    { entete: 'Valeur',       valeur: m => m.valeur },
                ]
                return reponseCSV(versCSV(colonnes, d.mouvements), `mouvements-${debut}-${fin}.csv`)
            }

            case 'impayees': {
                const d = await getDonneesFacturesImpayees(shopId)
                const colonnes: ColonneCSV<typeof d.factures[number]>[] = [
                    { entete: 'N° facture',      valeur: f => f.public_id },
                    { entete: 'Client',          valeur: f => f.client_nom },
                    { entete: 'Émise le',        valeur: f => f.date_facture },
                    { entete: 'Échéance',        valeur: f => f.date_echeance },
                    { entete: 'Jours de retard', valeur: f => f.jours_retard },
                    { entete: 'État',            valeur: f => f.etat },
                    { entete: 'Montant TTC',     valeur: f => f.montant_ttc },
                    { entete: 'Avoirs déduits',  valeur: f => f.montant_avoirs },
                    { entete: 'Reste dû',        valeur: f => f.montant_restant },
                ]
                return reponseCSV(versCSV(colonnes, d.factures), 'factures-impayees.csv')
            }

            case 'retours': {
                const d = await getDonneesRapportRetours(shopId, debut, fin)
                const colonnes: ColonneCSV<typeof d.retours[number]>[] = [
                    { entete: 'N° retour',    valeur: r => r.public_id },
                    { entete: 'Date',         valeur: r => r.date },
                    { entete: 'Vente',        valeur: r => r.vente },
                    { entete: 'Client',       valeur: r => r.client },
                    { entete: 'Entrepôt',     valeur: r => r.entrepot },
                    { entete: 'Motif',        valeur: r => r.motif },
                    { entete: 'Suite donnée', valeur: r => LIBELLE_REGLEMENT[r.reglement] ?? r.reglement },
                    { entete: 'Montant',      valeur: r => r.montant },
                    { entete: 'Note',         valeur: r => r.note },
                    { entete: 'Par',          valeur: r => r.par },
                ]
                return reponseCSV(versCSV(colonnes, d.retours), `retours-${debut}-${fin}.csv`)
            }
        }
    } catch (erreur) {
        const detail = erreur instanceof Error ? erreur.message : String(erreur)
        console.error(`[CSV] ${rapport} — échec :`, erreur)
        return new NextResponse(
            `L'export n'a pas pu être produit. ${detail}`,
            { status: 500 },
        )
    }

    return new NextResponse('Rapport inconnu.', { status: 400 })
}
