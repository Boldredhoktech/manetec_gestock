// ═══════════════════════════════════════════════════════════════
// PAS de directive 'use server' ici — et ce n'est pas un oubli.
//
// Ces fonctions ne sont appelées que par les routes PDF (app/api/v1/pdf)
// et jamais depuis le navigateur. Tant que le fichier portait
// 'use server', chacune était publiée comme Server Action, donc
// appelable par requête directe — et comme toutes prennent `shopId` en
// argument sans vérifier qui appelle, n'importe quelle boutique pouvait
// lire le chiffre d'affaires, les salaires et les dettes d'une autre.
//
// L'autorisation est appliquée par `gardeRouteBoutique`
// (lib/auth/garde-route.ts), qui fournit aussi le shop_id : il vient
// TOUJOURS de la session, jamais du client.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin'
import {
    bornesDuMois, bornesInstant, horodatageBoutique,
    DECALAGE_BOUTIQUE_HEURES, MOIS_FR, MOIS_FR_COURT,
} from '@/lib/dates/periode'
import { etatFacture } from '@/lib/facturation/etat-facture'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// Le décalage de la boutique, tel que les fonctions SQL l'attendent.
const DECALAGE_SQL = `${DECALAGE_BOUTIQUE_HEURES} hours`

// Formate une date ISO (AAAA-MM-JJ) en JJ/MM/AAAA pour les périodes de rapport
function formatFR(iso: string): string {
    try {
        const [a, m, j] = iso.split('-')
        return j && m && a ? `${j}/${m}/${a}` : iso
    } catch {
        return iso
    }
}

