// app/api/v1/cron/alertes/route.ts
// Appelée chaque jour par le cron Vercel (vercel.json).
//
// ABO-10 : Vercel envoie `Authorization: Bearer <CRON_SECRET>`. La route
// attendait un en-tête `x-cron-token` que personne n'envoie : chaque
// appel recevait 401 et aucune alerte d'expiration n'est jamais partie.

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { verifierAbonnements } from '@/lib/resend/cron-alertes'

function autorise(request: NextRequest): boolean {
    const secret = process.env.CRON_SECRET
    const recu   = request.headers.get('authorization')
    if (!secret || !recu) return false
    const a = Buffer.from(`Bearer ${secret}`)
    const b = Buffer.from(recu)
    return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: NextRequest) {
    if (!autorise(request)) {
        return new NextResponse('Non autorisé', { status: 401 })
    }

    const bilan = await verifierAbonnements()
    return NextResponse.json({ succes: true, ...bilan, horodatage: new Date().toISOString() })
}
