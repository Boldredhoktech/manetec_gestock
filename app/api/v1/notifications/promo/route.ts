import { NextRequest, NextResponse } from 'next/server'
import { envoyerEmailPromo }         from '@/lib/resend/notifications'
import { createClient }              from '@/lib/supabase/server'
import { getPlanBoutique }           from '@/lib/supabase/getPlanBoutique'

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return new NextResponse('Non autorisé', { status: 401 })
    }

    // Communications promotionnelles : réservé au plan Enterprise (lu en base)
    const { limites } = await getPlanBoutique(user.user_metadata.shop_id)
    if (!limites.communications) {
        return NextResponse.json(
            { erreur: 'Les communications promotionnelles sont réservées au plan Enterprise.' },
            { status: 403 },
        )
    }

    const body = await request.json()
    const { emailDestinataire, nomClient, nomBoutique, titre, message } = body

    if (!emailDestinataire || !titre || !message) {
        return NextResponse.json({ erreur: 'Données manquantes' }, { status: 400 })
    }

    const result = await envoyerEmailPromo({
        emailDestinataire,
        nomClient,
        nomBoutique,
        titre,
        message,
        urlApp: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    })

    return NextResponse.json(result)
}