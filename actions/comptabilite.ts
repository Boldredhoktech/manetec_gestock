'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { journaliserCorrection, champsModifies } from '@/lib/audit/journaliser'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ── Catégories de dépenses ────────────────────────────────────
export async function creerCategorieDepense(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.DEPENSES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()
    const nom         = (formData.get('nom') as string)?.trim()

    if (!nom) return { erreur: 'Le nom est obligatoire.' }

    const { error } = await adminClient.from('expense_categories').insert({
        shop_id: shopId, nom, est_actif: true,
    })

    if (error) return { erreur: 'Cette catégorie existe déjà ou erreur de création.' }

    revalidatePath('/compta/depenses')
    return { succes: true }
}

// ── Créer une dépense ─────────────────────────────────────────
export async function creerDepense(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.DEPENSES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const libelle      = (formData.get('libelle') as string)?.trim()
    const montant      = parseFloat(formData.get('montant') as string)
    const moyen        = (formData.get('moyen') as string) || 'cash'
    const categoryId   = (formData.get('categoryId') as string) || null
    const dateDepense  = (formData.get('dateDepense') as string) ||
        new Date().toISOString().split('T')[0]
    const reference    = (formData.get('reference') as string)?.trim() || null
    const note         = (formData.get('note') as string)?.trim() || null

    if (!libelle) return { erreur: 'Le libellé est obligatoire.' }
    if (isNaN(montant) || montant <= 0) return { erreur: 'Montant invalide.' }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'EXP' })

    const { error } = await adminClient.from('expenses').insert({
        public_id:     publicId,
        shop_id:       shopId,
        category_id:   categoryId || null,
        libelle,
        montant,
        moyen_paiement: moyen,
        reference,
        date_depense:  dateDepense,
        note,
        created_by:    user.user_metadata.user_id,
    })

    if (error) return { erreur: 'Erreur lors de la création.' }

    revalidatePath('/compta/depenses')
    redirect('/compta/depenses')
}

// ── Créer un employé ──────────────────────────────────────────
export async function creerEmploye(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.SALAIRES_GERER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const nomComplet   = (formData.get('nomComplet') as string)?.trim()
    const poste        = (formData.get('poste') as string)?.trim() || null
    const salaireBase  = parseFloat(formData.get('salaireBase') as string) || 0
    const telephone    = (formData.get('telephone') as string)?.trim() || null
    const dateEmbauche = (formData.get('dateEmbauche') as string) || null

    if (!nomComplet) return { erreur: 'Le nom est obligatoire.' }

    const { error } = await adminClient.from('employees').insert({
        shop_id:      shopId,
        nom_complet:  nomComplet,
        poste,
        salaire_base: salaireBase,
        telephone,
        date_embauche: dateEmbauche || null,
        est_actif:    true,
    })

    if (error) return { erreur: 'Erreur lors de la création.' }

    revalidatePath('/compta/salaires')
    redirect('/compta/salaires')
}

