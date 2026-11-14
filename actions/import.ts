'use server'

// ═══════════════════════════════════════════════════════════════
// Imports Excel (mig 042) : analyser (aperçu), importer, annuler.
// Le shopId vient TOUJOURS de la session. L'analyse prévient ; la base
// (importer_*) reste l'arbitre final ligne par ligne.
// ═══════════════════════════════════════════════════════════════

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { refusAbonnement } from '@/lib/abonnement/etat'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { getPlanLimites } from '@/lib/constants/plans'
import { lireFichierImport } from '@/lib/import/lecture'
import {
    COLONNES, TYPES_IMPORT, type LigneAnalysee, type LigneImport, type TypeImport,
} from '@/lib/import/colonnes'

async function session() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') return { erreur: 'Non autorisé.' }
    const refus = await refusAbonnement(user)
    if (refus) return { erreur: refus }
    if (!aPermission(user, PERMISSIONS.IMPORTER_DONNEES)) return { erreur: 'Vous n\'avez pas la permission d\'importer des données.' }
    return { user, shopId: user.user_metadata.shop_id as string, userId: user.user_metadata.user_id as string }
}

const cle = (v: unknown) => {
    const s = String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
    return s || null
}
const cleTel = (v: unknown) => {
    const d = String(v ?? '').replace(/\D/g, '').slice(-8)
    return d || null
}

export interface ResultatAnalyse {
    type:             TypeImport
    nomFichier:       string
    lignes:           LigneAnalysee[]
    colonnesTrouvees: string[]
    enteteInconnues:  string[]
    dateDemarrage:    string | null
    quota:            { max: number; actuels: number } | null
}

