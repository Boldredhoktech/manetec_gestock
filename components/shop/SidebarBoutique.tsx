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
import { useLayoutEffect, useRef } from 'react'
import { CHEMIN_ABONNEMENT } from '@/lib/abonnement/regle'
import { fichePlan, labelPlan } from '@/lib/abonnement/catalogue'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deconnexion } from '@/actions/auth'
import { useSessionBoutique } from '@/hooks/useSession'
import { usePermission } from '@/hooks/usePermission'
import SidebarDrawer from '@/components/shared/SidebarDrawer'
import { getPlanLimites } from '@/lib/constants/plans'
import { estAdminComplet } from '@/lib/constants/permissions'
import { NAVIGATION_BOUTIQUE } from '@/lib/constants/navigation'

// Les tableaux de bord sont préfixes de tout leur univers : sans cette
// exception, « /admin/dashboard » resterait allumé sur chaque page admin.
const RACINES = ['/admin/dashboard', '/compta/dashboard']

const CLE_DEFILEMENT = 'manetec.sidebar.defilement'

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
        <SidebarDrawer title={session?.shop_nom ?? 'Boutique'}>

            <div className="sidebar-logo-zone px-4 py-5">
                <div className="flex items-center gap-2.5">
                    <div className="bg-white p-1 rounded-lg shrink-0">
                        <Image src="/logo/app_logo.png" alt="Manetec Gestock" width={32} height={32}
                               className="object-contain w-8 h-8" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white leading-none truncate">
                            {session?.shop_nom ?? 'Boutique'}
                        </p>
                        {estSuperAdmin ? (
                            <Link href="/admin/abonnement"
                                  className="text-xs mt-0.5 font-semibold capitalize hover:underline transition-opacity hover:opacity-80"
                                  style={{ color: fichePlan(planReel).couleurSurFonce }}>
                                Plan {labelPlan(planReel)}
                            </Link>
                        ) : (
                            <p className="text-xs mt-0.5 font-semibold capitalize"
                               style={{ color: fichePlan(planReel).couleurSurFonce }}>
                                Plan {labelPlan(planReel)}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <nav ref={refNav} onScroll={memoriserDefilement}
                 className="flex-1 min-h-0 px-3 py-4 space-y-5 overflow-y-auto overscroll-contain">
                {navigation.map(groupe => (
                    <div key={groupe.groupe}>
                        <p className="sidebar-group-label px-3 mb-1.5">{groupe.groupe}</p>
                        <div className="space-y-0.5">
                            {groupe.items.map(item => {
                                const Icone = item.icone
                                const actif = pathname === item.href ||
                                    (!RACINES.includes(item.href) && pathname.startsWith(item.href))
                                const classe = cn(
                                    'sidebar-item flex items-center gap-3 px-3 py-2.5',
                                    actif && 'active',
                                )

                                return item.nouvelOnglet ? (
                                    <a key={item.href} href={item.href}
                                       target="_blank" rel="noopener noreferrer" className={classe}>
                                        <Icone className="w-4 h-4 shrink-0" />
                                        <span className="text-sm">{item.label}</span>
                                    </a>
                                ) : (
                                    <Link key={item.href} href={item.href} className={classe}>
                                        <Icone className="w-4 h-4 shrink-0" />
                                        <span className="text-sm">{item.label}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer px-3 py-4 space-y-1">
                {session && (
                    <div className="sidebar-user-card px-3 py-2.5 mb-2">
                        <p className="text-xs font-bold text-white truncate">{session.nom_complet}</p>
                        <p className="text-xs mt-0.5 font-mono truncate"
                           style={{ color: 'rgba(255,255,255,0.65)' }}>
                            {session.public_id}
                        </p>
                    </div>
                )}

                <Link href="/admin/profil"
                      className={cn('sidebar-item flex items-center gap-3 px-3 py-2.5',
                          pathname === '/admin/profil' && 'active')}>
                    <User className="w-4 h-4 shrink-0" />
                    <span className="text-sm">Mon profil</span>
                </Link>

                <button type="button" onClick={() => deconnexion('shop')}
                        className="sidebar-item flex items-center gap-3 px-3 py-2.5 w-full">
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span className="text-sm">Déconnexion</span>
                </button>
            </div>

        </SidebarDrawer>
    )
}