// ── Payer un salaire ──────────────────────────────────────────
// La période travaillée (mois/année) et la DATE DE VERSEMENT sont deux
// choses distinctes, et toutes deux saisissables : on peut régler un
// arriéré, et le versement compte dans le mois où l'argent sort.
// Plusieurs versements sont admis pour une même période (acompte puis
// solde) — c'est l'écran qui rend le cumul visible, plus la base qui
// l'interdit.
export async function payerSalaire(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.SALAIRES_GERER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const employeeId   = formData.get('employeeId') as string
    const mois         = parseInt(formData.get('mois') as string)
    const annee        = parseInt(formData.get('annee') as string)
    const salaireBase  = parseFloat(formData.get('salaireBase') as string) || 0
    const bonus        = parseFloat(formData.get('bonus') as string) || 0
    const deductions   = parseFloat(formData.get('deductions') as string) || 0
    const moyen        = (formData.get('moyen') as string) || 'cash'
    const datePaiement = (formData.get('datePaiement') as string) || ''
    const reference    = (formData.get('reference') as string)?.trim() || null
    const note         = (formData.get('note') as string)?.trim() || null
    const montantNet   = salaireBase + bonus - deductions

    if (!employeeId) return { erreur: 'Employé manquant.' }
    if (!Number.isInteger(mois) || mois < 1 || mois > 12) {
        return { erreur: 'Mois de la période invalide.' }
    }
    if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) {
        return { erreur: 'Année de la période invalide.' }
    }
    if (montantNet <= 0) return { erreur: 'Le montant net doit être positif.' }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePaiement)) {
        return { erreur: 'Date de versement invalide.' }
    }
    // Un versement futur fausserait la trésorerie du mois en cours.
    if (datePaiement > new Date().toISOString().split('T')[0]) {
        return { erreur: 'La date de versement ne peut pas être dans le futur.' }
    }

    // Cloisonnement : l'employé doit appartenir à la boutique.
    const { data: employe } = await adminClient
        .from('employees')
        .select('id')
        .eq('id', employeeId)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!employe) return { erreur: 'Employé introuvable.' }

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'PSAL' })

    const { error } = await adminClient.from('salary_payments').insert({
        public_id:      publicId,
        shop_id:        shopId,
        employee_id:    employeeId,
        periode_mois:   mois,
        periode_annee:  annee,
        salaire_base:   salaireBase,
        bonus,
        deductions,
        montant_net:    montantNet,
        moyen_paiement: moyen,
        date_paiement:  datePaiement,
        reference,
        note,
        created_by:     user.user_metadata.user_id,
    })

    if (error) {
        console.error('ERREUR VERSEMENT SALAIRE:', error)
        return { erreur: 'Erreur lors de l\'enregistrement du versement.' }
    }

    revalidatePath('/compta/salaires')
    revalidatePath('/compta/dashboard')
    return { succes: true }
}

// ── Créer un inventaire ───────────────────────────────────────
export async function creerInventaire(
    warehouseId: string,
    nomPersonnalise?: string
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.STOCK_INVENTAIRE_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    // Vérifier qu'il n'y a pas d'inventaire en cours sur cet entrepôt.
    // maybeSingle() et non single() : avec single(), deux inventaires en
    // cours faisaient échouer la requête, donc renvoyaient « aucun » — le
    // garde-fou sautait exactement dans le cas qu'il devait empêcher.
    const { data: enCoursListe } = await adminClient
        .from('inventories')
        .select('id, nom')
        .eq('shop_id', shopId)
        .eq('warehouse_id', warehouseId)
        .eq('statut', 'en_cours')
        .limit(1)

    const enCours = enCoursListe?.[0] ?? null

    if (enCours) {
        return {
            erreur:      'Un inventaire est déjà en cours sur cet entrepôt.',
            inventoryId: enCours.id,
        }
    }

    // Nom automatique si non fourni
    const { data: entrepot } = await adminClient
        .from('warehouses').select('nom').eq('id', warehouseId).single()

    const maintenant = new Date()
    const MOIS_FR    = [
        'Janvier','Février','Mars','Avril','Mai','Juin',
        'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
    ]
    const nomAuto  = `Inventaire ${MOIS_FR[maintenant.getMonth()]} ${maintenant.getFullYear()} — ${entrepot?.nom ?? 'Entrepôt'}`
    const nomFinal = nomPersonnalise?.trim() || nomAuto

    const { data: publicId } = await adminClient
        .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'INV' })

    const { data: inventaire, error } = await adminClient
        .from('inventories').insert({
            public_id:    publicId,
            shop_id:      shopId,
            warehouse_id: warehouseId,
            nom:          nomFinal,
            statut:       'en_cours',
            created_by:   user.user_metadata.user_id,
        }).select().single()

    if (error || !inventaire) return { erreur: 'Erreur lors de la création.' }

    // La feuille de comptage couvre TOUS les produits actifs du
    // catalogue, pas seulement ceux qui ont déjà eu du stock dans cet
    // entrepôt : sans cela, impossible de déclarer une quantité trouvée
    // pour un produit jamais reçu ici.
    const [{ data: produits }, { data: stocks }] = await Promise.all([
        adminClient.from('products')
            .select('id')
            .eq('shop_id', shopId)
            .eq('est_actif', true),
        adminClient.from('stock_levels')
            .select('product_id, quantite')
            .eq('shop_id', shopId)
            .eq('warehouse_id', warehouseId),
    ])

    const stockParProduit = new Map<string, number>(
        (stocks ?? []).map(s => [s.product_id as string, s.quantite as number])
    )

    if (produits && produits.length > 0) {
        const { error: erreurLignes } = await adminClient.from('inventory_items').insert(
            produits.map(p => ({
                shop_id:             shopId,
                inventory_id:        inventaire.id,
                product_id:          p.id,
                quantite_theorique:  stockParProduit.get(p.id) ?? 0,
                quantite_reelle:     null,
                ecart:               null,
            }))
        )

        if (erreurLignes) {
            await adminClient.from('inventories').delete().eq('id', inventaire.id)
            return { erreur: 'Erreur lors de la préparation de la feuille de comptage.' }
        }
    }

    revalidatePath('/compta/inventaire')
    return { succes: true, inventory_id: inventaire.id, nom: nomFinal }
}

