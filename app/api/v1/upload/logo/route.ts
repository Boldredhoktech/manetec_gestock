// app/api/v1/upload/logo/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function POST(request: NextRequest) {
    // Vérifier l'authentification
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return NextResponse.json({ erreur: 'Non autorisé.' }, { status: 401 })
    }

    if (user.user_metadata?.role !== 'super_admin_boutique') {
        return NextResponse.json({ erreur: 'Réservé au SuperAdmin.' }, { status: 403 })
    }

    const shopId = user.user_metadata.shop_id as string

    // Lire le fichier depuis la requête multipart
    let fichier: File | null = null
    try {
        const formData = await request.formData()
        fichier = formData.get('logo') as File | null
    } catch {
        return NextResponse.json({ erreur: 'Données invalides.' }, { status: 400 })
    }

    if (!fichier || fichier.size === 0) {
        return NextResponse.json({ erreur: 'Aucun fichier sélectionné.' }, { status: 400 })
    }

    // Validations
    if (fichier.size > 2 * 1024 * 1024) {
        return NextResponse.json({ erreur: 'Le logo ne doit pas dépasser 2 Mo.' }, { status: 400 })
    }

    const ext = fichier.name.split('.').pop()?.toLowerCase()
    const extsOk = ['jpg', 'jpeg', 'png', 'webp', 'svg']
    if (!ext || !extsOk.includes(ext)) {
        return NextResponse.json(
            { erreur: 'Format non supporté. Utilisez JPG, PNG, WEBP ou SVG.' },
            { status: 400 }
        )
    }

    const adminClient = createAdminClient()

    // Convertir le File en ArrayBuffer pour Supabase Storage
    const arrayBuffer = await fichier.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)
    const chemin      = `logos/${shopId}/logo.${ext}`

    // Upload dans Supabase Storage
    const { error: uploadError } = await adminClient.storage
        .from('boutiques')
        .upload(chemin, buffer, {
            upsert:      true,
            contentType: fichier.type || `image/${ext}`,
        })

    if (uploadError) {
        console.error('ERREUR UPLOAD LOGO:', uploadError)
        return NextResponse.json(
            { erreur: `Erreur lors de l'upload : ${uploadError.message}` },
            { status: 500 }
        )
    }

    // Récupérer l'URL publique avec cache-busting
    const { data: urlData } = adminClient.storage
        .from('boutiques')
        .getPublicUrl(chemin)

    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`

    // Enregistrer l'URL en base
    const { error: dbError } = await adminClient
        .from('shops')
        .update({ logo_url: logoUrl })
        .eq('id', shopId)

    if (dbError) {
        return NextResponse.json(
            { erreur: 'Logo uploadé mais non enregistré. Contactez le support.' },
            { status: 500 }
        )
    }

    revalidatePath('/admin/parametres')

    return NextResponse.json({ succes: true, logoUrl })
}