'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, Package, Tags, Award,
    Warehouse, BarChart3, LogOut, Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { deconnexion } from '@/actions/auth'
import { useSessionBoutique } from '@/hooks/useSession'
import SidebarDrawer from '@/components/shared/SidebarDrawer'

const NAVIGATION = [
    { label: 'Dashboard',    href: '/admin/dashboard',    icone: LayoutDashboard },
    { label: 'Produits',     href: '/stock/produits',     icone: Package         },
    { label: 'Catégories',   href: '/stock/categories',   icone: Tags            },
    { label: 'Marques',      href: '/stock/marques',      icone: Award           },
    { label: 'Entrepôts',    href: '/stock/entrepots',    icone: Warehouse       },
    { label: 'Fournisseurs', href: '/stock/fournisseurs', icone: Truck           },
    { label: 'Mouvements',   href: '/stock/mouvements',   icone: BarChart3       },
]

export default function SidebarStock() {
    const pathname    = usePathname()
    const { session } = useSessionBoutique()

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
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                            Gestion du stock
                        </p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5">
                {NAVIGATION.map(item => {
                    const Icone = item.icone
                    const actif = pathname === item.href ||
                        (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn('sidebar-item flex items-center gap-3 px-3 py-2.5', actif && 'active')}
                        >
                            <Icone className="w-4 h-4 shrink-0" />
                            <span className="text-sm">{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            <div className="sidebar-footer px-3 py-4 space-y-2">
                {session && (
                    <div className="sidebar-user-card px-3 py-2.5">
                        <p className="text-xs font-bold text-white truncate">{session.nom_complet}</p>
                        <p className="text-xs mt-0.5 capitalize" style={{ color: 'rgba(255,255,255,0.65)' }}>
                            {session.role.replace(/_/g, ' ')}
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

        </SidebarDrawer>
    )
}