// ── Saisir quantité réelle ────────────────────────────────────
export async function saisirQuantiteReelle(
    inventoryItemId: string,
    quantiteReelle: number
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.STOCK_INVENTAIRE_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    if (!Number.isFinite(quantiteReelle) || quantiteReelle < 0) {
        return { erreur: 'Quantité comptée invalide.' }
    }

    // Cloisonnement : la ligne d'inventaire doit appartenir à la boutique.
    const { data: item } = await adminClient
        .from('inventory_items')
        .select('quantite_theorique')
        .eq('id', inventoryItemId)
        .eq('shop_id', shopId)
        .single()

    if (!item) return { erreur: 'Article introuvable.' }

    await adminClient.from('inventory_items').update({
        quantite_reelle: quantiteReelle,
        ecart:           quantiteReelle - item.quantite_theorique,
    }).eq('id', inventoryItemId).eq('shop_id', shopId)

    revalidatePath('/compta/inventaire')
    return { succes: true }
}

// ── Valider un inventaire ───────────────────────────
// mode 'ecart' (défaut) : on applique la différence constatée au
//   comptage, donc les ventes faites pendant le comptage restent
//   déduites. mode 'absolu' : on impose la quantité comptée.
// Toute la validation (stock, valorisation, statut) tient dans une
// seule transaction SQL. Les écarts ne génèrent plus de dépense de
// caisse : ils sont valorisés symétriquement, pertes ET gains, sur
// l'inventaire lui-même.
export async function validerInventaire(
    inventoryId: string,
    mode: 'ecart' | 'absolu' = 'ecart'
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.STOCK_INVENTAIRE_VALIDER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: result, error } = await adminClient.rpc('valider_inventaire', {
        p_inventory_id: inventoryId,
        p_shop_id:      shopId,
        p_user_id:      user.user_metadata.user_id,
        p_mode:         mode,
    })

    if (error) {
        console.error('ERREUR VALIDATION INVENTAIRE:', error)
        return { erreur: 'Erreur lors de la validation.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de la validation.' }

    revalidatePath('/compta/inventaire')
    revalidatePath('/stock/produits')
    revalidatePath('/stock/mouvements')

    return {
        succes:       true,
        mode:         result.mode as 'ecart' | 'absolu',
        valeurPertes: Number(result.valeur_pertes ?? 0),
        valeurGains:  Number(result.valeur_gains ?? 0),
        valeurNette:  Number(result.valeur_nette ?? 0),
        nbNegatifs:   Number(result.nb_negatifs ?? 0),
        nbPositifs:   Number(result.nb_positifs ?? 0),
        derives:      (result.derives ?? []) as {
            produit: string; theorique: number; actuel: number; compte: number
        }[],
    }
}

// ── Annuler un inventaire en cours ───────────────────
// Aucun mouvement de stock n'a été appliqué tant que l'inventaire
// n'est pas validé : l'annulation n'a rien à défaire.
export async function annulerInventaire(inventoryId: string, motif?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.STOCK_INVENTAIRE_VALIDER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const adminClient = createAdminClient()

    const { data: result, error } = await adminClient.rpc('annuler_inventaire', {
        p_inventory_id: inventoryId,
        p_shop_id:      user.user_metadata.shop_id,
        p_user_id:      user.user_metadata.user_id,
        p_motif:        motif || null,
    })

    if (error) {
        console.error('ERREUR ANNULATION INVENTAIRE:', error)
        return { erreur: 'Erreur lors de l\'annulation.' }
    }
    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de l\'annulation.' }

    revalidatePath('/compta/inventaire')
    return { succes: true }
}

