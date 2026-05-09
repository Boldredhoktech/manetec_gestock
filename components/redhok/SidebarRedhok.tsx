'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, Store, Users, LayoutDashboard, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deconnexion } from '@/actions/auth'

const NAVIGATION = [
    {
        label: 'Dashboard',
        href: '/redhok/dashboard',
        icone: LayoutDashboard,
    },
    {
        label: 'Boutiques',
        href: '/redhok/boutiques',
        icone: Store,
    },
    {
        label: 'Agents',
        href: '/redhok/agents',
        icone: Users,
    },
]

export default function SidebarRedhok() {
    const pathname = usePathname()

    return (
        <aside className="w-60 shrink-0 bg-card border-r border-border flex flex-col min-h-screen">

            {/* Logo */}
            <div className="px-4 py-5 border-b border-border">
                <div className="flex items-center gap-2.5">
                    <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                        <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground leading-none truncate">
                            Bold Redhok Tech
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Plateforme
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
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

            {/* Déconnexion */}
            <div className="px-3 py-4 border-t border-border">
                <button
                    type="button"
                    onClick={() => deconnexion('platform')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full"
                >
                    <LogOut className="w-4 h-4 shrink-0" />
                    Déconnexion
                </button>
            </div>

        </aside>
    )
}