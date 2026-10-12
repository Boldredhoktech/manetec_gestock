// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { etatAbonnement, peutEntrerBoutiqueExpiree, CHEMIN_ABONNEMENT } from '@/lib/abonnement/regle'

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

// ── Déconnexion automatique après inactivité ───────────────────
// 10 heures sans navigation = session expirée. Basé sur un cookie
// horodaté persistant : fonctionne même si l'appareil a été éteint.
const INACTIVITE_MAX_MS = 10 * 60 * 60 * 1000          // 10 heures
const COOKIE_ACTIVITE   = 'manetec_activite'
const COOKIE_ACTIVITE_MAX_AGE = 60 * 60 * 24 * 30       // 30 j (le cookie doit survivre > 10h)

// Construit une réponse qui déconnecte (efface les cookies Supabase + activité)
function reponseDeconnexion(request: NextRequest, urlLogin: string) {
    const res = NextResponse.redirect(new URL(urlLogin, request.url))
    for (const c of request.cookies.getAll()) {
        if (c.name.startsWith('sb-') || c.name === COOKIE_ACTIVITE) {
            res.cookies.delete(c.name)
        }
    }
    return res
}

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
                setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
                    )
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    const maintenant = Date.now()
    // Vérifie l'inactivité : true si la dernière activité date de plus de 10h
    const inactiviteExpiree = () => {
        const ts = Number(request.cookies.get(COOKIE_ACTIVITE)?.value ?? 0)
        return ts > 0 && (maintenant - ts) > INACTIVITE_MAX_MS
    }
    // Rafraîchit l'horodatage d'activité sur la réponse
    const marquerActivite = () => {
        response.cookies.set(COOKIE_ACTIVITE, String(maintenant), {
            httpOnly: true, sameSite: 'lax', path: '/', maxAge: COOKIE_ACTIVITE_MAX_AGE,
        })
    }

    // ── Protection routes plateforme /redhok ──────────────────
    if (ROUTES_PLATEFORME.some(route => pathname.startsWith(route))) {
        if (!user) {
            return NextResponse.redirect(new URL('/redhok/login', request.url))
        }
        if (user.user_metadata?.type_acteur !== 'platform') {
            return NextResponse.redirect(new URL('/redhok/login', request.url))
        }
        if (inactiviteExpiree()) {
            return reponseDeconnexion(request, '/redhok/login?inactif=1')
        }
        marquerActivite()
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
        if (inactiviteExpiree()) {
            return reponseDeconnexion(request, '/login?inactif=1')
        }

        // ── Licence (D3) ───────────────────────────────────────
        // Contrôlée ICI et non dans le layout : en App Router, un layout
        // n'est pas réexécuté lors d'une navigation côté client, donc un
        // lien de la sidebar échappait au contrôle. Le middleware voit
        // chaque requête. Lu en base (RLS : la boutique de la session),
        // jamais dans le JWT.
        const { data: boutique } = await supabase
            .from('shops')
            .select('est_active, plan_expire_le')
            .eq('id', user.user_metadata?.shop_id)
            .maybeSingle()
        const etat = etatAbonnement(boutique)

        if (etat === 'desactive') {
            return reponseDeconnexion(request, '/login?suspendu=desactive')
        }
        if (etat === 'expire') {
            // Seul l'administrateur reste connecté, et seulement pour payer.
            if (!peutEntrerBoutiqueExpiree(user.user_metadata?.role)) {
                return reponseDeconnexion(request, '/login?suspendu=expire')
            }
            if (pathname !== CHEMIN_ABONNEMENT) {
                return NextResponse.redirect(new URL(CHEMIN_ABONNEMENT, request.url))
            }
        }

        marquerActivite()
        return response
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}