// ── Tableau de bord comptable ─────────────────────────────────
// La boutique est lue DANS LA SESSION, jamais reçue en argument : ce
// fichier porte 'use server', donc chaque fonction exportée est publiée
// comme Server Action et reste appelable par requête directe.
// Renvoie null si l'appelant n'y a pas droit.
export async function getTableauBordComptable(mois: number, annee: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return null
    if (!aPermission(user, PERMISSIONS.COMPTABILITE_VOIR)) return null

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    if (!Number.isInteger(mois) || mois < 1 || mois > 12) return null
    if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) return null

    const debut = `${annee}-${String(mois).padStart(2, '0')}-01`
    const fin   = new Date(Date.UTC(annee, mois, 0)).toISOString().split('T')[0]

    const [
        { data: ventes },
        { data: depenses },
        { data: salaires },
        { data: paiementsFournisseurs },
        { data: paiementsFactures },
        { data: inventaires },
        { data: ventilationBrute },
    ] = await Promise.all([
        adminClient.from('sales')
            .select('montant_total, credit_accorde, created_at')
            .eq('shop_id', shopId).eq('statut', 'completee')
            .gte('created_at', debut).lte('created_at', fin + 'T23:59:59'),
        // Les écritures annulées restent visibles à l'écran, barrées,
        // mais sortent de tous les totaux.
        adminClient.from('expenses')
            .select('montant, date_depense, libelle, expense_categories(nom)')
            .eq('shop_id', shopId)
            .eq('est_annule', false)
            .gte('date_depense', debut).lte('date_depense', fin),
        // Sur la DATE DE VERSEMENT, comme les dépenses et les
        // fournisseurs : un salaire de juin réglé en juillet sort de la
        // caisse de juillet. La période travaillée n'est qu'une étiquette.
        adminClient.from('salary_payments')
            .select('montant_net')
            .eq('shop_id', shopId)
            .eq('est_annule', false)
            .gte('date_paiement', debut).lte('date_paiement', fin),
        adminClient.from('supplier_payments')
            .select('montant, date_paiement')
            .eq('shop_id', shopId)
            .gte('date_paiement', debut).lte('date_paiement', fin),
        // date_paiement, et non created_at : la colonne existait depuis
        // l'origine sans qu'aucun filtre s'en serve.
        adminClient.from('facture_payments')
            .select('montant, date_paiement')
            .eq('shop_id', shopId)
            .gte('date_paiement', debut).lte('date_paiement', fin),
        // Variation de la valeur du stock constatée aux inventaires
        // validés : ce n'est PAS de la trésorerie, d'où sa présentation
        // à part — mais le tableau de bord doit dire la même chose que
        // le rapport Profits & Pertes, qui l'affiche depuis le Lot 3 Stock.
        adminClient.from('inventories')
            .select('valeur_pertes, valeur_gains')
            .eq('shop_id', shopId)
            .eq('statut', 'valide')
            .gte('valide_le', debut + 'T00:00:00')
            .lte('valide_le', fin + 'T23:59:59'),
        // Cinq sources d'argent agrégées par moyen de paiement en une
        // seule requête, cumul compris (voir migration 022).
        adminClient.rpc('ventilation_caisse', {
            p_shop_id: shopId, p_debut: debut, p_fin: fin,
        }),
    ])

    const totalVentes       = ventes?.reduce((a, v) => a + v.montant_total, 0) ?? 0
    const creditAccorde     = ventes?.reduce((a, v) => a + (v.credit_accorde ?? 0), 0) ?? 0
    const totalDepenses     = depenses?.reduce((a, d) => a + d.montant, 0) ?? 0
    const totalSalaires     = salaires?.reduce((a, s) => a + s.montant_net, 0) ?? 0
    const totalFournisseurs = paiementsFournisseurs?.reduce((a, p) => a + p.montant, 0) ?? 0
    const totalFactures     = paiementsFactures?.reduce((a, p) => a + p.montant, 0) ?? 0
    const totalEntrees      = totalVentes + totalFactures
    const totalSorties      = totalDepenses + totalSalaires + totalFournisseurs
    const resultat          = totalEntrees - totalSorties

    const pertesStock = inventaires?.reduce((a, i) => a + (i.valeur_pertes ?? 0), 0) ?? 0
    const gainsStock  = inventaires?.reduce((a, i) => a + (i.valeur_gains  ?? 0), 0) ?? 0

    type LigneVentilation = {
        moyen: string
        entrees_periode: number
        sorties_periode: number
        entrees_cumul:   number
        sorties_cumul:   number
    }

    const ventilation = ((ventilationBrute ?? []) as LigneVentilation[]).map(l => ({
        moyen:          l.moyen,
        entreesPeriode: Number(l.entrees_periode),
        sortiesPeriode: Number(l.sorties_periode),
        netPeriode:     Number(l.entrees_periode) - Number(l.sorties_periode),
        solde:          Number(l.entrees_cumul) - Number(l.sorties_cumul),
    }))

    const MOIS_LABELS_FR = ['','Janvier','Février','Mars','Avril','Mai','Juin',
        'Juillet','Août','Septembre','Octobre','Novembre','Décembre']

    return {
        periode: { mois, annee, libelle: `${MOIS_LABELS_FR[mois]} ${annee}` },
        totalVentes,
        totalFactures,
        totalEntrees,
        totalDepenses,
        totalSalaires,
        totalFournisseurs,
        totalSorties,
        resultat,
        // Le POS enregistre la totalité de la vente comme encaissée même
        // quand une part est accordée à crédit : tant que ce n'est pas
        // repris au module POS, la ventilation surestime les entrées de
        // ce montant. On l'affiche plutôt que de le taire.
        creditAccorde,
        variationStock: { pertes: pertesStock, gains: gainsStock, net: gainsStock - pertesStock },
        resultatEconomique: resultat + (gainsStock - pertesStock),
        ventilation,
        nbVentes: ventes?.length ?? 0,
        depenses: depenses ?? [],
    }
}

