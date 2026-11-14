'use client'

// ═══════════════════════════════════════════════════════════════
// LA sidebar de la boutique. Une seule, pour toutes les sections.
//
// Il y en avait trois, choisies par l'URL : passer du stock à la
// comptabilité faisait disparaître la moitié du menu sous les doigts.
// Le menu vit maintenant dans lib/constants/navigation.ts et ne change
// plus d'une page à l'autre — seul le lien actif se déplace.
//
// Ce qu'on voit dépend de ce qu'on a le droit de faire, jamais de
// l'endroit où l'on se trouve : chaque lien porte la permission que la
// page vérifie côté serveur, et `usePermission` répond exactement comme
// `aPermission`. Un lien affiché mène donc toujours quelque part.
// ═══════════════════════════════════════════════════════════════

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CHEMIN_ABONNEMENT } from '@/lib/abonnement/regle'
import { labelPlan } from '@/lib/abonnement/catalogue'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LogOut, User, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deconnexion } from '@/actions/auth'
import { useSessionBoutique } from '@/hooks/useSession'
import { usePermission } from '@/hooks/usePermission'
import SidebarDrawer from '@/components/shared/SidebarDrawer'
import { getPlanLimites } from '@/lib/constants/plans'
import { estAdminComplet } from '@/lib/constants/permissions'
import { NAVIGATION_BOUTIQUE } from '@/lib/constants/navigation'
import SelecteurTheme from '@/components/shop/SelecteurTheme'
import NavBasMobile from '@/components/shop/NavBasMobile'
import { EVENEMENT_RECHERCHE } from '@/components/shop/RechercheGlobale'

// Les tableaux de bord sont préfixes de tout leur univers : sans cette
// exception, « /admin/dashboard » resterait allumé sur chaque page admin.
const RACINES = ['/admin/dashboard', '/compta/dashboard']

const CLE_DEFILEMENT = 'manetec.sidebar.defilement'
const CLE_REPLIE = 'manetec.sidebar.replie'

interface Props {
    /** Plan lu en base par le wrapper. Plus de repli sur le JWT (ABO-19) :
     *  figé à la connexion, il ignorerait un plan payé entre-temps. */
    planReel:  string
    /** Boutique expirée (D3) : seul le lien Abonnement reste utile. */
    expiree?:  boolean
}

