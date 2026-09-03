'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
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
    const reference    = (formData.get('reference') as string)?.trim() || null
    const note         = (formData.get('note') as string)?.trim() || null
    const montantNet   = salaireBase + bonus - deductions

    if (!employeeId || isNaN(mois) || isNaN(annee)) return { erreur: 'Données invalides.' }
    if (montantNet <= 0) return { erreur: 'Le montant net doit être positif.' }

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
        reference,
        note,
        created_by:     user.user_metadata.user_id,
    })

    if (error) return { erreur: 'Salaire déjà payé pour cette période ou erreur.' }

    revalidatePath('/compta/salaires')
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
export async function getTableauBordComptable(shopId: string, mois: number, annee: number) {
    const adminClient = createAdminClient()

    const debut = new Date(annee, mois - 1, 1).toISOString().split('T')[0]
    const fin   = new Date(annee, mois, 0).toISOString().split('T')[0]

    const [
        { data: ventes },
        { data: depenses },
        { data: salaires },
        { data: paiementsFournisseurs },
        { data: paiementsFactures },
    ] = await Promise.all([
        adminClient.from('sales')
            .select('montant_total, created_at')
            .eq('shop_id', shopId).eq('statut', 'completee')
            .gte('created_at', debut).lte('created_at', fin + 'T23:59:59'),
        adminClient.from('expenses')
            .select('montant, date_depense, libelle, expense_categories(nom)')
            .eq('shop_id', shopId)
            .gte('date_depense', debut).lte('date_depense', fin),
        adminClient.from('salary_payments')
            .select('montant_net')
            .eq('shop_id', shopId)
            .eq('periode_mois', mois).eq('periode_annee', annee),
        adminClient.from('supplier_payments')
            .select('montant, date_paiement')
            .eq('shop_id', shopId)
            .gte('date_paiement', debut).lte('date_paiement', fin),
        adminClient.from('facture_payments')
            .select('montant, created_at')
            .eq('shop_id', shopId)
            .gte('created_at', debut).lte('created_at', fin + 'T23:59:59'),
    ])

    const totalVentes      = ventes?.reduce((a, v) => a + v.montant_total, 0) ?? 0
    const totalDepenses    = depenses?.reduce((a, d) => a + d.montant, 0) ?? 0
    const totalSalaires    = salaires?.reduce((a, s) => a + s.montant_net, 0) ?? 0
    const totalFournisseurs = paiementsFournisseurs?.reduce((a, p) => a + p.montant, 0) ?? 0
    const totalFactures    = paiementsFactures?.reduce((a, p) => a + p.montant, 0) ?? 0
    const totalEntrees     = totalVentes + totalFactures
    const totalSorties     = totalDepenses + totalSalaires + totalFournisseurs
    const resultat         = totalEntrees - totalSorties

    return {
        totalVentes,
        totalFactures,
        totalEntrees,
        totalDepenses,
        totalSalaires,
        totalFournisseurs,
        totalSorties,
        resultat,
        nbVentes:   ventes?.length ?? 0,
        depenses:   depenses ?? [],
    }
}