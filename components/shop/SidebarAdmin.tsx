'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, Users, Settings, LogOut,
    ShoppingCart, Package, UserSquare,
    FileText, Warehouse, Tags, Award, BarChart3,
    Receipt, ClipboardCheck, Send, Truck,
    User, CreditCard, PackageCheck, FileInput,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { deconnexion } from '@/actions/auth'
import { useSessionBoutique } from '@/hooks/useSession'
import SidebarDrawer from '@/components/shared/SidebarDrawer'
import { getPlanLimites } from '@/lib/constants/plans'

// Liens réservés à certaines fonctionnalités du plan (masqués sinon)
const FEATURE_PAR_HREF: Record<string, 'rapports' | 'communications'> = {
    '/admin/rapports':       'rapports',
    '/admin/communications': 'communications',
}

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
            { label: 'Caisse (POS)',   href: '/pos',                   icone: ShoppingCart },
            { label: 'Factures',       href: '/admin/factures',        icone: FileText     },
            { label: 'Rapports',       href: '/admin/rapports',        icone: BarChart3    },
            { label: 'Communications', href: '/admin/communications',  icone: Send         },
        ],
    },
    {
        groupe: 'Stock',
        items: [
            { label: 'Produits',        href: '/stock/produits',              icone: Package      },
            { label: 'Entrepôts',       href: '/stock/entrepots',             icone: Warehouse    },
            { label: 'Catégories',      href: '/stock/categories',            icone: Tags         },
            { label: 'Marques',         href: '/stock/marques',               icone: Award        },
            { label: 'Fournisseurs',    href: '/stock/fournisseurs',          icone: Truck        },
            { label: 'Réceptions',      href: '/stock/receptions',            icone: PackageCheck },
            { label: 'Fact. fourn.',    href: '/stock/factures-fournisseurs', icone: FileInput    },
            { label: 'Mouvements',      href: '/stock/mouvements',            icone: BarChart3    },
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
            { label: 'Produits',        href: '/stock/produits',              icone: Package      },
            { label: 'Entrepôts',       href: '/stock/entrepots',             icone: Warehouse    },
            { label: 'Catégories',      href: '/stock/categories',            icone: Tags         },
            { label: 'Marques',         href: '/stock/marques',               icone: Award        },
            { label: 'Fournisseurs',    href: '/stock/fournisseurs',          icone: Truck        },
            { label: 'Réceptions',      href: '/stock/receptions',            icone: PackageCheck },
            { label: 'Fact. fourn.',    href: '/stock/factures-fournisseurs', icone: FileInput    },
            { label: 'Mouvements',      href: '/stock/mouvements',            icone: BarChart3    },
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
    gestionnaire_stock:   NAVIGATION_STOCK_MANAGER,
    stock_manager:        NAVIGATION_STOCK_MANAGER,
    comptable:            NAVIGATION_COMPTABLE,
}

const PLAN_LABELS: Record<string, string> = {
    starter:    'Starter',
    pro:        'Pro',
    enterprise: 'Enterprise',
}

const PLAN_COLORS: Record<string, string> = {
    starter:    'rgba(255,255,255,0.65)',
    pro:        '#f59e0b',
    enterprise: '#10b981',
}

interface Props { planReel?: string }

export default function SidebarAdmin({ planReel }: Props) {
    const pathname    = usePathname()
    const { session } = useSessionBoutique()
    const navigationBrute = NAVIGATIONS_PAR_ROLE[session?.role ?? 'vendeur'] ?? NAVIGATION_VENDEUR
    const plan        = planReel ?? session?.shop_plan ?? 'starter'
    const estSuperAdmin = session?.role === 'super_admin_boutique'

    // Masquer les liens dont la fonctionnalité n'est pas incluse dans le plan
    const limites = getPlanLimites(plan)
    const navigation = navigationBrute
        .map(groupe => ({
            ...groupe,
            items: groupe.items.filter(item => {
                const feature = FEATURE_PAR_HREF[item.href]
                return !feature || limites[feature]
            }),
        }))
        .filter(groupe => groupe.items.length > 0)

    return (
        <SidebarDrawer title={session?.shop_nom ?? 'Boutique'}>

            {/* Logo boutique */}
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
                        {/* Plan cliquable pour le SuperAdmin */}
                        {estSuperAdmin ? (
                            <Link href="/admin/abonnement"
                                  className="text-xs mt-0.5 font-semibold capitalize hover:underline transition-opacity hover:opacity-80"
                                  style={{ color: PLAN_COLORS[plan] ?? 'rgba(255,255,255,0.65)' }}
                            >
                                Plan {PLAN_LABELS[plan] ?? plan}
                            </Link>
                        ) : (
                            <p className="text-xs mt-0.5 font-semibold capitalize"
                               style={{ color: PLAN_COLORS[plan] ?? 'rgba(255,255,255,0.65)' }}>
                                Plan {PLAN_LABELS[plan] ?? plan}
                            </p>
                        )}
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
                                        <a key={item.href} href={item.href}
                                           target="_blank" rel="noopener noreferrer"
                                           className={cn('sidebar-item flex items-center gap-3 px-3 py-2.5', actif && 'active')}>
                                            <Icone className="w-4 h-4 shrink-0" />
                                            <span className="text-sm">{item.label}</span>
                                        </a>
                                    ) : (
                                        <Link key={item.href} href={item.href}
                                              className={cn('sidebar-item flex items-center gap-3 px-3 py-2.5', actif && 'active')}>
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

            {/* Footer utilisateur */}
            <div className="sidebar-footer px-3 py-4 space-y-1">

                {session && (
                    <div className="sidebar-user-card px-3 py-2.5 mb-2">
                        <p className="text-xs font-bold text-white truncate">
                            {session.nom_complet}
                        </p>
                        <p className="text-xs mt-0.5 font-mono truncate"
                           style={{ color: 'rgba(255,255,255,0.65)' }}>
                            {session.public_id}
                        </p>
                    </div>
                )}

                {/* Mon profil — accessible à tous */}
                <Link href="/admin/profil"
                      className={cn('sidebar-item flex items-center gap-3 px-3 py-2.5',
                          pathname === '/admin/profil' && 'active')}>
                    <User className="w-4 h-4 shrink-0" />
                    <span className="text-sm">Mon profil</span>
                </Link>

                {/* Mon abonnement — SuperAdmin uniquement */}
                {estSuperAdmin && (
                    <Link href="/admin/abonnement"
                          className={cn('sidebar-item flex items-center gap-3 px-3 py-2.5',
                              pathname === '/admin/abonnement' && 'active')}>
                        <CreditCard className="w-4 h-4 shrink-0" />
                        <span className="text-sm">Mon abonnement</span>
                    </Link>
                )}

                {/* Déconnexion */}
                <button type="button" onClick={() => deconnexion('shop')}
                        className="sidebar-item flex items-center gap-3 px-3 py-2.5 w-full">
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span className="text-sm">Déconnexion</span>
                </button>
            </div>

        </SidebarDrawer>
    )
}