// ── Données rapport ventes ────────────────────────────────────
export async function getDonneesRapportVentes(
    shopId: string,
    debut:  string,
    fin:    string
) {
    const adminClient = createAdminClient()

    const { data: boutique } = await adminClient
        .from('shops')
        .select('nom, adresse, ville, telephone_1, ifu, devise, logo_url')
        .eq('id', shopId)
        .single()

    const instantsVentes = bornesInstant(debut, fin)

    const { data: ventes } = await adminClient
        .from('sales')
        .select(`
      id, public_id, statut, montant_total, created_at,
      credit_accorde, credit_utilise, advance_utilise, change_utilise,
      clients(nom),
      shop_users(nom_complet),
      sale_items(id),
      sale_payments(moyen_paiement, montant)
    `)
        .eq('shop_id', shopId)
        .gte('created_at', instantsVentes.de)
        .lt('created_at', instantsVentes.avant)
        .order('created_at', { ascending: false })

    // Ventes sur facture A4 = paiements de factures encaissés sur la période
    // (base trésorerie, cohérente avec le rapport Profits & Pertes).
    const { data: paiementsFacture } = await adminClient
        .from('facture_payments')
        .select(`
      montant, moyen_paiement, date_paiement,
      factures(public_id, clients(nom))
    `)
        .eq('shop_id', shopId)
        // Un reglement annule n'a jamais ete encaisse (Lot 2 Facturation).
        .eq('est_annule', false)
        .gte('date_paiement', debut)
        .lte('date_paiement', fin)
        .order('date_paiement', { ascending: false })

    // Top produits
    const { data: topProduits } = await adminClient
        .from('sale_items')
        .select(`
      quantite, montant_ligne,
      products(nom),
      sales!inner(shop_id, created_at, statut)
    `)
        .eq('sales.shop_id', shopId)
        .eq('sales.statut', 'completee')
        .gte('sales.created_at', instantsVentes.de)
        .lt('sales.created_at', instantsVentes.avant)

    // Agréger top produits
    const aggregatProduits: Record<string, { nom: string; quantite: number; ca: number }> = {}
    topProduits?.forEach(item => {
        const nom = (item.products as any)?.nom ?? 'Inconnu'
        if (!aggregatProduits[nom]) aggregatProduits[nom] = { nom, quantite: 0, ca: 0 }
        aggregatProduits[nom].quantite += item.quantite
        aggregatProduits[nom].ca += item.montant_ligne
    })
    const topProduitsArr = Object.values(aggregatProduits)
        .sort((a, b) => b.ca - a.ca)
        .slice(0, 10)

    // Par vendeur
    const parVendeur: Record<string, { nom: string; nb_ventes: number; ca: number }> = {}
    ventes?.filter(v => v.statut === 'completee').forEach(v => {
        const nom = (v.shop_users as any)?.nom_complet ?? 'Inconnu'
        if (!parVendeur[nom]) parVendeur[nom] = { nom, nb_ventes: 0, ca: 0 }
        parVendeur[nom].nb_ventes++
        parVendeur[nom].ca += v.montant_total
    })

    // Par moyen paiement — inclut les encaissements POS ET les paiements de
    // factures (vue trésorerie complète des entrées d'argent).
    const parMoyen: Record<string, { moyen: string; montant: number }> = {}
    const ajouterMoyen = (moyen: string, montant: number) => {
        if (!parMoyen[moyen]) parMoyen[moyen] = { moyen, montant: 0 }
        parMoyen[moyen].montant += montant
    }
    const ventesCompletees = ventes?.filter(v => v.statut === 'completee') ?? []

    // Une vente annulee n'a rien encaisse : elle sort de la ventilation
    // comme elle sortait deja du chiffre d'affaires trois lignes plus bas.
    // Le total des moyens depassait donc le CA annonce sur la meme page.
    ventesCompletees.forEach(v => {
        (v.sale_payments as any[])?.forEach((p: any) => ajouterMoyen(p.moyen_paiement, p.montant))
    })
    paiementsFacture?.forEach((p: any) => ajouterMoyen(p.moyen_paiement, p.montant))

    // Decision D1 : le rapport dit les DEUX chiffres, cote a cote.
    // « Facture » = ce que la boutique a vendu ; « encaisse » = ce qui est
    // reellement entre. La regle qui les relie n'est PAS ecrite ici : elle
    // est ecrite une seule fois, dans ca_periode() (migration 031), et le
    // tableau de bord comme le compte de resultat lisent la meme.
    const { data: agregat } = await adminClient
        .rpc('ca_periode', {
            p_shop_id:  shopId,
            p_debut:    debut,
            p_fin:      fin,
            p_decalage: DECALAGE_SQL,
        })
        .single()

    const ca = (agregat ?? {}) as Record<string, number>
    const caPosFacture   = Number(ca.ca_facture      ?? 0)
    const encaissePos    = Number(ca.encaisse_pos    ?? 0)
    const creditAccorde  = Number(ca.credit_accorde  ?? 0)
    const soldesUtilises = Number(ca.soldes_utilises ?? 0)
    const rembArdoise    = Number(ca.remb_ardoise    ?? 0)

    // Ventes sur facture (encaissements)
    const ventesFacture = (paiementsFacture ?? []).map((p: any) => ({
        facture_public_id: (p.factures as any)?.public_id ?? '—',
        date:              formatFR(p.date_paiement),
        client_nom:        ((p.factures as any)?.clients as any)?.nom ?? null,
        moyen:             p.moyen_paiement,
        montant:           p.montant,
    }))
    const caFactures = ventesFacture.reduce((a, v) => a + v.montant, 0)

    return {
        boutique: boutique!,
        periode:  `Du ${formatFR(debut)} au ${formatFR(fin)}`,
        genere_le: horodatageBoutique(),
        total_ventes: ventesCompletees.length,
        // Ce que la boutique a vendu
        ca_pos_facture:  caPosFacture,
        // Ce qui est reellement entre, et ce qui explique la difference
        encaisse_pos:    encaissePos,
        credit_accorde:  creditAccorde,
        soldes_utilises: soldesUtilises,
        remb_ardoise:    rembArdoise,
        ca_factures:     caFactures,
        encaisse_total:  encaissePos + caFactures,
        ca_moyen:        ventesCompletees.length > 0 ? caPosFacture / ventesCompletees.length : 0,
        nb_paiements_factures: ventesFacture.length,
        ventes: (ventes ?? []).map(v => ({
            public_id:     v.public_id,
            date:          format(new Date(v.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
            client_nom:    (v.clients as any)?.nom ?? null,
            vendeur_nom:   (v.shop_users as any)?.nom_complet ?? 'Inconnu',
            montant_total: v.montant_total,
            statut:        v.statut,
            nb_articles:   (v.sale_items as any[])?.length ?? 0,
        })),
        ventes_facture: ventesFacture,
        top_produits: topProduitsArr,
        par_vendeur:  Object.values(parVendeur),
        par_moyen:    Object.values(parMoyen),
    }
}

// ── Données rapport clients ───────────────────────────────────
export async function getDonneesRapportClients(shopId: string) {
    const adminClient = createAdminClient()

    const { data: boutique } = await adminClient
        .from('shops').select('nom, adresse, ville, telephone_1, ifu, devise, logo_url').eq('id', shopId).single()

    // L'encours d'un client — son solde, SON PLAFOND, ses achats et son
    // historique d'operations — se lit a un seul endroit : clients_encours()
    // (migration 031). Le rapport affichait le credit du sans jamais le
    // situer face a la limite creee au Lot 3 Facturation, alors que c'est
    // la question qu'on se pose en ouvrant ce document.
    const { data: encours } = await adminClient
        .rpc('clients_encours', { p_shop_id: shopId })

    const clientsAvecStats = ((encours ?? []) as any[]).map(c => ({
        public_id:       c.public_id,
        nom:             c.nom,
        telephone:       c.telephone,
        credit_balance:  Number(c.credit_balance  ?? 0),
        advance_balance: Number(c.advance_balance ?? 0),
        change_balance:  Number(c.change_balance  ?? 0),
        plafond_credit:  Number(c.plafond_credit  ?? 0),
        depasse_plafond: Boolean(c.depasse_plafond),
        nb_achats:       Number(c.nb_achats     ?? 0),
        ca_total:        Number(c.ca_total      ?? 0),
        nb_operations:   Number(c.nb_operations ?? 0),
    }))

    return {
        boutique:          boutique!,
        genere_le:         horodatageBoutique(),
        total_clients:     clientsAvecStats.length,
        clients_en_credit: clientsAvecStats.filter(c => c.credit_balance > 0).length,
        clients_hors_plafond: clientsAvecStats.filter(c => c.depasse_plafond).length,
        total_credit_du:   clientsAvecStats.reduce((a, c) => a + c.credit_balance, 0),
        total_avances:     clientsAvecStats.reduce((a, c) => a + c.advance_balance, 0),
        clients:           clientsAvecStats,
    }
}

// ── Données reçu thermique ────────────────────────────────────
export async function getDonneesRecu(saleId: string, shopId: string) {
    const adminClient = createAdminClient()

    const [{ data: vente }, { data: boutique }] = await Promise.all([
        adminClient.from('sales').select(`
      public_id, created_at,
      montant_brut, remise_globale_val, montant_net,
      montant_tva, montant_total, montant_recu, montant_rendu,
      credit_accorde, credit_utilise, advance_utilise,
      clients(nom),
      shop_users(nom_complet),
      sale_items(
        quantite, prix_unitaire, remise_pct, montant_ligne, imei, tva_pct,
        products(nom, unite)
      ),
      sale_payments(moyen_paiement, montant, reference)
    `).eq('id', saleId).eq('shop_id', shopId).single(),
        adminClient.from('shops').select(
            'nom, adresse, ville, telephone_1, telephone_2, email, ifu, rccm, devise, message_recu_thermique'
        ).eq('id', shopId).single(),
    ])

    if (!vente || !boutique) return null

    return {
        boutique: {
            nom:           boutique.nom,
            adresse:       boutique.adresse,
            ville:         boutique.ville,
            telephone_1:   boutique.telephone_1,
            telephone_2:   boutique.telephone_2,
            email:         boutique.email,
            ifu:           boutique.ifu,
            rccm:          boutique.rccm,
            devise:        boutique.devise,
            message_recu:  boutique.message_recu_thermique,
        },
        vente: {
            public_id:          vente.public_id,
            date:               format(new Date(vente.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
            vendeur_nom:        (vente.shop_users as any)?.nom_complet ?? 'Vendeur',
            client_nom:         (vente.clients as any)?.nom ?? null,
            montant_brut:       vente.montant_brut,
            remise_globale_val: vente.remise_globale_val,
            montant_net:        vente.montant_net,
            montant_tva:        vente.montant_tva,
            montant_total:      vente.montant_total,
            montant_recu:       vente.montant_recu,
            montant_rendu:      vente.montant_rendu,
            credit_accorde:     vente.credit_accorde,
            credit_utilise:     vente.credit_utilise,
            advance_utilise:    vente.advance_utilise,
        },
        articles: ((vente.sale_items as any[]) ?? []).map((item: any) => ({
            nom:           item.products?.nom ?? 'Produit',
            quantite:      item.quantite,
            unite:         item.products?.unite ?? 'pièce',
            prix_unitaire: item.prix_unitaire,
            remise_pct:    item.remise_pct,
            montant_ligne: item.montant_ligne,
            imei:          item.imei ?? '',
        })),
        paiements: ((vente.sale_payments as any[]) ?? []).map((p: any) => ({
            moyen_paiement: p.moyen_paiement,
            montant:        p.montant,
            reference:      p.reference ?? '',
        })),
    }
}

// ── Données facture PDF ───────────────────────────────────────
export async function getDonneesFacturePDF(factureId: string, shopId: string) {
    const adminClient = createAdminClient()

    const [{ data: facture }, { data: boutique }] = await Promise.all([
        adminClient.from('factures').select(`
      public_id, statut, date_facture, date_echeance, objet, note_client,
      montant_ht, remise_val, remise_pct, montant_tva, montant_ttc,
      montant_paye, montant_restant,
      clients(nom, adresse, telephone, email, ifu, rccm, ville, pays),
      facture_items(designation, quantite, prix_unitaire, remise_pct, tva_pct, montant_ttc)
    `).eq('id', factureId).eq('shop_id', shopId).single(),
        adminClient.from('shops').select(
            'nom, adresse, ville, telephone_1, email, ifu, rccm, devise, message_pied_facture, logo_url'
        ).eq('id', shopId).single(),
    ])

    if (!facture || !boutique) return null

    return {
        boutique: {
            nom:                  boutique.nom,
            adresse:              boutique.adresse,
            ville:                boutique.ville,
            telephone_1:          boutique.telephone_1,
            email:                boutique.email,
            ifu:                  boutique.ifu,
            rccm:                 boutique.rccm,
            devise:               boutique.devise,
            message_pied_facture: boutique.message_pied_facture,
            logo_url:             boutique.logo_url,
        },
        facture: {
            public_id:       facture.public_id,
            date_facture:    facture.date_facture,
            date_echeance:   facture.date_echeance,
            statut:          facture.statut,
            objet:           facture.objet,
            note_client:     facture.note_client,
            montant_ht:      facture.montant_ht,
            remise_val:      facture.remise_val,
            remise_pct:      facture.remise_pct,
            montant_tva:     facture.montant_tva,
            montant_ttc:     facture.montant_ttc,
            montant_paye:    facture.montant_paye,
            montant_restant: facture.montant_restant,
        },
        client: (facture.clients as any) ?? null,
        lignes: ((facture.facture_items as any[]) ?? []),
        genere_le: horodatageBoutique(),
    }
}

// ── Données rapport stock ─────────────────────────────────────
export async function getDonneesRapportStock(
    shopId:      string,
    warehouseId: string | null
) {
    const adminClient = createAdminClient()

    const { data: boutique } = await adminClient
        .from('shops').select('nom, adresse, ville, telephone_1, ifu, devise, logo_url').eq('id', shopId).single()

    const { data: entrepots } = await adminClient
        .from('warehouses').select('id, nom').eq('shop_id', shopId)

    const [{ data: produits }, { data: valorisation }] = await Promise.all([
        adminClient
            .from('products')
            .select(`
      id, public_id, nom, unite, prix_achat, prix_vente, seuil_alerte,
      categories(nom),
      stock_levels(quantite, warehouse_id, warehouses(nom))
    `)
            .eq('shop_id', shopId)
            .eq('est_actif', true)
            .order('nom'),
        // La valeur du stock multipliait les quantites par le prix
        // d'achat COURANT : apres une hausse fournisseur, elle bondissait
        // sans qu'un seul article soit entre. valeur_stock() (migration
        // 031) retient le dernier prix reellement paye a la reception, et
        // dit sur quelle base chaque ligne est valorisee.
        adminClient.rpc('valeur_stock', {
            p_shop_id:      shopId,
            p_warehouse_id: warehouseId,
        }),
    ])

    const prixReel: Record<string, { prix: number; base: string; valeur: number }> = {}
    ;((valorisation ?? []) as any[]).forEach(l => {
        prixReel[`${l.product_id}|${l.warehouse_id}`] = {
            prix:   Number(l.prix_unitaire ?? 0),
            base:   String(l.base_prix ?? 'courant'),
            valeur: Number(l.valeur ?? 0),
        }
    })

    const entrepotNom = warehouseId
        ? entrepots?.find(e => e.id === warehouseId)?.nom ?? 'Tous les entrepôts'
        : 'Tous les entrepôts'

    const produitsFormates = (produits ?? []).flatMap(p => {
        const niveaux = (p.stock_levels as any[]) ?? []
        const niveauxFiltres = warehouseId
            ? niveaux.filter((s: any) => s.warehouse_id === warehouseId)
            : niveaux

        return niveauxFiltres.map((s: any) => {
            const val = prixReel[`${p.id}|${s.warehouse_id}`]
            return {
                public_id:    p.public_id,
                nom:          p.nom,
                categorie:    (p.categories as any)?.nom ?? null,
                unite:        p.unite,
                prix_achat:   val?.prix ?? p.prix_achat,
                prix_courant: p.prix_achat,
                base_prix:    val?.base ?? 'courant',
                prix_vente:   p.prix_vente,
                stock:        s.quantite,
                valeur:       val?.valeur ?? s.quantite * p.prix_achat,
                seuil_alerte: p.seuil_alerte,
                en_alerte:    s.quantite <= p.seuil_alerte,
                entrepot:     (s.warehouses as any)?.nom ?? 'Inconnu',
            }
        })
    })

    const valeurStock = produitsFormates.reduce((acc, p) => acc + p.valeur, 0)

    return {
        boutique:           boutique!,
        entrepot_filtre:    entrepotNom,
        genere_le:          horodatageBoutique(),
        total_produits:     produitsFormates.length,
        produits_en_alerte: produitsFormates.filter(p => p.en_alerte).length,
        valeur_stock:       valeurStock,
        // Combien de lignes sont valorisees au prix courant faute d'une
        // reception connue : le document dit ce qu'il ne sait pas.
        lignes_prix_courant: produitsFormates.filter(p => p.base_prix === 'courant').length,
        produits:           produitsFormates,
    }
}

// ── Données rapport mouvements ────────────────────────────────
export async function getDonneesRapportMouvements(
    shopId: string,
    debut:  string,
    fin:    string
) {
    const adminClient = createAdminClient()

    const { data: boutique } = await adminClient
        .from('shops').select('nom, adresse, ville, telephone_1, ifu, logo_url').eq('id', shopId).single()

    const instantsMvt = bornesInstant(debut, fin)

    const { data: mouvements } = await adminClient
        .from('stock_movements')
        .select(`
      public_id, type_mouvement, quantite, quantite_avant, quantite_apres, created_at,
      reference_public_id,
      products(nom, prix_achat),
      warehouses(nom)
    `)
        .eq('shop_id', shopId)
        .gte('created_at', instantsMvt.de)
        .lt('created_at', instantsMvt.avant)
        .order('created_at', { ascending: false })

    const entrees    = ['entree_initiale','reception','retour_vente','transfert_entree','ajustement_positif']
    const sorties    = ['vente','retour_fournisseur','transfert_sortie','ajustement_negatif']
    const transferts = ['transfert_sortie','transfert_entree']

    // Le sens d'un mouvement vient de son type. Le type « inventaire »
    // va dans les deux sens : on le tranche sur la variation réelle du
    // stock. Avant, il n'était dans aucune liste — les écarts
    // d'inventaire s'affichaient sans jamais entrer dans les totaux.
    function sensDe(m: { type_mouvement: string; quantite_avant: number; quantite_apres: number }) {
        if (entrees.includes(m.type_mouvement)) return 1
        if (sorties.includes(m.type_mouvement)) return -1
        return Math.sign(m.quantite_apres - m.quantite_avant)
    }

    const lignes = (mouvements ?? []).map(m => {
        const sens = sensDe(m)
        const prix = (m.products as any)?.prix_achat ?? 0
        return {
            public_id:      m.public_id,
            reference:      m.reference_public_id ?? m.public_id,
            type_mouvement: m.type_mouvement,
            produit_nom:    (m.products as any)?.nom ?? 'Inconnu',
            entrepot_nom:   (m.warehouses as any)?.nom ?? 'Inconnu',
            quantite:       m.quantite,
            quantite_avant: m.quantite_avant,
            quantite_apres: m.quantite_apres,
            sens,
            valeur:         sens * m.quantite * prix,
            date:           format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
        }
    })

    return {
        boutique:          boutique!,
        periode:           `Du ${formatFR(debut)} au ${formatFR(fin)}`,
        genere_le:         horodatageBoutique(),
        total_entrees:     lignes.filter(l => l.sens > 0).length,
        total_sorties:     lignes.filter(l => l.sens < 0).length,
        total_transferts:  lignes.filter(l => transferts.includes(l.type_mouvement)).length,
        // Quantités et valorisation, pour que les totaux du rapport
        // soient rapprochables du stock.
        quantite_entree:   lignes.filter(l => l.sens > 0).reduce((a, l) => a + l.quantite, 0),
        quantite_sortie:   lignes.filter(l => l.sens < 0).reduce((a, l) => a + l.quantite, 0),
        valeur_nette:      lignes.reduce((a, l) => a + l.valeur, 0),
        mouvements:        lignes,
    }
}

// ── Données rapport fournisseurs ──────────────────────────────
// Avant : un annuaire de dettes, sans période, sans achats et sans
// paiements — d'où « des fournisseurs payés qui n'apparaissent pas
// dans les rapports ».
//
// Le solde d'un fournisseur vaut, par construction, la somme de ses
// achats moins la somme de ses règlements. On remonte donc le temps
// depuis le solde d'aujourd'hui pour reconstituer le solde à la fin
// puis au début de la période — ce qui donne un rapport juste même
// sur un mois clos depuis longtemps.
export async function getDonneesRapportFournisseurs(
    shopId: string,
    debut?: string,
    fin?: string
) {
    const adminClient = createAdminClient()

    const aujourdhui = format(new Date(), 'yyyy-MM-dd')
    const dateFin    = fin   || aujourdhui
    const dateDebut  = debut || format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')

    const { data: boutique } = await adminClient
        .from('shops').select('nom, adresse, ville, telephone_1, ifu, devise, logo_url').eq('id', shopId).single()

    // Note : solde_dû contient un caractère accentué qui casse le parser
    // de types Supabase. On caste en any[] pour contourner.
    const [{ data: fournisseursRaw }, { data: factures }, { data: paiements }] = await Promise.all([
        adminClient.from('suppliers')
            .select('id, public_id, nom, telephone, email, est_actif, solde_dû')
            .eq('shop_id', shopId)
            .order('nom'),
        adminClient.from('factures_fournisseurs')
            .select('supplier_id, statut, date_facture, date_echeance, montant_ttc, montant_restant, a_completer, public_id')
            .eq('shop_id', shopId)
            .neq('statut', 'annulee'),
        adminClient.from('supplier_payments')
            .select('supplier_id, montant, moyen_paiement, date_paiement, facture_id')
            .eq('shop_id', shopId),
    ])

    const fournisseurs = (fournisseursRaw ?? []) as any[]
    const toutesFactures = (factures ?? []) as any[]
    const tousPaiements  = (paiements ?? []) as any[]

    const dansPeriode = (d: string | null) => !!d && d >= dateDebut && d <= dateFin
    const apresFin    = (d: string | null) => !!d && d > dateFin

    const formates = fournisseurs.map(f => {
        const sesFactures = toutesFactures.filter(x => x.supplier_id === f.id)
        const sesPaiements = tousPaiements.filter(x => x.supplier_id === f.id)

        const achatsPeriode    = sesFactures.filter(x => dansPeriode(x.date_facture))
            .reduce((a, x) => a + Number(x.montant_ttc ?? 0), 0)
        const paiementsPeriode = sesPaiements.filter(x => dansPeriode(x.date_paiement))
            .reduce((a, x) => a + Number(x.montant ?? 0), 0)

        // Ce qui s'est passé APRÈS la période, pour remonter au solde de clôture.
        const achatsApres    = sesFactures.filter(x => apresFin(x.date_facture))
            .reduce((a, x) => a + Number(x.montant_ttc ?? 0), 0)
        const paiementsApres = sesPaiements.filter(x => apresFin(x.date_paiement))
            .reduce((a, x) => a + Number(x.montant ?? 0), 0)

        const soldeActuel   = Number(f['solde_dû'] ?? 0)
        const soldeCloture  = soldeActuel - achatsApres + paiementsApres
        const soldeOuverture = soldeCloture - achatsPeriode + paiementsPeriode

        const impayees = sesFactures.filter(x => Number(x.montant_restant ?? 0) > 0)
        const enRetard = impayees.filter(x => x.date_echeance && x.date_echeance < aujourdhui)

        const dates = (arr: any[], champ: string) => arr
            .map(x => x[champ] as string | null)
            .filter(Boolean)
            .sort()
            .pop() ?? null

        return {
            public_id:        f.public_id as string,
            nom:              f.nom as string,
            telephone:        f.telephone as string | null,
            email:            f.email as string | null,
            est_actif:        f.est_actif !== false,
            solde_ouverture:  soldeOuverture,
            achats:           achatsPeriode,
            paiements:        paiementsPeriode,
            solde_du:         soldeCloture,
            nb_factures:      sesFactures.filter(x => dansPeriode(x.date_facture)).length,
            nb_impayees:      impayees.length,
            nb_en_retard:     enRetard.length,
            montant_en_retard: enRetard.reduce((a, x) => a + Number(x.montant_restant ?? 0), 0),
            a_completer:      sesFactures.filter(x => x.a_completer).length,
            dernier_achat:    dates(sesFactures, 'date_facture'),
            dernier_paiement: dates(sesPaiements, 'date_paiement'),
        }
    })

    // Un fournisseur sans mouvement ni dette n'encombre pas le rapport.
    const retenus = formates.filter(f =>
        f.achats > 0 || f.paiements > 0 || f.solde_du > 0 || f.solde_ouverture > 0)

    const somme = (champ: keyof typeof formates[number]) =>
        retenus.reduce((a, f) => a + Number(f[champ] ?? 0), 0)

    return {
        boutique:                boutique!,
        periode:                 `Du ${formatFR(dateDebut)} au ${formatFR(dateFin)}`,
        genere_le:               horodatageBoutique(),
        total_fournisseurs:      fournisseurs.length,
        fournisseurs_mouvementes: retenus.length,
        total_achats:            somme('achats'),
        total_paiements:         somme('paiements'),
        total_ouverture:         somme('solde_ouverture'),
        total_dette:             somme('solde_du'),
        fournisseurs_avec_dette: retenus.filter(f => f.solde_du > 0).length,
        total_en_retard:         somme('montant_en_retard'),
        factures_a_completer:    somme('a_completer'),
        fournisseurs:            retenus.sort((a, b) => b.solde_du - a.solde_du),
    }
}

// ── Relevé d'un fournisseur ───────────────────────────────────
// Le document à envoyer en cas de litige : chaque pièce dans l'ordre,
// avec le solde qui court.
export async function getDonneesReleveFournisseur(
    supplierId: string,
    shopId: string,
    debut?: string,
    fin?: string
) {
    const adminClient = createAdminClient()

    const aujourdhui = format(new Date(), 'yyyy-MM-dd')
    const dateFin    = fin   || aujourdhui
    const dateDebut  = debut || format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd')

    const [{ data: boutique }, { data: fournisseur }, { data: factures }, { data: paiements }] =
        await Promise.all([
            adminClient.from('shops')
                .select('nom, adresse, ville, telephone_1, ifu, devise, logo_url').eq('id', shopId).single(),
            // Pas de solde_dû ici : le caractère accentué casse le parser
            // de types Supabase, et le relevé recalcule le solde ligne à
            // ligne de toute façon.
            adminClient.from('suppliers')
                .select('public_id, nom, telephone, email, adresse, ville')
                .eq('id', supplierId).eq('shop_id', shopId).single(),
            adminClient.from('factures_fournisseurs')
                .select('public_id, reference_fourn, date_facture, montant_ttc, montant_restant, statut, a_completer')
                .eq('shop_id', shopId).eq('supplier_id', supplierId).neq('statut', 'annulee'),
            adminClient.from('supplier_payments')
                .select('public_id, date_paiement, montant, moyen_paiement, reference, facture_id, factures_fournisseurs(public_id)')
                .eq('shop_id', shopId).eq('supplier_id', supplierId),
        ])

    const lignesFactures = (factures ?? []).map((f: any) => ({
        date:      f.date_facture as string,
        type:      'facture' as const,
        piece:     f.public_id as string,
        libelle:   f.a_completer
            ? 'Facture à compléter (créée par une réception)'
            : (f.reference_fourn ? `Facture fournisseur ${f.reference_fourn}` : 'Facture fournisseur'),
        debit:     Number(f.montant_ttc ?? 0),
        credit:    0,
    }))

    const lignesPaiements = (paiements ?? []).map((p: any) => {
        const facture = Array.isArray(p.factures_fournisseurs)
            ? p.factures_fournisseurs[0] : p.factures_fournisseurs
        return {
            date:    p.date_paiement as string,
            type:    'paiement' as const,
            piece:   p.public_id as string,
            libelle: facture?.public_id
                ? `Règlement de ${facture.public_id}${p.reference ? ` — ${p.reference}` : ''}`
                : `Règlement sur solde${p.reference ? ` — ${p.reference}` : ''}`,
            debit:   0,
            credit:  Number(p.montant ?? 0),
        }
    })

    const toutes = [...lignesFactures, ...lignesPaiements]
        .sort((a, b) => a.date.localeCompare(b.date))

    // Solde d'ouverture = tout ce qui précède la période.
    const avant = toutes.filter(l => l.date < dateDebut)
    const soldeOuverture = avant.reduce((a, l) => a + l.debit - l.credit, 0)

    let courant = soldeOuverture
    const lignes = toutes
        .filter(l => l.date >= dateDebut && l.date <= dateFin)
        .map(l => {
            courant += l.debit - l.credit
            return {
                ...l,
                date_fr: formatFR(l.date),
                solde:   courant,
            }
        })

    return {
        boutique:        boutique!,
        fournisseur:     fournisseur!,
        periode:         `Du ${formatFR(dateDebut)} au ${formatFR(dateFin)}`,
        genere_le:       horodatageBoutique(),
        solde_ouverture: soldeOuverture,
        total_achats:    lignes.reduce((a, l) => a + l.debit, 0),
        total_paiements: lignes.reduce((a, l) => a + l.credit, 0),
        solde_cloture:   courant,
        lignes,
    }
}

// ── Données bon de commande PDF ───────────────────────────────
export async function getDonneesBonCommande(poId: string, shopId: string) {
    const adminClient = createAdminClient()

    const [{ data: bon }, { data: boutique }] = await Promise.all([
        adminClient.from('purchase_orders').select(`
      public_id, statut, date_commande, date_livraison, montant_total, notes,
      suppliers(nom, adresse, ville, telephone, email, ifu),
      purchase_order_items(designation, quantite_cmd, prix_unitaire, montant_ligne)
    `).eq('id', poId).eq('shop_id', shopId).single(),
        adminClient.from('shops').select(
            'nom, adresse, ville, telephone_1, email, ifu, devise, logo_url'
        ).eq('id', shopId).single(),
    ])

    if (!bon || !boutique) return null

    return {
        boutique: {
            nom:         boutique.nom,
            adresse:     boutique.adresse,
            ville:       (boutique as any).ville ?? null,
            telephone_1: boutique.telephone_1,
            email:       boutique.email,
            ifu:         boutique.ifu,
            logo_url:    (boutique as any).logo_url ?? null,
            devise:      boutique.devise,
        },
        fournisseur: (bon.suppliers as any) ?? {},
        bon: {
            public_id:      bon.public_id,
            statut:         bon.statut,
            date_commande:  bon.date_commande,
            date_livraison: bon.date_livraison,
            montant_total:  bon.montant_total,
            notes:          bon.notes,
        },
        lignes: ((bon.purchase_order_items as any[]) ?? []).map((l: any) => ({
            designation:   l.designation,
            quantite:      l.quantite_cmd,
            prix_unitaire: l.prix_unitaire,
            montant_ligne: l.montant_ligne,
        })),
        genere_le: horodatageBoutique(),
    }
}

// ── Données rapport Profits & Pertes ──────────────────────────
export async function getDonneesRapportPP(
    shopId: string,
    mois:   number,
    annee:  number
) {
    const adminClient = createAdminClient()

    const { data: boutique } = await adminClient
        .from('shops').select('nom, adresse, ville, telephone_1, ifu, devise, logo_url').eq('id', shopId).single()

    // Bornes calculees sans dependre du fuseau du serveur. Le passage a
    // la journee vecue dans la boutique se fait desormais cote SQL, dans
    // tresorerie_periode, qui recoit le decalage en parametre.
    const { debut, fin } = bornesDuMois(mois, annee)

    // Les cinq postes de tresorerie et les ecarts d'inventaire sont
    // calcules par tresorerie_periode() (migration 031) : le tableau de
    // bord comptable lit exactement la meme ligne. Deux ecrans qui
    // additionnaient les memes tables chacun de leur cote finissaient
    // toujours par diverger — c'est ce qui vient d'arriver au credit.
    const [
        { data: tresorerie },
        { data: depenses },
    ] = await Promise.all([
        adminClient.rpc('tresorerie_periode', {
            p_shop_id:  shopId,
            p_debut:    debut,
            p_fin:      fin,
            p_decalage: DECALAGE_SQL,
        }).single(),
        // Le detail par categorie reste une lecture a part : c'est une
        // ventilation d'affichage, pas un agregat de tresorerie.
        adminClient.from('expenses')
            .select('montant, expense_categories(nom)')
            .eq('shop_id', shopId)
            .eq('est_annule', false)
            .gte('date_depense', debut).lte('date_depense', fin),
    ])

    const t = (tresorerie ?? {}) as Record<string, number>
    const totalVentes       = Number(t.entrees_pos          ?? 0)
    const ventesFacturees   = Number(t.ventes_facturees     ?? 0)
    const totalFactures     = Number(t.entrees_factures     ?? 0)
    const totalDepenses     = Number(t.sorties_depenses     ?? 0)
    const totalSalaires     = Number(t.sorties_salaires     ?? 0)
    const totalFournisseurs = Number(t.sorties_fournisseurs ?? 0)
    const pertesStock       = Number(t.stock_pertes         ?? 0)
    const gainsStock        = Number(t.stock_gains          ?? 0)

    // Agréger dépenses par catégorie
    const parCategorie: Record<string, number> = {}
    depenses?.forEach(d => {
        const cat = (d.expense_categories as any)?.nom ?? 'Sans catégorie'
        parCategorie[cat] = (parCategorie[cat] ?? 0) + d.montant
    })

    // Evolution sur 6 mois : une seule requete au lieu de trois par
    // mois enchainees en serie (migration 023). La fonction SQL exclut
    // aussi les ecritures annulees, ce que la boucle d'origine ne
    // faisait pas : elle avait ete ecrite avant qu'elles existent.
    const { data: serie } = await adminClient.rpc('evolution_tresorerie', {
        p_shop_id:   shopId,
        p_mois_fin:  mois,
        p_annee_fin: annee,
        p_nb_mois:   6,
        p_decalage:  DECALAGE_SQL,
    })

    const evolution = ((serie ?? []) as {
        mois: number; annee: number; entrees: number; sorties: number; resultat: number
    }[]).map(l => ({
        mois:     `${MOIS_FR_COURT[l.mois]} ${l.annee}`,
        entrees:  Number(l.entrees),
        sorties:  Number(l.sorties),
        resultat: Number(l.resultat),
    }))

    const totalEntrees = totalVentes + totalFactures
    const totalSorties = totalDepenses + totalSalaires + totalFournisseurs

    return {
        boutique:        boutique!,
        periode:         `${MOIS_FR[mois]} ${annee}`,
        genere_le:       horodatageBoutique(),
        entrees:         {
            ventes_pos:         totalVentes,
            paiements_factures: totalFactures,
            total:              totalEntrees,
        },
        // Ce que la boutique a vendu au comptoir sur la periode, et la
        // part qui n'est pas entree en caisse : le rapprochement entre
        // le facture et l'encaisse (decision D1).
        ventes_facturees:  ventesFacturees,
        non_encaisse_pos:  ventesFacturees - totalVentes,
        sorties:         { depenses: totalDepenses, salaires: totalSalaires, fournisseurs: totalFournisseurs, total: totalSorties },
        resultat:        totalEntrees - totalSorties,
        // Hors trésorerie : variation de la valeur du stock constatée
        // aux inventaires validés sur la période.
        variation_stock: {
            pertes: pertesStock,
            gains:  gainsStock,
            net:    gainsStock - pertesStock,
        },
        resultat_economique: (totalEntrees - totalSorties) + (gainsStock - pertesStock),
        detail_depenses: Object.entries(parCategorie)
            .map(([categorie, montant]) => ({ categorie, montant }))
            .sort((a, b) => b.montant - a.montant),
        evolution_mois: evolution,
    }
}

// ── Données rapport salaires ────────────────────────
// Le rapport liste ce qui est SORTI DE CAISSE dans le mois demandé, et
// non ce qui était dû au titre de ce mois : c'est ce décalage qui
// faisait dire aux PDF autre chose que la réalité. Chaque ligne porte
// donc les deux dates — le mois travaillé et le jour du versement.
export async function getDonneesRapportSalaires(
    shopId: string,
    mois:   number,
    annee:  number
) {
    const adminClient = createAdminClient()

    const { debut, fin } = bornesDuMois(mois, annee)

    const { data: boutique } = await adminClient
        .from('shops').select('nom, adresse, ville, telephone_1, ifu, devise, logo_url').eq('id', shopId).single()

    const { data: salaires } = await adminClient
        .from('salary_payments')
        .select(`
      employee_id, periode_mois, periode_annee,
      salaire_base, bonus, deductions, montant_net,
      moyen_paiement, date_paiement,
      employees(nom_complet, poste)
    `)
        .eq('shop_id', shopId)
        .eq('est_annule', false)
        .gte('date_paiement', debut)
        .lte('date_paiement', fin)
        .order('date_paiement')

    const lignes = salaires ?? []

    // Plusieurs versements sont admis pour un même employé (acompte puis
    // solde) : compter les lignes donnerait un nombre d'employés faux.
    const employesPayes = new Set(lignes.map(s => s.employee_id)).size

    return {
        boutique:          boutique!,
        periode:           `Versements de ${MOIS_FR[mois]} ${annee}`,
        genere_le:         horodatageBoutique(),
        nb_employes:       employesPayes,
        nb_versements:     lignes.length,
        total_brut:        lignes.reduce((a, s) => a + s.salaire_base, 0),
        total_bonus:       lignes.reduce((a, s) => a + s.bonus, 0),
        total_deductions:  lignes.reduce((a, s) => a + s.deductions, 0),
        total_net:         lignes.reduce((a, s) => a + s.montant_net, 0),
        salaires: lignes.map(s => ({
            employe:       (s.employees as any)?.nom_complet ?? 'Inconnu',
            poste:         (s.employees as any)?.poste ?? null,
            au_titre_de:   `${MOIS_FR_COURT[s.periode_mois]} ${s.periode_annee}`,
            salaire_base:  s.salaire_base,
            bonus:         s.bonus,
            deductions:    s.deductions,
            montant_net:   s.montant_net,
            moyen:         s.moyen_paiement,
            date_paiement: s.date_paiement,
        })),
    }
}

// ── Données factures impayées ─────────────────────────────────
export async function getDonneesFacturesImpayees(shopId: string) {
    const adminClient = createAdminClient()

    const { data: boutique } = await adminClient
        .from('shops').select('nom, adresse, ville, telephone_1, ifu, devise, logo_url').eq('id', shopId).single()

    const { data: factures } = await adminClient
        .from('factures')
        .select(`
      id, public_id, statut, date_facture, date_echeance,
      montant_ttc, montant_restant,
      clients(nom)
    `)
        .eq('shop_id', shopId)
        .in('statut', ['emise', 'partiellement_payee'])
        .order('date_echeance', { ascending: true, nullsFirst: false })

    // Un avoir vient en deduction de la facture depuis le Lot 2
    // Facturation : le montant restant en tient deja compte. Mais rien
    // ne le montrait, si bien que le client recevait une relance sur un
    // montant dont une partie lui avait deja ete rendue, sans un mot
    // pour l'expliquer.
    const idsFactures = (factures ?? []).map(f => f.id)
    const { data: avoirs } = idsFactures.length > 0
        ? await adminClient
            .from('avoirs')
            .select('facture_id, public_id, montant, motif, created_at')
            .eq('shop_id', shopId)
            .in('facture_id', idsFactures)
        : { data: [] as any[] }

    const avoirsParFacture: Record<string, { nb: number; montant: number; refs: string[] }> = {}
    ;(avoirs ?? []).forEach((a: any) => {
        const e = avoirsParFacture[a.facture_id] ??= { nb: 0, montant: 0, refs: [] }
        e.nb++
        e.montant += Number(a.montant ?? 0)
        e.refs.push(a.public_id)
    })

    const facturesFormatees = (factures ?? []).map(f => {
        // Le retard se calcule en JOURS, jamais en instants, et au seul
        // endroit ou la regle est ecrite (lib/facturation/etat-facture).
        const etat  = etatFacture(f as any)
        const avoir = avoirsParFacture[f.id]

        return {
            public_id:       f.public_id,
            client_nom:      (f.clients as any)?.nom ?? 'Client non spécifié',
            date_facture:    format(new Date(f.date_facture), 'dd/MM/yyyy', { locale: fr }),
            date_echeance:   f.date_echeance
                ? format(new Date(f.date_echeance), 'dd/MM/yyyy', { locale: fr })
                : null,
            montant_ttc:     f.montant_ttc,
            montant_restant: f.montant_restant,
            montant_avoirs:  avoir?.montant ?? 0,
            avoirs_refs:     avoir?.refs.join(', ') ?? null,
            jours_retard:    etat.joursRetard,
            etat:            etat.libelle,
            statut:          f.statut,
        }
    })

    const enRetard = facturesFormatees.filter(f => f.jours_retard > 0)

    return {
        boutique:           boutique!,
        genere_le:          horodatageBoutique(),
        total_factures:     facturesFormatees.length,
        total_en_retard:    enRetard.length,
        total_avec_avoir:   facturesFormatees.filter(f => f.montant_avoirs > 0).length,
        montant_total_du:   facturesFormatees.reduce((a, f) => a + f.montant_restant, 0),
        montant_en_retard:  enRetard.reduce((a, f) => a + f.montant_restant, 0),
        montant_avoirs:     facturesFormatees.reduce((a, f) => a + f.montant_avoirs, 0),
        factures:           facturesFormatees,
    }
}
// ── Données bulletin de paie ──────────────────────────────────
// Le seul PDF de paie était un récapitulatif de tous les employés d'un
// mois : impossible de remettre à quelqu'un le justificatif de son
// propre versement. On lit ici UN versement, avec le cumul de sa
// période pour que le bulletin dise la vérité quand il y a eu acompte.
export async function getDonneesBulletinPaie(versementId: string, shopId: string) {
    const adminClient = createAdminClient()

    const [{ data: versement }, { data: boutique }] = await Promise.all([
        adminClient
            .from('salary_payments')
            .select(`
                public_id, employee_id, periode_mois, periode_annee,
                salaire_base, bonus, deductions, montant_net,
                moyen_paiement, reference, note, date_paiement,
                est_annule, motif_annulation,
                employees(nom_complet, poste, telephone, date_embauche)
            `)
            .eq('id', versementId)
            .eq('shop_id', shopId)
            .maybeSingle(),
        adminClient
            .from('shops')
            .select('nom, adresse, ville, telephone_1, email, ifu, devise, logo_url')
            .eq('id', shopId)
            .single(),
    ])

    if (!versement || !boutique) return null

    // Cumul de la période travaillée, versements annulés exclus.
    const { data: memeperiode } = await adminClient
        .from('salary_payments')
        .select('montant_net')
        .eq('shop_id', shopId)
        .eq('employee_id', versement.employee_id)
        .eq('periode_mois', versement.periode_mois)
        .eq('periode_annee', versement.periode_annee)
        .eq('est_annule', false)

    const employe = versement.employees as unknown as {
        nom_complet: string; poste: string | null
        telephone: string | null; date_embauche: string | null
    } | null

    return {
        boutique: { ...boutique, devise: boutique.devise ?? 'FCFA' },
        employe: {
            nom_complet:   employe?.nom_complet ?? 'Inconnu',
            poste:         employe?.poste ?? null,
            telephone:     employe?.telephone ?? null,
            date_embauche: employe?.date_embauche ?? null,
        },
        versement: {
            public_id:        versement.public_id,
            au_titre_de:      `${MOIS_FR[versement.periode_mois]} ${versement.periode_annee}`,
            date_paiement:    versement.date_paiement,
            salaire_base:     versement.salaire_base,
            bonus:            versement.bonus,
            deductions:       versement.deductions,
            montant_net:      versement.montant_net,
            moyen:            versement.moyen_paiement,
            reference:        versement.reference,
            note:             versement.note,
            est_annule:       versement.est_annule,
            motif_annulation: versement.motif_annulation,
        },
        cumul_periode: {
            nb_versements: memeperiode?.length ?? 0,
            total_verse:   memeperiode?.reduce((a, v) => a + v.montant_net, 0) ?? 0,
        },
        genere_le: horodatageBoutique(),
    }
}