// ══════════════════════════════════════════════════════════════
// CORRECTIONS D'ÉCRITURES
//
// Décision produit D4 : on modifie sur place, jamais en silence.
// La ligne garde son identifiant, ses valeurs changent, et l'ancienne
// valeur part dans `audit_logs` avec son auteur et sa date — l'écran de
// détail de l'écriture la réaffiche.
//
// L'annulation est réservée à une écriture qui n'aurait jamais dû
// exister (une double saisie). Elle exige un motif, la ligne reste
// visible et barrée, et elle sort de tous les totaux.
// ══════════════════════════════════════════════════════════════

const MOTIF_MINIMUM = 5

// ── Modifier une dépense ──────────────────────────────────────
export async function modifierDepense(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.DEPENSES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const id           = formData.get('id') as string
    const libelle      = (formData.get('libelle') as string)?.trim()
    const montant      = parseFloat(formData.get('montant') as string)
    const moyen        = (formData.get('moyen') as string) || 'cash'
    const categoryId   = (formData.get('categoryId') as string) || null
    const dateDepense  = (formData.get('dateDepense') as string) || ''
    const note         = (formData.get('note') as string)?.trim() || null

    if (!id) return { erreur: 'Dépense introuvable.' }
    if (!libelle) return { erreur: 'Le libellé est obligatoire.' }
    if (isNaN(montant) || montant <= 0) return { erreur: 'Montant invalide.' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDepense)) return { erreur: 'Date invalide.' }

    const { data: avant } = await adminClient
        .from('expenses')
        .select('id, public_id, libelle, montant, moyen_paiement, category_id, date_depense, note, est_annule')
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!avant) return { erreur: 'Dépense introuvable.' }
    if (avant.est_annule) return { erreur: 'Cette dépense est annulée : elle ne peut plus être modifiée.' }

    const apres = {
        libelle,
        montant,
        moyen_paiement: moyen,
        category_id:    categoryId || null,
        date_depense:   dateDepense,
        note,
    }

    const modifications = champsModifies(avant, apres, {
        libelle:        'Libellé',
        montant:        'Montant',
        moyen_paiement: 'Moyen de paiement',
        category_id:    'Catégorie',
        date_depense:   'Date',
        note:           'Note',
    })

    if (modifications.length === 0) return { succes: true, aucunChangement: true }

    const { error } = await adminClient
        .from('expenses')
        .update({ ...apres, modifie_le: new Date().toISOString(), modifie_par: user.user_metadata.user_id })
        .eq('id', id)
        .eq('shop_id', shopId)

    if (error) {
        console.error('ERREUR MODIFICATION DEPENSE:', error)
        return { erreur: 'Erreur lors de la modification.' }
    }

    await journaliserCorrection({
        user,
        eventType:         'EXPENSE_UPDATED',
        referenceType:     'expense',
        referenceId:       id,
        referencePublicId: avant.public_id,
        modifications,
    })

    revalidatePath('/compta/depenses')
    revalidatePath(`/compta/depenses/${id}`)
    revalidatePath('/compta/dashboard')
    return { succes: true }
}

