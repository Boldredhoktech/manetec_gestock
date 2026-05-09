'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, Users, Settings, LogOut,
    Store, ShoppingCart, Package, UserSquare,
    FileText, Warehouse, Tags, Award, BarChart3, Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { deconnexion } from '@/actions/auth'
import { useSessionBoutique } from '@/hooks/useSession'
import { ROLES } from '@/lib/constants/permissions'

const NAVIGATION_SUPER_ADMIN = [
    {
        groupe: 'Général',
        items: [
            { label: 'Dashboard',      href: '/admin/dashboard',      icone: LayoutDashboard },
            { label: 'Utilisateurs',   href: '/admin/utilisateurs',   icone: Users           },
            { label: 'Clients',        href: '/admin/clients',        icone: UserSquare      },
            { label: 'Paramètres',     href: '/admin/parametres',     icone: Settings        },
        ],
    },
    {
        groupe: 'Ventes',
        items: [
            { label: 'Caisse (POS)',   href: '/pos',                  icone: ShoppingCart    },
            { label: 'Factures',       href: '/admin/factures',       icone: FileText        },
        ],
    },
    {
        groupe: 'Stock',
        items: [
            { label: 'Fournisseurs', href: '/stock/fournisseurs', icone: Truck },
            { label: 'Produits',       href: '/stock/produits',       icone: Package         },
            { label: 'Entrepôts',      href: '/stock/entrepots',      icone: Warehouse       },
            { label: 'Catégories',     href: '/stock/categories',     icone: Tags            },
            { label: 'Marques',        href: '/stock/marques',        icone: Award           },
            { label: 'Mouvements',     href: '/stock/mouvements',     icone: BarChart3       },
        ],
    },
]

const NAVIGATION_VENDEUR = [
    {
        groupe: 'Ventes',
        items: [
            { label: 'Caisse (POS)',   href: '/pos',                  icone: ShoppingCart    },
            { label: 'Factures',       href: '/admin/factures',       icone: FileText        },
            { label: 'Clients',        href: '/admin/clients',        icone: UserSquare      },
        ],
    },
]

const NAVIGATION_STOCK_MANAGER = [
    {
        groupe: 'Stock',
        items: [
            { label: 'Produits',       href: '/stock/produits',       icone: Package         },
            { label: 'Entrepôts',      href: '/stock/entrepots',      icone: Warehouse       },
            { label: 'Catégories',     href: '/stock/categories',     icone: Tags            },
            { label: 'Marques',        href: '/stock/marques',        icone: Award           },
            { label: 'Mouvements',     href: '/stock/mouvements',     icone: BarChart3       },
        ],
    },
]

const NAVIGATION_COMPTABLE = [
    {
        groupe: 'Finance',
        items: [
            { label: 'Dashboard',      href: '/admin/dashboard',      icone: LayoutDashboard },
            { label: 'Factures',       href: '/admin/factures',       icone: FileText        },
            { label: 'Clients',        href: '/admin/clients',        icone: UserSquare      },
        ],
    },
]

const NAVIGATIONS_PAR_ROLE: Record<string, typeof NAVIGATION_SUPER_ADMIN> = {
    super_admin_boutique: NAVIGATION_SUPER_ADMIN,
    vendeur:              NAVIGATION_VENDEUR,
    stock_manager:        NAVIGATION_STOCK_MANAGER,
    comptable:            NAVIGATION_COMPTABLE,
}

export default function SidebarAdmin() {
    const pathname  = usePathname()
    const { session } = useSessionBoutique()
    const navigation = NAVIGATIONS_PAR_ROLE[session?.role ?? 'vendeur'] ?? NAVIGATION_VENDEUR

    return (
        <aside className="w-60 shrink-0 bg-card border-r border-border flex flex-col min-h-screen">

            {/* Logo boutique */}
            <div className="px-4 py-5 border-b border-border">
                <div className="flex items-center gap-2.5">
                    <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                        <Store className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground leading-none truncate">
                            {session?.shop_nom ?? 'Boutique'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                            {session?.shop_plan ?? 'starter'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation par groupes */}
            <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
                {navigation.map(groupe => (
                    <div key={groupe.groupe}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1.5">
                            {groupe.groupe}
                        </p>
                        <div className="space-y-0.5">
                            {groupe.items.map(item => {
                                const Icone = item.icone
                                const actif = pathname === item.href ||
                                    (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                            actif
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                        )}
                                    >
                                        <Icone className="w-4 h-4 shrink-0" />
                                        {item.label}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Utilisateur + déconnexion */}
            <div className="px-3 py-4 border-t border-border space-y-3">
                {session && (
                    <div className="px-3 py-2 bg-muted/40 rounded-lg">
                        <p className="text-xs font-medium text-foreground truncate">
                            {session.nom_complet}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {session.public_id}
                        </p>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => deconnexion('shop')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full"
                >
                    <LogOut className="w-4 h-4 shrink-0" />
                    Déconnexion
                </button>
            </div>

        </aside>
    )
}