export default function SidebarBoutique({ planReel, expiree = false }: Props) {
    const pathname       = usePathname()
    const { session }    = useSessionBoutique()
    const { peutFaire }  = usePermission()

    // Le menu garde sa position d'une page à l'autre (chaque section a son
    // propre layout, donc sa propre barre) et l'élément actif est toujours
    // ramené dans la zone visible : sinon, après un clic sur « Trésorerie »,
    // la barre repartait du haut et cachait la page en cours.
    const refNav = useRef<HTMLElement>(null)

    // Barre repliée en icônes (ordinateur), mémorisée sur l'appareil.
    const [replie, setReplie] = useState(false)
    useEffect(() => { try { setReplie(localStorage.getItem(CLE_REPLIE) === '1') } catch { /* indisponible */ } }, [])
    const basculerRepli = () => setReplie(r => {
        try { localStorage.setItem(CLE_REPLIE, r ? '0' : '1') } catch { /* indisponible */ }
        return !r
    })
    // Repliée, un libellé n'existe plus qu'en info-bulle (ordinateur seulement).
    const libelle = replie ? 'lg:sr-only' : ''
    const memoriserDefilement = () => {
        try { sessionStorage.setItem(CLE_DEFILEMENT, String(refNav.current?.scrollTop ?? 0)) } catch { /* indisponible */ }
    }

    const limites       = getPlanLimites(planReel)
    const estSuperAdmin = estAdminComplet(session?.role)

    // Tant que la session n'est pas lue, on n'affiche aucun lien plutôt
    // que de les montrer tous puis d'en retirer : un menu qui rétrécit
    // sous les yeux est ce qu'on cherche précisément à supprimer.
    const navigation = session
        ? NAVIGATION_BOUTIQUE
            .map(groupe => ({
                ...groupe,
                items: groupe.items.filter(item =>
                    (!expiree || item.href === CHEMIN_ABONNEMENT) &&
                    (!item.permission || peutFaire(item.permission)) &&
                    (!item.plan || limites[item.plan])
                ),
            }))
            .filter(groupe => groupe.items.length > 0)
        : []

    // Après chaque navigation (et quand le menu apparaît) : on reprend la
    // position mémorisée, puis on s'assure que l'élément actif est visible.
    const nbLiens = navigation.reduce((n, g) => n + g.items.length, 0)
    useLayoutEffect(() => {
        const nav = refNav.current
        if (!nav || nbLiens === 0) return
        try {
            const memo = Number(sessionStorage.getItem(CLE_DEFILEMENT))
            if (Number.isFinite(memo)) nav.scrollTop = memo
        } catch { /* indisponible */ }
        const actif = nav.querySelector<HTMLElement>('.sidebar-item.active')
        if (actif) {
            const haut = actif.offsetTop - nav.offsetTop
            const visible = haut >= nav.scrollTop && haut + actif.offsetHeight <= nav.scrollTop + nav.clientHeight
            if (!visible) nav.scrollTop = Math.max(0, haut - nav.clientHeight / 2 + actif.offsetHeight / 2)
        }
        memoriserDefilement()
    }, [pathname, nbLiens])

    return (
        <>
        <SidebarDrawer title={session?.shop_nom ?? 'Boutique'} replie={replie}>

            <div className={cn('sidebar-logo-zone py-4', replie ? 'px-4 lg:px-3' : 'px-4')}>
                <div className={cn('flex items-center gap-2.5', replie && 'lg:flex-col lg:gap-3')}>
                    <div className="bg-white p-1 rounded-lg shrink-0">
                        <Image src="/logo/app_logo.png" alt="Manetec Gestock" width={32} height={32}
                               className="object-contain w-8 h-8" />
                    </div>
                    <div className={cn('min-w-0 flex-1', replie && 'lg:hidden')}>
                        <p className="text-sm font-bold text-white leading-none truncate">
                            {session?.shop_nom ?? 'Boutique'}
                        </p>
                        {estSuperAdmin ? (
                            <Link href="/admin/abonnement"
                                  className="text-xs mt-0.5 font-semibold capitalize hover:underline transition-opacity hover:opacity-80"
                                  style={{ color: '#FACC15' }}>
                                Plan {labelPlan(planReel)}
                            </Link>
                        ) : (
                            <p className="text-xs mt-0.5 font-semibold capitalize" style={{ color: '#FACC15' }}>
                                Plan {labelPlan(planReel)}
                            </p>
                        )}
                    </div>
                    <button type="button" onClick={basculerRepli}
                            aria-label={replie ? 'Déplier le menu' : 'Replier le menu'} title={replie ? 'Déplier le menu' : 'Replier le menu'}
                            className="hidden lg:flex w-8 h-8 shrink-0 rounded-lg border border-white/15 text-[#C9D4F0] items-center justify-center hover:bg-white/10">
                        {replie ? <PanelLeftOpen className="w-4 h-4" aria-hidden="true" /> : <PanelLeftClose className="w-4 h-4" aria-hidden="true" />}
                    </button>
                </div>

                <button type="button" onClick={() => window.dispatchEvent(new Event(EVENEMENT_RECHERCHE))}
                        title="Rechercher une page (Ctrl+K)"
                        className={cn('mt-3 w-full flex items-center gap-2 h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-[#C9D4F0] text-sm hover:bg-white/10',
                            replie && 'lg:justify-center lg:px-0')}>
                    <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className={cn('flex-1 text-left', libelle)}>Rechercher…</span>
                    <kbd className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border border-white/15', replie && 'lg:hidden')}>Ctrl K</kbd>
                </button>
            </div>

            <nav ref={refNav} onScroll={memoriserDefilement} aria-label="Navigation principale"
                 className="flex-1 min-h-0 px-3 py-4 space-y-5 overflow-y-auto overscroll-contain">
                {navigation.map(groupe => (
                    <div key={groupe.groupe}>
                        <p className={cn('sidebar-group-label px-3 mb-1.5', replie && 'lg:sr-only')}>{groupe.groupe}</p>
                        <div className="space-y-0.5">
                            {groupe.items.map(item => {
                                const Icone = item.icone
                                const actif = pathname === item.href ||
                                    (!RACINES.includes(item.href) && pathname.startsWith(item.href))
                                const classe = cn(
                                    'sidebar-item flex items-center gap-3 px-3 py-2.5',
                                    replie && 'lg:justify-center lg:px-0',
                                    actif && 'active',
                                )

                                return item.nouvelOnglet ? (
                                    <a key={item.href} href={item.href} title={item.label}
                                       target="_blank" rel="noopener noreferrer" className={classe}>
                                        <Icone className="w-4 h-4 shrink-0" aria-hidden="true" />
                                        <span className={cn('text-sm', libelle)}>{item.label}</span>
                                    </a>
                                ) : (
                                    <Link key={item.href} href={item.href} title={item.label}
                                          aria-current={actif ? 'page' : undefined} className={classe}>
                                        <Icone className="w-4 h-4 shrink-0" aria-hidden="true" />
                                        <span className={cn('text-sm', libelle)}>{item.label}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer px-3 py-4 space-y-2">
                <div className={cn(replie && 'lg:hidden')}><SelecteurTheme /></div>
                {session && (
                    <div className={cn('sidebar-user-card px-3 py-2.5', replie && 'lg:hidden')}>
                        <p className="text-xs font-bold text-white truncate">{session.nom_complet}</p>
                        <p className="text-xs mt-0.5 font-mono truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
                            {session.public_id}
                        </p>
                    </div>
                )}

                <Link href="/admin/profil" title="Mon profil"
                      className={cn('sidebar-item flex items-center gap-3 px-3 py-2.5', replie && 'lg:justify-center lg:px-0',
                          pathname === '/admin/profil' && 'active')}>
                    <User className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className={cn('text-sm', libelle)}>Mon profil</span>
                </Link>

                <button type="button" onClick={() => deconnexion('shop')} title="Déconnexion"
                        className={cn('sidebar-item flex items-center gap-3 px-3 py-2.5 w-full', replie && 'lg:justify-center lg:px-0')}>
                    <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className={cn('text-sm', libelle)}>Déconnexion</span>
                </button>
            </div>

        </SidebarDrawer>
        <NavBasMobile />
        </>
    )
}
