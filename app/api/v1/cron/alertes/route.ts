import { NextRequest, NextResponse } from 'next/server'
import { verifierAbonnements } from '@/lib/resend/cron-alertes'

// Cette route est appelée par un cron Vercel (quotidiennement)
export async function GET(request: NextRequest) {
    // Sécuriser avec un token secret
    const token = request.headers.get('x-cron-token')
    if (token !== process.env.CRON_SECRET) {
        return new NextResponse('Non autorisé', { status: 401 })
    }

    const resultat = await verifierAbonnements()

    return NextResponse.json({
        succes: true,
        ...resultat,
        timestamp: new Date().toISOString(),
    })
}