'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, Package, Tags, Award,
    Warehouse, BarChart3, LogOut, Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { deconnexion } from '@/actions/auth'
import { useSessionBoutique } from '@/hooks/useSession'

const NAVIGATION = [
    { label: 'Dashboard',    href: '/admin/dashboard',  icone: LayoutDashboard },
    { label: 'Produits',     href: '/stock/produits',   icone: Package         },
    { label: 'Catégories',   href: '/stock/categories', icone: Tags            },
    { label: 'Marques',      href: '/stock/marques',    icone: Award           },
    { label: 'Entrepôts',    href: '/stock/entrepots',  icone: Warehouse       },
    { label: 'Mouvements',   href: '/stock/mouvements', icone: BarChart3       },
]

export default function SidebarStock() {
    const pathname = usePathname()
    const { session } = useSessionBoutique()

    return (
        <aside className="w-60 shrink-0 bg-card border-r border-border flex flex-col min-h-screen">
            <div className="px-4 py-5 border-b border-border">
                <div className="flex items-center gap-2.5">
                    <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                        <Store className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground leading-none truncate">
                            {session?.shop_nom ?? 'Boutique'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Gestion du stock
                        </p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
                {NAVIGATION.map((item) => {
                    const Icone = item.icone
                    const actif = pathname.startsWith(item.href)
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
            </nav>

            <div className="px-3 py-4 border-t border-border space-y-3">
                {session && (
                    <div className="px-3">
                        <p className="text-xs font-medium text-foreground truncate">
                            {session.nom_complet}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                            {session.role.replace(/_/g, ' ')}
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