// ── Annuler une dépense ───────────────────────────────────────
export async function annulerDepense(id: string, motif: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.DEPENSES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()
    const motifPropre = motif?.trim() ?? ''

    if (motifPropre.length < MOTIF_MINIMUM) {
        return { erreur: 'Expliquez en quelques mots pourquoi cette dépense est annulée.' }
    }

    const { data: depense } = await adminClient
        .from('expenses')
        .select('id, public_id, libelle, montant, est_annule')
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!depense) return { erreur: 'Dépense introuvable.' }
    if (depense.est_annule) return { erreur: 'Cette dépense est déjà annulée.' }

    const { error } = await adminClient
        .from('expenses')
        .update({
            est_annule:       true,
            annule_le:        new Date().toISOString(),
            annule_par:       user.user_metadata.user_id,
            motif_annulation: motifPropre,
        })
        .eq('id', id)
        .eq('shop_id', shopId)

    if (error) {
        console.error('ERREUR ANNULATION DEPENSE:', error)
        return { erreur: 'Erreur lors de l\'annulation.' }
    }

    await journaliserCorrection({
        user,
        eventType:         'EXPENSE_CANCELLED',
        referenceType:     'expense',
        referenceId:       id,
        referencePublicId: depense.public_id,
        motif:             motifPropre,
        modifications: [{
            champ: 'montant', libelle: 'Montant retiré des totaux',
            avant: depense.montant, apres: 0,
        }],
    })

    revalidatePath('/compta/depenses')
    revalidatePath(`/compta/depenses/${id}`)
    revalidatePath('/compta/dashboard')
    return { succes: true }
}

// ── Renommer une catégorie de dépense ─────────────────────────
export async function modifierCategorieDepense(id: string, nom: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.DEPENSES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()
    const nouveauNom  = nom?.trim() ?? ''

    if (!nouveauNom) return { erreur: 'Le nom est obligatoire.' }

    const { data: avant } = await adminClient
        .from('expense_categories')
        .select('id, nom')
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!avant) return { erreur: 'Catégorie introuvable.' }
    if (avant.nom === nouveauNom) return { succes: true, aucunChangement: true }

    const { error } = await adminClient
        .from('expense_categories')
        .update({ nom: nouveauNom })
        .eq('id', id)
        .eq('shop_id', shopId)

    if (error) return { erreur: 'Une catégorie porte déjà ce nom.' }

    await journaliserCorrection({
        user,
        eventType:     'EXPENSE_CATEGORY_UPDATED',
        referenceType: 'expense_category',
        referenceId:   id,
        modifications: [{ champ: 'nom', libelle: 'Nom', avant: avant.nom, apres: nouveauNom }],
    })

    revalidatePath('/compta/depenses')
    return { succes: true }
}