// ── Analyse : lecture + contrôles, rien n'est écrit ───────────
export async function analyserImport(formData: FormData): Promise<ResultatAnalyse | { erreur: string }> {
    const s = await session()
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }

    const type = formData.get('type') as TypeImport
    const fichier = formData.get('fichier')
    if (!TYPES_IMPORT.includes(type)) return { erreur: 'Type d\'import invalide.' }
    if (!(fichier instanceof File) || fichier.size === 0) return { erreur: 'Choisissez un fichier Excel.' }
    if (!/\.xlsx$/i.test(fichier.name)) return { erreur: 'Le fichier doit être au format Excel (.xlsx).' }

    const lu = await lireFichierImport(type, await fichier.arrayBuffer())
    if (lu.erreurFichier) return { erreur: lu.erreurFichier }
    if (lu.lignes.length === 0) return { erreur: 'Aucune ligne remplie sous l\'en-tête.' }

    const db = createAdminClient()
    const { data: boutique } = await db.from('shops').select('plan, date_demarrage').eq('id', s.shopId).single()
    const limites = getPlanLimites(boutique?.plan ?? 'starter')

    const analysees: LigneAnalysee[] = lu.lignes.map(v => ({ ligne: v.ligne, valeurs: v, erreurs: [], notes: [], statut: 'ok' }))

    // Contrôles de forme communs : obligatoires, nombres, oui/non.
    for (const a of analysees) {
        for (const c of COLONNES[type]) {
            const v = a.valeurs[c.cle]
            if (c.obligatoire && (v === null || v === undefined || v === '')) a.erreurs.push(`${c.titre} manquant(e).`)
            if (typeof v === 'string' && v.startsWith('!')) {
                a.erreurs.push(c.genre === 'ouinon' ? `${c.titre} : « ${v.slice(1)} » — écrivez Oui ou Non.` : `${c.titre} : « ${v.slice(1)} » n'est pas un nombre.`)
            }
            if (typeof v === 'number' && v < 0) a.erreurs.push(`${c.titre} négatif(ve).`)
        }
    }

    let quota: ResultatAnalyse['quota'] = null

    if (type === 'produits') {
        const [{ data: produits }, { data: entrepots }, { data: cats }, { data: marques }] = await Promise.all([
            db.from('products').select('public_id, nom, sku, code_barres').eq('shop_id', s.shopId),
            db.from('warehouses').select('nom').eq('shop_id', s.shopId).eq('est_actif', true),
            db.from('categories').select('nom').eq('shop_id', s.shopId),
            db.from('brands').select('nom').eq('shop_id', s.shopId),
        ])
        const parRef = new Map((produits ?? []).filter(p => p.sku).map(p => [String(p.sku).toLowerCase(), p.public_id]))
        const parCb  = new Map((produits ?? []).filter(p => p.code_barres).map(p => [String(p.code_barres), p.public_id]))
        const parNom = new Map((produits ?? []).map(p => [cle(p.nom), p.public_id]))
        const nomsEntrepots = new Set((entrepots ?? []).map(e => cle(e.nom)))
        const catsConnues = new Set((cats ?? []).map(c => cle(c.nom)))
        const marquesConnues = new Set((marques ?? []).map(m => cle(m.nom)))
        const vus = new Map<string, Set<string>>()   // produit du fichier → entrepôts déjà vus
        const max = limites.max_produits
        let nouveaux = 0
        quota = { max, actuels: produits?.length ?? 0 }

        for (const a of analysees) {
            if (a.erreurs.length) continue
            const v = a.valeurs
            const ref = v.reference ? String(v.reference).toLowerCase() : null
            const existe = (ref && parRef.get(ref)) || (v.code_barres && parCb.get(String(v.code_barres))) || parNom.get(cle(v.nom))
            if (existe) { a.erreurs.push(`Existe déjà (${existe}) : ligne ignorée.`); continue }

            const qte = typeof v.quantite === 'number' ? v.quantite : 0
            const ent = cle(v.entrepot)
            if (qte > 0 && ent && !nomsEntrepots.has(ent)) { a.erreurs.push(`Entrepôt « ${v.entrepot} » inconnu.`); continue }
            if (qte > 0 && nomsEntrepots.size === 0) { a.erreurs.push('Aucun entrepôt : créez-en un avant d\'importer du stock.'); continue }

            const k = ref ?? (v.code_barres ? `cb:${v.code_barres}` : `nom:${cle(v.nom)}`)
            const lieu = ent ?? '(défaut)'
            if (vus.has(k)) {
                if (vus.get(k)!.has(lieu)) { a.erreurs.push('Doublon dans le fichier (même produit, même entrepôt).'); continue }
                vus.get(k)!.add(lieu)
                a.notes.push('Stock du même produit dans un autre entrepôt.')
            } else {
                if (max >= 0 && quota.actuels + nouveaux >= max) { a.erreurs.push(`Quota du forfait atteint (${max} produits).`); continue }
                vus.set(k, new Set([lieu]))
                nouveaux++
            }
            // Plus de création automatique : une catégorie / marque inconnue
            // est ignorée, le produit sera classé ensuite depuis sa fiche.
            const cat = cle(v.categorie), marque = cle(v.marque)
            if (cat && !catsConnues.has(cat)) a.notes.push(`Catégorie « ${v.categorie} » inconnue : produit importé sans catégorie.`)
            if (marque && !marquesConnues.has(marque)) a.notes.push(`Marque « ${v.marque} » inconnue : produit importé sans marque.`)
            if (qte > 0 && !ent) a.notes.push('Stock placé dans l\'entrepôt par défaut.')
        }
    }

    if (type === 'clients') {
        const { data: clients } = await db.from('clients').select('public_id, nom, telephone, est_anonyme').eq('shop_id', s.shopId)
        const parTel = new Map((clients ?? []).filter(c => cleTel(c.telephone)).map(c => [cleTel(c.telephone), c.public_id]))
        const parNom = new Map((clients ?? []).filter(c => !c.est_anonyme).map(c => [cle(c.nom), c.public_id]))
        const telsFichier = new Set<string>()
        const max = limites.max_clients
        quota = { max, actuels: (clients ?? []).filter(c => !c.est_anonyme).length }
        let nouveaux = 0
        for (const a of analysees) {
            if (a.erreurs.length) continue
            const v = a.valeurs
            const tel = cleTel(v.telephone)
            const existe = tel ? parTel.get(tel) : parNom.get(cle(v.nom))
            if (existe) { a.erreurs.push(`Existe déjà (${existe}) : ligne ignorée.`); continue }
            if (tel && telsFichier.has(tel)) { a.erreurs.push('Doublon dans le fichier (même téléphone).'); continue }
            if (max >= 0 && quota.actuels + nouveaux >= max) { a.erreurs.push(`Quota du forfait atteint (${max} clients).`); continue }
            if (tel) telsFichier.add(tel)
            nouveaux++
            if (typeof v.montant_du === 'number' && v.montant_du > 0) a.notes.push('Facture « Solde d\'ouverture » créée.')
        }
    }

    if (type === 'fournisseurs') {
        const { data: fournisseurs } = await db.from('suppliers').select('public_id, nom').eq('shop_id', s.shopId)
        const parNom = new Map((fournisseurs ?? []).map(f => [cle(f.nom), f.public_id]))
        const nomsFichier = new Set<string>()
        for (const a of analysees) {
            if (a.erreurs.length) continue
            const k = cle(a.valeurs.nom)!
            const existe = parNom.get(k)
            if (existe) { a.erreurs.push(`Existe déjà (${existe}) : ligne ignorée.`); continue }
            if (nomsFichier.has(k)) { a.erreurs.push('Doublon dans le fichier (même nom).'); continue }
            nomsFichier.add(k)
            if (typeof a.valeurs.montant_du === 'number' && a.valeurs.montant_du > 0) a.notes.push('Facture fournisseur « Solde d\'ouverture » créée.')
        }
    }

    for (const a of analysees) a.statut = a.erreurs.length ? 'rejet' : a.notes.length ? 'note' : 'ok'

    return {
        type, nomFichier: fichier.name, lignes: analysees,
        colonnesTrouvees: lu.colonnesTrouvees, enteteInconnues: lu.enteteInconnues,
        dateDemarrage: boutique?.date_demarrage ?? null, quota,
    }
}

