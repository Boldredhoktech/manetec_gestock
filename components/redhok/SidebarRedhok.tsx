'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Store, Users, LayoutDashboard, LogOut, History, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deconnexion } from '@/actions/auth'
import { useSessionPlateforme } from '@/hooks/useSession'
import SidebarDrawer from '@/components/shared/SidebarDrawer'

const NAVIGATION_BASE = [
    { label: 'Dashboard',  href: '/redhok/dashboard', icone: LayoutDashboard },
    { label: 'Boutiques',  href: '/redhok/boutiques',  icone: Store           },
    { label: 'Agents',     href: '/redhok/agents',     icone: Users           },
]

// Liens réservés au super admin plateforme
const NAVIGATION_AUDIT = [
    { label: 'Audit boutiques', href: '/redhok/audit/boutiques', icone: History      },
    { label: 'Audit agents',    href: '/redhok/audit/agents',    icone: ShieldCheck  },
]

export default function SidebarRedhok() {
    const pathname = usePathname()
    const { session } = useSessionPlateforme()
    const estSuperAdmin = session?.role === 'super_platform_admin'
    const NAVIGATION = estSuperAdmin
        ? [...NAVIGATION_BASE, ...NAVIGATION_AUDIT]
        : NAVIGATION_BASE

    return (
        <SidebarDrawer title="Manetec Inter BJ">

            {/* Logo plateforme */}
            <div className="sidebar-logo-zone px-4 py-5">
                <div className="flex items-center gap-2.5">
                    <div className="bg-white p-1 rounded-lg shrink-0">
                        <Image src="/logo/app_logo.png" alt="Manetec Gestock" width={32} height={32}
                               className="object-contain w-8 h-8" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white leading-none">
                            Manetec Inter BJ
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                            Plateforme
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-0.5">
                {NAVIGATION.map(item => {
                    const Icone = item.icone
                    const actif = pathname.startsWith(item.href)
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

            {/* Déconnexion */}
            <div className="sidebar-footer px-3 py-4">
                <button
                    type="button"
                    onClick={() => deconnexion('platform')}
                    className="sidebar-item flex items-center gap-3 px-3 py-2.5 w-full"
                >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span className="text-sm">Déconnexion</span>
                </button>
            </div>

        </SidebarDrawer>
    )
}