// ── Activer / retirer une catégorie ───────────────────────────
// Retirée, la catégorie disparaît de la saisie mais reste lisible sur
// les dépenses passées : on ne réécrit pas l'histoire.
export async function basculerCategorieDepense(id: string, actif: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.DEPENSES_CREER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: categorie } = await adminClient
        .from('expense_categories')
        .select('id, nom, est_actif')
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!categorie) return { erreur: 'Catégorie introuvable.' }

    const { error } = await adminClient
        .from('expense_categories')
        .update({ est_actif: actif })
        .eq('id', id)
        .eq('shop_id', shopId)

    if (error) return { erreur: 'Erreur lors de la mise à jour.' }

    await journaliserCorrection({
        user,
        eventType:     actif ? 'EXPENSE_CATEGORY_ENABLED' : 'EXPENSE_CATEGORY_DISABLED',
        referenceType: 'expense_category',
        referenceId:   id,
        modifications: [{
            champ: 'est_actif', libelle: 'Proposée à la saisie',
            avant: categorie.est_actif, apres: actif,
        }],
    })

    revalidatePath('/compta/depenses')
    return { succes: true }
}

// ── Modifier un employé ───────────────────────────────────────
export async function modifierEmploye(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.SALAIRES_GERER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const id           = formData.get('id') as string
    const nomComplet   = (formData.get('nomComplet') as string)?.trim()
    const poste        = (formData.get('poste') as string)?.trim() || null
    const salaireBase  = parseFloat(formData.get('salaireBase') as string) || 0
    const telephone    = (formData.get('telephone') as string)?.trim() || null
    const dateEmbauche = (formData.get('dateEmbauche') as string) || null

    if (!id) return { erreur: 'Employé introuvable.' }
    if (!nomComplet) return { erreur: 'Le nom est obligatoire.' }
    if (salaireBase < 0) return { erreur: 'Le salaire de base ne peut pas être négatif.' }
    if (dateEmbauche && !/^\d{4}-\d{2}-\d{2}$/.test(dateEmbauche)) {
        return { erreur: 'Date d\'embauche invalide.' }
    }

    const { data: avant } = await adminClient
        .from('employees')
        .select('id, nom_complet, poste, salaire_base, telephone, date_embauche')
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!avant) return { erreur: 'Employé introuvable.' }

    const apres = {
        nom_complet:   nomComplet,
        poste,
        salaire_base:  salaireBase,
        telephone,
        date_embauche: dateEmbauche || null,
    }

    const modifications = champsModifies(avant, apres, {
        nom_complet:   'Nom',
        poste:         'Poste',
        salaire_base:  'Salaire de base',
        telephone:     'Téléphone',
        date_embauche: 'Date d\'embauche',
    })

    if (modifications.length === 0) return { succes: true, aucunChangement: true }

    const { error } = await adminClient
        .from('employees')
        .update(apres)
        .eq('id', id)
        .eq('shop_id', shopId)

    if (error) {
        console.error('ERREUR MODIFICATION EMPLOYE:', error)
        return { erreur: 'Erreur lors de la modification.' }
    }

    await journaliserCorrection({
        user,
        eventType:     'EMPLOYEE_UPDATED',
        referenceType: 'employee',
        referenceId:   id,
        modifications,
    })

    revalidatePath('/compta/salaires')
    revalidatePath(`/compta/salaires/${id}`)
    return { succes: true }
}

// ── Désactiver / réintégrer un employé ────────────────────────
// Les versements déjà faits restent au rapport de paie : désactiver
// range un employé sorti, cela n'efface pas ce qu'on lui a versé.
export async function basculerEmploye(id: string, actif: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.SALAIRES_GERER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: employe } = await adminClient
        .from('employees')
        .select('id, nom_complet, est_actif')
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!employe) return { erreur: 'Employé introuvable.' }

    const { error } = await adminClient
        .from('employees')
        .update({
            est_actif:    actif,
            desactive_le: actif ? null : new Date().toISOString(),
        })
        .eq('id', id)
        .eq('shop_id', shopId)

    if (error) return { erreur: 'Erreur lors de la mise à jour.' }

    await journaliserCorrection({
        user,
        eventType:     actif ? 'EMPLOYEE_REACTIVATED' : 'EMPLOYEE_DEACTIVATED',
        referenceType: 'employee',
        referenceId:   id,
        modifications: [{
            champ: 'est_actif', libelle: 'Employé actif',
            avant: employe.est_actif, apres: actif,
        }],
    })

    revalidatePath('/compta/salaires')
    revalidatePath(`/compta/salaires/${id}`)
    return { succes: true }
}

