'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard, Receipt, Users, FileText,
    ClipboardCheck, LogOut, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { deconnexion } from '@/actions/auth'
import { useSessionBoutique } from '@/hooks/useSession'
import SidebarDrawer from '@/components/shared/SidebarDrawer'

const NAVIGATION = [
    { label: 'Dashboard admin', href: '/admin/dashboard',  icone: LayoutDashboard },
    { label: 'Tableau de bord', href: '/compta/dashboard', icone: LayoutDashboard },
    { label: 'Dépenses',        href: '/compta/depenses',  icone: Receipt         },
    { label: 'Salaires',        href: '/compta/salaires',  icone: Users           },
    { label: 'Factures',        href: '/admin/factures',   icone: FileText        },
    { label: 'Rapports',        href: '/admin/rapports',   icone: BarChart3       },
    { label: 'Inventaire',      href: '/compta/inventaire',icone: ClipboardCheck  },
]

export default function SidebarCompta() {
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
                            Comptabilité
                        </p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5">
                {NAVIGATION.map(item => {
                    const Icone = item.icone
                    const actif = pathname === item.href ||
                        (item.href !== '/admin/dashboard' &&
                            item.href !== '/compta/dashboard' &&
                            pathname.startsWith(item.href))
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

        </SidebarDrawer>
    )
}