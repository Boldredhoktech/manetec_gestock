// app/api/v1/upload/logo/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadImageCloudinary } from '@/lib/cloudinary'
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

    // Upload sur Cloudinary
    const arrayBuffer = await fichier.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)

    let logoUrl: string
    try {
        const res = await uploadImageCloudinary(buffer, `shops/${shopId}`, 'logo')
        logoUrl = res.url
    } catch (e) {
        console.error('ERREUR UPLOAD LOGO CLOUDINARY:', e)
        return NextResponse.json(
            { erreur: 'Erreur lors de l\'upload du logo.' },
            { status: 500 }
        )
    }

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