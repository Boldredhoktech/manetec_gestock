// lib/cloudinary.ts
// ═══════════════════════════════════════════════════════════════
// Gestion centralisée des fichiers / images / documents via Cloudinary.
// Supabase Storage n'est plus utilisé pour les fichiers.
// ═══════════════════════════════════════════════════════════════

import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true,
})

const RACINE = process.env.CLOUDINARY_FOLDER || 'manetec_gestock'

export interface UploadResultat {
    url:       string
    publicId:  string
}

/**
 * Téléverse une image (buffer) sur Cloudinary.
 * @param buffer   Contenu binaire du fichier.
 * @param sousDossier  Sous-dossier sous la racine (ex: `shops/<id>`).
 * @param publicId Nom du fichier sans extension (ex: `logo`). Écrase l'existant.
 */
export async function uploadImageCloudinary(
    buffer: Buffer,
    sousDossier: string,
    publicId: string,
): Promise<UploadResultat> {
    return new Promise((resolve, reject) => {
        const flux = cloudinary.uploader.upload_stream(
            {
                folder:        `${RACINE}/${sousDossier}`.replace(/\/+$/, ''),
                public_id:     publicId,
                overwrite:     true,
                invalidate:    true,
                resource_type: 'image',
                // Limite la taille stockée (logos légers pour l'app et les PDF)
                transformation: [{ width: 600, height: 600, crop: 'limit' }, { quality: 'auto' }],
            },
            (erreur, resultat) => {
                if (erreur || !resultat) {
                    return reject(erreur ?? new Error('Upload Cloudinary échoué'))
                }
                resolve({ url: resultat.secure_url, publicId: resultat.public_id })
            },
        )
        flux.end(buffer)
    })
}

export { cloudinary }
