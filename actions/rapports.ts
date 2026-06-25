'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

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

    const { data: ventes } = await adminClient
        .from('sales')
        .select(`
      id, public_id, statut, montant_total, created_at,
      clients(nom),
      shop_users(nom_complet),
      sale_items(id),
      sale_payments(moyen_paiement, montant)
    `)
        .eq('shop_id', shopId)
        .gte('created_at', debut + 'T00:00:00')
        .lte('created_at', fin + 'T23:59:59')
        .order('created_at', { ascending: false })

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
        .gte('sales.created_at', debut + 'T00:00:00')
        .lte('sales.created_at', fin + 'T23:59:59')

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

    // Par moyen paiement
    const parMoyen: Record<string, { moyen: string; montant: number }> = {}
    ventes?.forEach(v => {
        (v.sale_payments as any[])?.forEach((p: any) => {
            if (!parMoyen[p.moyen_paiement]) {
                parMoyen[p.moyen_paiement] = { moyen: p.moyen_paiement, montant: 0 }
            }
            parMoyen[p.moyen_paiement].montant += p.montant
        })
    })

    const ventesCompletees = ventes?.filter(v => v.statut === 'completee') ?? []
    const caTotal = ventesCompletees.reduce((a, v) => a + v.montant_total, 0)

    return {
        boutique: boutique!,
        periode:  `Du ${formatFR(debut)} au ${formatFR(fin)}`,
        genere_le: format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        total_ventes: ventesCompletees.length,
        ca_total:     caTotal,
        ca_moyen:     ventesCompletees.length > 0 ? caTotal / ventesCompletees.length : 0,
        ventes: (ventes ?? []).map(v => ({
            public_id:     v.public_id,
            date:          format(new Date(v.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
            client_nom:    (v.clients as any)?.nom ?? null,
            vendeur_nom:   (v.shop_users as any)?.nom_complet ?? 'Inconnu',
            montant_total: v.montant_total,
            statut:        v.statut,
            nb_articles:   (v.sale_items as any[])?.length ?? 0,
        })),
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

    const { data: clients } = await adminClient
        .from('clients')
        .select(`
      public_id, nom, telephone,
      credit_balance, advance_balance, change_balance
    `)
        .eq('shop_id', shopId)
        .eq('est_actif', true)
        .eq('est_anonyme', false)
        .order('nom')

    // Nb achats et CA par client
    const { data: ventesParClient } = await adminClient
        .from('sales')
        .select('client_id, montant_total')
        .eq('shop_id', shopId)
        .eq('statut', 'completee')
        .not('client_id', 'is', null)

    const statsClient: Record<string, { nb: number; ca: number }> = {}
    ventesParClient?.forEach(v => {
        if (!statsClient[v.client_id]) statsClient[v.client_id] = { nb: 0, ca: 0 }
        statsClient[v.client_id].nb++
        statsClient[v.client_id].ca += v.montant_total
    })

    const clientsAvecStats = (clients ?? []).map(c => ({
        ...c,
        nb_achats: statsClient[c.public_id]?.nb ?? 0,
        ca_total:  statsClient[c.public_id]?.ca ?? 0,
    }))

    return {
        boutique:          boutique!,
        genere_le:         format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        total_clients:     clientsAvecStats.length,
        clients_en_credit: clientsAvecStats.filter(c => c.credit_balance > 0).length,
        total_credit_du:   clientsAvecStats.reduce((a, c) => a + c.credit_balance, 0),
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
    `).eq('id', saleId).single(),
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
        genere_le: format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
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

    let query = adminClient
        .from('products')
        .select(`
      id, public_id, nom, unite, prix_achat, prix_vente, seuil_alerte,
      categories(nom),
      stock_levels(quantite, warehouse_id, warehouses(nom))
    `)
        .eq('shop_id', shopId)
        .eq('est_actif', true)
        .order('nom')

    const { data: produits } = await query

    const entrepotNom = warehouseId
        ? entrepots?.find(e => e.id === warehouseId)?.nom ?? 'Tous les entrepôts'
        : 'Tous les entrepôts'

    const produitsFormates = (produits ?? []).flatMap(p => {
        const niveaux = (p.stock_levels as any[]) ?? []
        const niveauxFiltres = warehouseId
            ? niveaux.filter((s: any) => s.warehouse_id === warehouseId)
            : niveaux

        return niveauxFiltres.map((s: any) => ({
            public_id:    p.public_id,
            nom:          p.nom,
            categorie:    (p.categories as any)?.nom ?? null,
            unite:        p.unite,
            prix_achat:   p.prix_achat,
            prix_vente:   p.prix_vente,
            stock:        s.quantite,
            seuil_alerte: p.seuil_alerte,
            en_alerte:    s.quantite <= p.seuil_alerte,
            entrepot:     (s.warehouses as any)?.nom ?? 'Inconnu',
        }))
    })

    const valeurStock = produitsFormates.reduce(
        (acc, p) => acc + p.stock * p.prix_achat, 0
    )

    return {
        boutique:           boutique!,
        entrepot_filtre:    entrepotNom,
        genere_le:          format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        total_produits:     produitsFormates.length,
        produits_en_alerte: produitsFormates.filter(p => p.en_alerte).length,
        valeur_stock:       valeurStock,
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

    const { data: mouvements } = await adminClient
        .from('stock_movements')
        .select(`
      public_id, type_mouvement, quantite, quantite_avant, quantite_apres, created_at,
      products(nom),
      warehouses(nom)
    `)
        .eq('shop_id', shopId)
        .gte('created_at', debut + 'T00:00:00')
        .lte('created_at', fin + 'T23:59:59')
        .order('created_at', { ascending: false })

    const entrees    = ['entree_initiale','reception','retour_vente','transfert_entree','ajustement_positif']
    const sorties    = ['vente','retour_fournisseur','transfert_sortie','ajustement_negatif']
    const transferts = ['transfert_sortie','transfert_entree']

    return {
        boutique:          boutique!,
        periode:           `Du ${formatFR(debut)} au ${formatFR(fin)}`,
        genere_le:         format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        total_entrees:     (mouvements ?? []).filter(m => entrees.includes(m.type_mouvement)).length,
        total_sorties:     (mouvements ?? []).filter(m => sorties.includes(m.type_mouvement)).length,
        total_transferts:  (mouvements ?? []).filter(m => transferts.includes(m.type_mouvement)).length,
        mouvements: (mouvements ?? []).map(m => ({
            public_id:      m.public_id,
            type_mouvement: m.type_mouvement,
            produit_nom:    (m.products as any)?.nom ?? 'Inconnu',
            entrepot_nom:   (m.warehouses as any)?.nom ?? 'Inconnu',
            quantite:       m.quantite,
            quantite_avant: m.quantite_avant,
            quantite_apres: m.quantite_apres,
            date:           format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
        })),
    }
}

// ── Données rapport fournisseurs ──────────────────────────────
export async function getDonneesRapportFournisseurs(shopId: string) {
    const adminClient = createAdminClient()

    const { data: boutique } = await adminClient
        .from('shops').select('nom, adresse, ville, telephone_1, ifu, devise, logo_url').eq('id', shopId).single()

    // Note: solde_dû contient un caractère accentué qui casse le parser de types
    // Supabase. On caste la réponse en any[] pour contourner le problème.
    const { data: fournisseursRaw } = await adminClient
        .from('suppliers')
        .select('public_id, nom, telephone, email, solde_dû, purchase_orders(id, created_at)')
        .eq('shop_id', shopId)
        .order('solde_dû', { ascending: false })

    const fournisseurs = (fournisseursRaw ?? []) as any[]

    const formates = fournisseurs.map((f: any) => {
        const commandes = (f.purchase_orders as any[]) ?? []
        const dernierAchat = commandes.length > 0
            ? format(
                new Date(Math.max(...commandes.map((c: any) => new Date(c.created_at).getTime()))),
                'dd/MM/yyyy', { locale: fr }
            )
            : null
        return {
            public_id:     f.public_id    as string,
            nom:           f.nom          as string,
            telephone:     f.telephone    as string | null,
            email:         f.email        as string | null,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            solde_du:     (f['solde_dû']  as number) ?? 0,
            nb_commandes:  commandes.length,
            dernier_achat: dernierAchat,
        }
    })

    return {
        boutique:                boutique!,
        genere_le:               format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        total_fournisseurs:      formates.length,
        fournisseurs_avec_dette: formates.filter(f => f.solde_du > 0).length,
        total_dette:             formates.reduce((a, f) => a + f.solde_du, 0),
        fournisseurs:            formates,
    }
}

// ── Données bon de commande PDF ───────────────────────────────
export async function getDonneesBonCommande(poId: string, shopId: string) {
    const adminClient = createAdminClient()

    const [{ data: bon }, { data: boutique }] = await Promise.all([
        adminClient.from('purchase_orders').select(`
      public_id, date_commande, date_livraison, montant_total, notes,
      suppliers(nom, adresse, ville, telephone, email, ifu),
      purchase_order_items(designation, quantite_cmd, prix_unitaire, montant_ligne)
    `).eq('id', poId).eq('shop_id', shopId).single(),
        adminClient.from('shops').select(
            'nom, adresse, telephone_1, email, ifu, devise'
        ).eq('id', shopId).single(),
    ])

    if (!bon || !boutique) return null

    return {
        boutique: {
            nom:        boutique.nom,
            adresse:    boutique.adresse,
            telephone_1: boutique.telephone_1,
            email:      boutique.email,
            ifu:        boutique.ifu,
            devise:     boutique.devise,
        },
        fournisseur: (bon.suppliers as any) ?? {},
        bon: {
            public_id:      bon.public_id,
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
        genere_le: format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
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

    const debut = new Date(annee, mois - 1, 1).toISOString().split('T')[0]
    const fin   = new Date(annee, mois, 0).toISOString().split('T')[0]

    const [
        { data: ventes },
        { data: depenses },
        { data: salaires },
        { data: paiementsFourn },
        { data: paiementsFact },
    ] = await Promise.all([
        adminClient.from('sales').select('montant_total')
            .eq('shop_id', shopId).eq('statut', 'completee')
            .gte('created_at', debut + 'T00:00:00')
            .lte('created_at', fin + 'T23:59:59'),
        adminClient.from('expenses')
            .select('montant, expense_categories(nom)')
            .eq('shop_id', shopId)
            .gte('date_depense', debut).lte('date_depense', fin),
        adminClient.from('salary_payments').select('montant_net')
            .eq('shop_id', shopId).eq('periode_mois', mois).eq('periode_annee', annee),
        adminClient.from('supplier_payments').select('montant')
            .eq('shop_id', shopId)
            .gte('date_paiement', debut).lte('date_paiement', fin),
        adminClient.from('facture_payments').select('montant')
            .eq('shop_id', shopId)
            .gte('created_at', debut + 'T00:00:00')
            .lte('created_at', fin + 'T23:59:59'),
    ])

    const totalVentes      = ventes?.reduce((a, v) => a + v.montant_total, 0) ?? 0
    const totalFactures    = paiementsFact?.reduce((a, p) => a + p.montant, 0) ?? 0
    const totalDepenses    = depenses?.reduce((a, d) => a + d.montant, 0) ?? 0
    const totalSalaires    = salaires?.reduce((a, s) => a + s.montant_net, 0) ?? 0
    const totalFournisseurs = paiementsFourn?.reduce((a, p) => a + p.montant, 0) ?? 0

    // Agréger dépenses par catégorie
    const parCategorie: Record<string, number> = {}
    depenses?.forEach(d => {
        const cat = (d.expense_categories as any)?.nom ?? 'Sans catégorie'
        parCategorie[cat] = (parCategorie[cat] ?? 0) + d.montant
    })

    // Évolution 6 derniers mois
    const evolution = []
    for (let i = 5; i >= 0; i--) {
        const d = new Date(annee, mois - 1 - i, 1)
        const m = d.getMonth() + 1
        const a = d.getFullYear()
        const deb = new Date(a, m - 1, 1).toISOString().split('T')[0]
        const fin2 = new Date(a, m, 0).toISOString().split('T')[0]

        const { data: v } = await adminClient.from('sales').select('montant_total')
            .eq('shop_id', shopId).eq('statut', 'completee')
            .gte('created_at', deb + 'T00:00:00').lte('created_at', fin2 + 'T23:59:59')
        const { data: dep } = await adminClient.from('expenses').select('montant')
            .eq('shop_id', shopId).gte('date_depense', deb).lte('date_depense', fin2)
        const { data: sal } = await adminClient.from('salary_payments').select('montant_net')
            .eq('shop_id', shopId).eq('periode_mois', m).eq('periode_annee', a)

        const ca  = v?.reduce((acc, x) => acc + x.montant_total, 0) ?? 0
        const ch  = (dep?.reduce((acc, x) => acc + x.montant, 0) ?? 0) +
            (sal?.reduce((acc, x) => acc + x.montant_net, 0) ?? 0)

        const MOIS_LABELS = ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
        evolution.push({ mois: `${MOIS_LABELS[m]} ${a}`, ca, depenses: ch, resultat: ca - ch })
    }

    const totalEntrees = totalVentes + totalFactures
    const totalSorties = totalDepenses + totalSalaires + totalFournisseurs

    const MOIS_LABELS_FR = ['','Janvier','Février','Mars','Avril','Mai','Juin',
        'Juillet','Août','Septembre','Octobre','Novembre','Décembre']

    return {
        boutique:        boutique!,
        periode:         `${MOIS_LABELS_FR[mois]} ${annee}`,
        genere_le:       format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        entrees:         { ventes_pos: totalVentes, paiements_factures: totalFactures, total: totalEntrees },
        sorties:         { depenses: totalDepenses, salaires: totalSalaires, fournisseurs: totalFournisseurs, total: totalSorties },
        resultat:        totalEntrees - totalSorties,
        detail_depenses: Object.entries(parCategorie)
            .map(([categorie, montant]) => ({ categorie, montant }))
            .sort((a, b) => b.montant - a.montant),
        evolution_mois: evolution,
    }
}

// ── Données rapport salaires ──────────────────────────────────
export async function getDonneesRapportSalaires(
    shopId: string,
    mois:   number,
    annee:  number
) {
    const adminClient = createAdminClient()

    const { data: boutique } = await adminClient
        .from('shops').select('nom, adresse, ville, telephone_1, ifu, devise, logo_url').eq('id', shopId).single()

    const { data: salaires } = await adminClient
        .from('salary_payments')
        .select(`
      salaire_base, bonus, deductions, montant_net,
      moyen_paiement, date_paiement,
      employees(nom_complet, poste)
    `)
        .eq('shop_id', shopId)
        .eq('periode_mois', mois)
        .eq('periode_annee', annee)

    const MOIS_LABELS_FR = ['','Janvier','Février','Mars','Avril','Mai','Juin',
        'Juillet','Août','Septembre','Octobre','Novembre','Décembre']

    return {
        boutique:          boutique!,
        periode:           `${MOIS_LABELS_FR[mois]} ${annee}`,
        genere_le:         format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        nb_employes:       salaires?.length ?? 0,
        total_brut:        salaires?.reduce((a, s) => a + s.salaire_base, 0) ?? 0,
        total_bonus:       salaires?.reduce((a, s) => a + s.bonus, 0) ?? 0,
        total_deductions:  salaires?.reduce((a, s) => a + s.deductions, 0) ?? 0,
        total_net:         salaires?.reduce((a, s) => a + s.montant_net, 0) ?? 0,
        salaires: (salaires ?? []).map(s => ({
            employe:       (s.employees as any)?.nom_complet ?? 'Inconnu',
            poste:         (s.employees as any)?.poste ?? null,
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
      public_id, statut, date_facture, date_echeance,
      montant_ttc, montant_restant,
      clients(nom)
    `)
        .eq('shop_id', shopId)
        .in('statut', ['emise', 'partiellement_payee'])
        .order('date_echeance', { ascending: true, nullsFirst: false })

    const maintenant = new Date()

    const facturesFormatees = (factures ?? []).map(f => {
        const echeance = f.date_echeance ? new Date(f.date_echeance) : null
        const joursRetard = echeance
            ? Math.max(0, Math.floor((maintenant.getTime() - echeance.getTime()) / 86400000))
            : 0

        return {
            public_id:       f.public_id,
            client_nom:      (f.clients as any)?.nom ?? 'Client non spécifié',
            date_facture:    format(new Date(f.date_facture), 'dd/MM/yyyy', { locale: fr }),
            date_echeance:   f.date_echeance
                ? format(new Date(f.date_echeance), 'dd/MM/yyyy', { locale: fr })
                : null,
            montant_ttc:     f.montant_ttc,
            montant_restant: f.montant_restant,
            jours_retard:    joursRetard,
            statut:          f.statut,
        }
    })

    const enRetard = facturesFormatees.filter(f => f.jours_retard > 0)

    return {
        boutique:           boutique!,
        genere_le:          format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }),
        total_factures:     facturesFormatees.length,
        total_en_retard:    enRetard.length,
        montant_total_du:   facturesFormatees.reduce((a, f) => a + f.montant_restant, 0),
        montant_en_retard:  enRetard.reduce((a, f) => a + f.montant_restant, 0),
        factures:           facturesFormatees,
    }
}