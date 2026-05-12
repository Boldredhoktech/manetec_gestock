import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Routes publiques — accessibles sans authentification ───────
const ROUTES_PUBLIQUES = [
    '/redhok/login',
    '/login',
    '/inscription',   // Page création de boutique publique
    '/',              // Landing page
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

    // Laisser passer les routes publiques (exact match pour '/')
    if (pathname === '/') return NextResponse.next()
    if (ROUTES_PUBLIQUES.some(route => route !== '/' && pathname.startsWith(route))) {
        return NextResponse.next()
    }

    let response = NextResponse.next({ request })

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

    const { data: { user } } = await supabase.auth.getUser()

    // ── Protection routes plateforme /redhok ──────────────────
    if (ROUTES_PLATEFORME.some(route => pathname.startsWith(route))) {
        if (!user) {
            return NextResponse.redirect(new URL('/redhok/login', request.url))
        }
        if (user.user_metadata?.type_acteur !== 'platform') {
            return NextResponse.redirect(new URL('/redhok/login', request.url))
        }
        return response
    }

    // ── Protection routes boutique ─────────────────────────────
    if (ROUTES_BOUTIQUE.some(route => pathname.startsWith(route))) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url))
        }
        if (user.user_metadata?.type_acteur === 'platform') {
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