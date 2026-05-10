'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, Users, Settings, LogOut,
    Store, ShoppingCart, Package, UserSquare,
    FileText, Warehouse, Tags, Award, BarChart3,
    Receipt, ClipboardCheck, Send, Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { deconnexion } from '@/actions/auth'
import { useSessionBoutique } from '@/hooks/useSession'
import { ROLES } from '@/lib/constants/permissions'

const NAVIGATION_SUPER_ADMIN = [
    {
        groupe: 'Général',
        items: [
            { label: 'Dashboard',    href: '/admin/dashboard',    icone: LayoutDashboard },
            { label: 'Utilisateurs', href: '/admin/utilisateurs', icone: Users           },
            { label: 'Clients',      href: '/admin/clients',      icone: UserSquare      },
            { label: 'Paramètres',   href: '/admin/parametres',   icone: Settings        },
        ],
    },
    {
        groupe: 'Ventes',
        items: [
            { label: 'Caisse (POS)', href: '/pos',              icone: ShoppingCart },
            { label: 'Factures',     href: '/admin/factures',   icone: FileText     },
            { label: 'Rapports',     href: '/admin/rapports',   icone: BarChart3    },
            // Dans NAVIGATION_SUPER_ADMIN, groupe Ventes, ajoutez :
            { label: 'Communications', href: '/admin/communications', icone: Send },
        ],
    },
    {
        groupe: 'Stock',
        items: [
            { label: 'Produits',     href: '/stock/produits',       icone: Package    },
            { label: 'Entrepôts',    href: '/stock/entrepots',      icone: Warehouse  },
            { label: 'Catégories',   href: '/stock/categories',     icone: Tags       },
            { label: 'Marques',      href: '/stock/marques',        icone: Award      },
            { label: 'Fournisseurs', href: '/stock/fournisseurs',   icone: Truck      },
            { label: 'Mouvements',   href: '/stock/mouvements',     icone: BarChart3  },
        ],
    },
    {
        groupe: 'Comptabilité',
        items: [
            { label: 'Dashboard',  href: '/compta/dashboard',  icone: LayoutDashboard },
            { label: 'Dépenses',   href: '/compta/depenses',   icone: Receipt         },
            { label: 'Salaires',   href: '/compta/salaires',   icone: Users           },
            { label: 'Inventaire', href: '/compta/inventaire', icone: ClipboardCheck  },
        ],
    },
]

const NAVIGATION_VENDEUR = [
    {
        groupe: 'Ventes',
        items: [
            { label: 'Caisse (POS)', href: '/pos',            icone: ShoppingCart },
            { label: 'Factures',     href: '/admin/factures', icone: FileText     },
            { label: 'Clients',      href: '/admin/clients',  icone: UserSquare   },
        ],
    },
]

const NAVIGATION_STOCK_MANAGER = [
    {
        groupe: 'Stock',
        items: [
            { label: 'Produits',     href: '/stock/produits',     icone: Package   },
            { label: 'Entrepôts',    href: '/stock/entrepots',    icone: Warehouse },
            { label: 'Catégories',   href: '/stock/categories',   icone: Tags      },
            { label: 'Marques',      href: '/stock/marques',      icone: Award     },
            { label: 'Fournisseurs', href: '/stock/fournisseurs', icone: Truck     },
            { label: 'Mouvements',   href: '/stock/mouvements',   icone: BarChart3 },
        ],
    },
]

const NAVIGATION_COMPTABLE = [
    {
        groupe: 'Finance',
        items: [
            { label: 'Dashboard',  href: '/compta/dashboard',  icone: LayoutDashboard },
            { label: 'Factures',   href: '/admin/factures',    icone: FileText        },
            { label: 'Clients',    href: '/admin/clients',     icone: UserSquare      },
            { label: 'Dépenses',   href: '/compta/depenses',   icone: Receipt         },
            { label: 'Salaires',   href: '/compta/salaires',   icone: Users           },
            { label: 'Inventaire', href: '/compta/inventaire', icone: ClipboardCheck  },
            { label: 'Rapports',   href: '/admin/rapports',    icone: BarChart3       },
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
    const pathname    = usePathname()
    const { session } = useSessionBoutique()
    const navigation  = NAVIGATIONS_PAR_ROLE[session?.role ?? 'vendeur'] ?? NAVIGATION_VENDEUR

    return (
        <aside className="sidebar-royal w-60 shrink-0 flex flex-col min-h-screen">

            {/* Logo boutique */}
            <div className="sidebar-logo-zone px-4 py-5">
                <div className="flex items-center gap-2.5">
                    <div className="bg-white/20 p-2 rounded-lg shrink-0">
                        <Store className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white leading-none truncate">
                            {session?.shop_nom ?? 'Boutique'}
                        </p>
                        <p className="text-xs mt-0.5 capitalize" style={{ color: 'rgba(255,255,255,0.65)' }}>
                            Plan {session?.shop_plan ?? 'starter'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
                {navigation.map(groupe => (
                    <div key={groupe.groupe}>
                        <p className="sidebar-group-label px-3 mb-1.5">
                            {groupe.groupe}
                        </p>
                        <div className="space-y-0.5">
                            {groupe.items.map(item => {
                                const Icone = item.icone
                                const actif = pathname === item.href ||
                                    (item.href !== '/admin/dashboard' &&
                                        item.href !== '/compta/dashboard' &&
                                        pathname.startsWith(item.href))
                                return (
                                    item.href === '/pos' ? (
                                        <a
                                            key={item.href}
                                            href={item.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={cn('sidebar-item flex items-center gap-3 px-3 py-2.5', actif && 'active')}
                                        >
                                            <Icone className="w-4 h-4 shrink-0" />
                                            <span className="text-sm">{item.label}</span>
                                        </a>
                                    ) : (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn('sidebar-item flex items-center gap-3 px-3 py-2.5', actif && 'active')}
                                        >
                                            <Icone className="w-4 h-4 shrink-0" />
                                            <span className="text-sm">{item.label}</span>
                                        </Link>
                                    )
                                )
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Utilisateur + déconnexion */}
            <div className="sidebar-footer px-3 py-4 space-y-2">
                {session && (
                    <div className="sidebar-user-card px-3 py-2.5">
                        <p className="text-xs font-bold text-white truncate">
                            {session.nom_complet}
                        </p>
                        <p className="text-xs mt-0.5 font-mono truncate"
                           style={{ color: 'rgba(255,255,255,0.65)' }}>
                            {session.public_id}
                        </p>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => deconnexion('shop')}
                    className="sidebar-item flex items-center gap-3 px-3 py-2.5 w-full"
                >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span className="text-sm">Déconnexion</span>
                </button>
            </div>

        </aside>
    )
}