// ── Modifier un versement de salaire ──────────────────────────
export async function modifierVersementSalaire(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.SALAIRES_GERER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const id           = formData.get('id') as string
    const salaireBase  = parseFloat(formData.get('salaireBase') as string) || 0
    const bonus        = parseFloat(formData.get('bonus') as string) || 0
    const deductions   = parseFloat(formData.get('deductions') as string) || 0
    const moyen        = (formData.get('moyen') as string) || 'cash'
    const datePaiement = (formData.get('datePaiement') as string) || ''
    const montantNet   = salaireBase + bonus - deductions

    if (!id) return { erreur: 'Versement introuvable.' }
    if (montantNet <= 0) return { erreur: 'Le montant net doit être positif.' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePaiement)) return { erreur: 'Date de versement invalide.' }
    if (datePaiement > new Date().toISOString().split('T')[0]) {
        return { erreur: 'La date de versement ne peut pas être dans le futur.' }
    }

    const { data: avant } = await adminClient
        .from('salary_payments')
        .select('id, public_id, salaire_base, bonus, deductions, montant_net, moyen_paiement, date_paiement, est_annule')
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!avant) return { erreur: 'Versement introuvable.' }
    if (avant.est_annule) return { erreur: 'Ce versement est annulé : il ne peut plus être modifié.' }

    const apres = {
        salaire_base:   salaireBase,
        bonus,
        deductions,
        montant_net:    montantNet,
        moyen_paiement: moyen,
        date_paiement:  datePaiement,
    }

    const modifications = champsModifies(avant, apres, {
        salaire_base:   'Base',
        bonus:          'Bonus',
        deductions:     'Déductions',
        montant_net:    'Net versé',
        moyen_paiement: 'Moyen de paiement',
        date_paiement:  'Date de versement',
    })

    if (modifications.length === 0) return { succes: true, aucunChangement: true }

    const { error } = await adminClient
        .from('salary_payments')
        .update({ ...apres, modifie_le: new Date().toISOString(), modifie_par: user.user_metadata.user_id })
        .eq('id', id)
        .eq('shop_id', shopId)

    if (error) {
        console.error('ERREUR MODIFICATION VERSEMENT:', error)
        return { erreur: 'Erreur lors de la modification.' }
    }

    await journaliserCorrection({
        user,
        eventType:         'SALARY_PAYMENT_UPDATED',
        referenceType:     'salary_payment',
        referenceId:       id,
        referencePublicId: avant.public_id,
        modifications,
    })

    revalidatePath('/compta/salaires')
    revalidatePath('/compta/dashboard')
    return { succes: true }
}

// ── Annuler un versement de salaire ───────────────────────────
export async function annulerVersementSalaire(id: string, motif: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.SALAIRES_GERER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()
    const motifPropre = motif?.trim() ?? ''

    if (motifPropre.length < MOTIF_MINIMUM) {
        return { erreur: 'Expliquez en quelques mots pourquoi ce versement est annulé.' }
    }

    const { data: versement } = await adminClient
        .from('salary_payments')
        .select('id, public_id, montant_net, est_annule')
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!versement) return { erreur: 'Versement introuvable.' }
    if (versement.est_annule) return { erreur: 'Ce versement est déjà annulé.' }

    const { error } = await adminClient
        .from('salary_payments')
        .update({
            est_annule:       true,
            annule_le:        new Date().toISOString(),
            annule_par:       user.user_metadata.user_id,
            motif_annulation: motifPropre,
        })
        .eq('id', id)
        .eq('shop_id', shopId)

    if (error) {
        console.error('ERREUR ANNULATION VERSEMENT:', error)
        return { erreur: 'Erreur lors de l\'annulation.' }
    }

    await journaliserCorrection({
        user,
        eventType:         'SALARY_PAYMENT_CANCELLED',
        referenceType:     'salary_payment',
        referenceId:       id,
        referencePublicId: versement.public_id,
        motif:             motifPropre,
        modifications: [{
            champ: 'montant_net', libelle: 'Montant retiré des totaux',
            avant: versement.montant_net, apres: 0,
        }],
    })

    revalidatePath('/compta/salaires')
    revalidatePath('/compta/dashboard')
    return { succes: true }
}
