import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes publiques — accessibles sans authentification
const ROUTES_PUBLIQUES = [
    '/redhok/login',
    '/login',
]

// Routes réservées à la plateforme Bold Redhok Tech
const ROUTES_PLATEFORME = ['/redhok']

// Routes réservées aux boutiques
const ROUTES_BOUTIQUE = ['/admin', '/pos', '/stock', '/compta']

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Laisser passer les ressources statiques et API
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.includes('.')
    ) {
        return NextResponse.next()
    }

    // Laisser passer les routes publiques
    if (ROUTES_PUBLIQUES.some(route => pathname.startsWith(route))) {
        return NextResponse.next()
    }

    let response = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Vérifier la session Supabase
    const { data: { user } } = await supabase.auth.getUser()

    // ── Protection routes plateforme /redhok ──────────────────
    if (ROUTES_PLATEFORME.some(route => pathname.startsWith(route))) {
        if (!user) {
            return NextResponse.redirect(new URL('/redhok/login', request.url))
        }

        // Vérifier que c'est bien un admin plateforme
        const rolePlateforme = user.user_metadata?.type_acteur
        if (rolePlateforme !== 'platform') {
            return NextResponse.redirect(new URL('/redhok/login', request.url))
        }

        return response
    }

    // ── Protection routes boutique ─────────────────────────────
    if (ROUTES_BOUTIQUE.some(route => pathname.startsWith(route))) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        const rolePlateforme = user.user_metadata?.type_acteur
        if (rolePlateforme === 'platform') {
            return NextResponse.redirect(new URL('/redhok/dashboard', request.url))
        }

        return response
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}