// ── Import des lignes valides ─────────────────────────────────
export async function importerDonnees(
    type: TypeImport, lignes: LigneImport[], nomFichier: string, dateDemarrage: string | null,
    /** Lignes refusées dès l'aperçu : gardées dans l'import pour être retéléchargées et corrigées. */
    rejetsAnalyse: { ligne: number; motif: string; donnees: LigneImport }[] = [],
): Promise<{ succes: true; id: string; publicId: string; importees: number; rejets: { ligne: number; nom: string; motif: string }[] } | { erreur: string }> {
    const s = await session()
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }
    if (!TYPES_IMPORT.includes(type)) return { erreur: 'Type d\'import invalide.' }
    if (!Array.isArray(lignes) || lignes.length === 0) return { erreur: 'Aucune ligne à importer.' }
    if (!Array.isArray(rejetsAnalyse) || rejetsAnalyse.length > 5000) return { erreur: 'Données invalides.' }
    if (dateDemarrage && (!/^\d{4}-\d{2}-\d{2}$/.test(dateDemarrage) || dateDemarrage > new Date().toISOString().slice(0, 10))) {
        return { erreur: 'Date de démarrage invalide (pas dans le futur).' }
    }

    // On ne transmet que les colonnes connues, nettoyées.
    const cles = new Set(COLONNES[type].map(c => c.cle))
    const propres = lignes.map(l => Object.fromEntries(
        Object.entries(l).filter(([k, v]) => (k === 'ligne' || cles.has(k)) && v !== null && !(typeof v === 'string' && v.startsWith('!'))),
    ))

    const db = createAdminClient()
    const { data: boutique } = await db.from('shops').select('plan').eq('id', s.shopId).single()
    const limites = getPlanLimites(boutique?.plan ?? 'starter')
    const commun = { p_shop_id: s.shopId, p_lignes: propres, p_nom_fichier: nomFichier, p_date: dateDemarrage, p_user_id: s.userId }

    const { data, error } = type === 'produits'
        ? await db.rpc('importer_produits', { ...commun, p_max_produits: limites.max_produits })
        : type === 'clients'
            ? await db.rpc('importer_clients', { ...commun, p_max_clients: limites.max_clients })
            : await db.rpc('importer_fournisseurs', commun)

    if (error || !data?.succes) {
        console.error('ERREUR IMPORT:', error)
        return { erreur: error?.message?.startsWith('La date') ? error.message : 'L\'import n\'a pas pu être enregistré.' }
    }

    // L'import garde AUSSI les lignes refusées à l'aperçu, avec leur motif.
    const rejetsBase = (data.rejets ?? []) as { ligne: number; nom: string; motif: string; donnees?: unknown }[]
    if (rejetsAnalyse.length > 0) {
        const tous = [
            ...rejetsAnalyse.map(r => ({ ligne: r.ligne, nom: String(r.donnees?.nom ?? ''), motif: String(r.motif).slice(0, 300), donnees: r.donnees })),
            ...rejetsBase,
        ].sort((a, b) => a.ligne - b.ligne)
        await db.from('imports_donnees')
            .update({ rejets: tous, nb_rejetees: tous.length, nb_lignes: lignes.length + rejetsAnalyse.length })
            .eq('id', data.id).eq('shop_id', s.shopId)
    }

    revalidatePath('/admin/import')
    revalidatePath(type === 'produits' ? '/stock/produits' : type === 'clients' ? '/admin/clients' : '/stock/fournisseurs')
    return {
        succes: true, id: data.id, publicId: data.public_id, importees: data.importees,
        rejets: (data.rejets ?? []).map((r: { ligne: number; nom: string; motif: string }) => ({ ligne: r.ligne, nom: r.nom, motif: r.motif })),
    }
}

// ── Annuler un import ─────────────────────────────────────────
export async function annulerImport(id: string, motif: string): Promise<{ succes: true } | { erreur: string }> {
    const s = await session()
    if ('erreur' in s) return { erreur: s.erreur ?? 'Non autorisé.' }
    const { data, error } = await createAdminClient().rpc('annuler_import', {
        p_shop_id: s.shopId, p_import_id: id, p_motif: motif, p_user_id: s.userId,
    })
    if (error || !data?.succes) return { erreur: data?.erreur ?? 'Annulation impossible.' }
    revalidatePath('/admin/import')
    return { succes: true }
}
