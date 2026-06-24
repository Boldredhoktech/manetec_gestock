'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, Store, Users, LayoutDashboard, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deconnexion } from '@/actions/auth'
import SidebarDrawer from '@/components/shared/SidebarDrawer'

const NAVIGATION = [
    { label: 'Dashboard',  href: '/redhok/dashboard', icone: LayoutDashboard },
    { label: 'Boutiques',  href: '/redhok/boutiques',  icone: Store           },
    { label: 'Agents',     href: '/redhok/agents',     icone: Users           },
]

export default function SidebarRedhok() {
    const pathname = usePathname()

    return (
        <SidebarDrawer title="Manetec Inter BJ">

            {/* Logo plateforme */}
            <div className="sidebar-logo-zone px-4 py-5">
                <div className="flex items-center gap-2.5">
                    <div className="bg-white/20 p-2 rounded-lg shrink-0">
                        <Shield className="w-5 h-5 text-white" />
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