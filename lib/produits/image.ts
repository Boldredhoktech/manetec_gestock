// ═══════════════════════════════════════════════════════════════
// Photo d'un produit (14/11) — réservée aux forfaits qui ont
// `images_produits` (Pro et au-dessus, essai compris).
//
// Le navigateur réduit déjà l'image et la convertit en WebP
// (ChampImageProduit) ; le serveur revérifie le forfait, le type et le
// poids, puis Cloudinary la stocke en WebP, 400 px au plus.
// Pas de 'use server' : appelée depuis les actions produits.
// ═══════════════════════════════════════════════════════════════

import { uploadImageCloudinary } from '@/lib/cloudinary'
import { getPlanLimites } from '@/lib/constants/plans'

export const IMAGE_PRODUIT_MAX_OCTETS = 300 * 1024
const TYPES_ACCEPTES = ['image/webp', 'image/png', 'image/jpeg']

type ClientAdmin = { from: (t: string) => any }

export async function imagesAutorisees(client: ClientAdmin, shopId: string): Promise<boolean> {
    const { data } = await client.from('shops').select('plan').eq('id', shopId).single()
    return getPlanLimites(data?.plan ?? 'starter').images_produits
}

/**
 * Applique la photo envoyée avec le formulaire : nouvelle image, retrait,
 * ou rien. Renvoie un avertissement lisible si l'image est refusée — la
 * fiche produit, elle, est enregistrée quand même.
 */
export async function appliquerImageProduit(
    client: ClientAdmin, shopId: string, productId: string, formData: FormData,
): Promise<string | null> {
    const fichier = formData.get('photo')
    const retirer = formData.get('retirerPhoto') === 'true'
    const aFichier = fichier instanceof File && fichier.size > 0
    if (!aFichier && !retirer) return null

    if (!(await imagesAutorisees(client, shopId))) return null   // forfait sans images : ignoré

    if (retirer && !aFichier) {
        await client.from('products').update({ photo_url: null }).eq('id', productId).eq('shop_id', shopId)
        return null
    }
    const f = fichier as File
    if (!TYPES_ACCEPTES.includes(f.type)) return 'Image ignorée : formats acceptés WebP (conseillé), PNG ou JPEG.'
    if (f.size > IMAGE_PRODUIT_MAX_OCTETS) return 'Image ignorée : elle dépasse 300 Ko.'

    try {
        const { url } = await uploadImageCloudinary(
            Buffer.from(await f.arrayBuffer()), `shops/${shopId}/produits`, productId,
            { largeur: 400, format: 'webp' },
        )
        await client.from('products').update({ photo_url: url }).eq('id', productId).eq('shop_id', shopId)
        return null
    } catch (e) {
        console.error('ERREUR IMAGE PRODUIT:', e)
        return 'Le produit est enregistré, mais l\'image n\'a pas pu être envoyée. Réessayez depuis sa fiche.'
    }
}
