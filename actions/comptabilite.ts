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

    // Vérifier qu'il n'y a pas d'inventaire en cours sur cet entrepôt
    const { data: enCours } = await adminClient
        .from('inventories')
        .select('id, nom')
        .eq('shop_id', shopId)
        .eq('warehouse_id', warehouseId)
        .eq('statut', 'en_cours')
        .single()

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

    // Charger tous les produits avec leur stock actuel
    const { data: stocks } = await adminClient
        .from('stock_levels')
        .select(`
      product_id, quantite,
      products(nom, unite, prix_achat, seuil_alerte, categories(nom))
    `)
        .eq('shop_id', shopId)
        .eq('warehouse_id', warehouseId)

    if (stocks && stocks.length > 0) {
        await adminClient.from('inventory_items').insert(
            stocks.map(s => ({
                shop_id:             shopId,
                inventory_id:        inventaire.id,
                product_id:          s.product_id,
                quantite_theorique:  s.quantite,
                quantite_reelle:     null,
                ecart:               null,
            }))
        )
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

    const adminClient = createAdminClient()

    const { data: item } = await adminClient
        .from('inventory_items')
        .select('quantite_theorique')
        .eq('id', inventoryItemId)
        .single()

    if (!item) return { erreur: 'Article introuvable.' }

    await adminClient.from('inventory_items').update({
        quantite_reelle: quantiteReelle,
        ecart:           quantiteReelle - item.quantite_theorique,
    }).eq('id', inventoryItemId)

    revalidatePath('/compta/inventaire')
    return { succes: true }
}

// ── Valider un inventaire (avec règle C5) ─────────────────────
export async function validerInventaire(inventoryId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    if (!aPermission(user, PERMISSIONS.STOCK_INVENTAIRE_VALIDER)) return { erreur: 'Permission insuffisante pour cette action.' }

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    // Vérifier que tous les articles ont été comptés
    const { data: nonComptes } = await adminClient
        .from('inventory_items')
        .select('id')
        .eq('inventory_id', inventoryId)
        .is('quantite_reelle', null)

    if (nonComptes && nonComptes.length > 0) {
        return {
            erreur: `${nonComptes.length} article(s) n'ont pas encore été comptés. Complétez le comptage avant de valider.`,
        }
    }

    // Appliquer les ajustements SQL
    const { data: result } = await adminClient.rpc('valider_inventaire', {
        p_inventory_id: inventoryId,
        p_shop_id:      shopId,
        p_user_id:      user.user_metadata.user_id,
    })

    if (!result?.succes) return { erreur: result?.erreur ?? 'Erreur lors de la validation.' }

    // Règle C5 : écarts négatifs → dépense automatique "Pertes inventaire"
    const { data: items } = await adminClient
        .from('inventory_items')
        .select(`
      ecart, quantite_theorique, quantite_reelle,
      products(nom, prix_achat)
    `)
        .eq('inventory_id', inventoryId)
        .lt('ecart', 0)

    let valeurPertes = 0
    let valeurGains  = 0
    let nbNegatifs   = 0
    let nbPositifs   = 0

    // Calculer les gains (écarts positifs)
    const { data: itemsPositifs } = await adminClient
        .from('inventory_items')
        .select('ecart, products(prix_achat)')
        .eq('inventory_id', inventoryId)
        .gt('ecart', 0)

    itemsPositifs?.forEach(item => {
        valeurGains += Math.abs(item.ecart ?? 0) * ((item.products as any)?.prix_achat ?? 0)
        nbPositifs++
    })

    if (items && items.length > 0) {
        nbNegatifs = items.length

        for (const item of items) {
            const prixAchat   = (item.products as any)?.prix_achat ?? 0
            const nomProduit  = (item.products as any)?.nom ?? 'Produit'
            const valeurPerte = Math.abs(item.ecart ?? 0) * prixAchat
            valeurPertes += valeurPerte

            if (valeurPerte > 0) {
                // Créer une catégorie "Pertes inventaire" si elle n'existe pas
                let { data: cat } = await adminClient
                    .from('expense_categories')
                    .select('id')
                    .eq('shop_id', shopId)
                    .eq('nom', 'Pertes inventaire')
                    .single()

                if (!cat) {
                    const { data: nouvelleCat } = await adminClient
                        .from('expense_categories')
                        .insert({ shop_id: shopId, nom: 'Pertes inventaire', est_actif: true })
                        .select('id').single()
                    cat = nouvelleCat
                }

                // Créer la dépense automatique
                const { data: publicId } = await adminClient
                    .rpc('generate_public_id', { p_shop_id: shopId, p_prefix: 'EXP' })

                await adminClient.from('expenses').insert({
                    public_id:      publicId,
                    shop_id:        shopId,
                    category_id:    cat?.id ?? null,
                    libelle:        `Perte inventaire — ${nomProduit} (écart: ${item.ecart})`,
                    montant:        valeurPerte,
                    moyen_paiement: 'cash',
                    date_depense:   new Date().toISOString().split('T')[0],
                    note:           `Généré automatiquement lors de la validation de l'inventaire ${inventoryId}`,
                    created_by:     user.user_metadata.user_id,
                })
            }
        }
    }

    // Mettre à jour les stats de l'inventaire
    await adminClient.from('inventories').update({
        valeur_pertes:       valeurPertes,
        valeur_gains:        valeurGains,
        nb_ecarts_negatifs:  nbNegatifs,
        nb_ecarts_positifs:  nbPositifs,
    }).eq('id', inventoryId)

    revalidatePath('/compta/inventaire')
    revalidatePath('/compta/depenses')
    return { succes: true, valeurPertes, valeurGains, nbNegatifs }
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