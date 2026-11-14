'use client'

// Menu du bas sur téléphone (nouveau design, lot 1) : les 4 destinations
// les plus utilisées, plus « Menu » qui ouvre la barre latérale complète.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingCart, Package, Landmark, Menu } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const EVENEMENT_MENU = 'manetec:menu'

export default function NavBasMobile() {
    const pathname = usePathname()
    const { peutFaire, session } = usePermission()
    if (!session) return null

    const liens = [
        { href: '/admin/dashboard',   label: 'Accueil',    Icone: LayoutDashboard },
        { href: '/pos',               label: 'Caisse',     Icone: ShoppingCart, permission: PERMISSIONS.VENTES_CREER },
        { href: '/stock/produits',    label: 'Produits',   Icone: Package,      permission: PERMISSIONS.PRODUITS_VOIR },
        { href: '/compta/tresorerie', label: 'Trésorerie', Icone: Landmark,     permission: PERMISSIONS.TRESORERIE_SOLDES_VOIR },
    ].filter(l => !l.permission || peutFaire(l.permission))

    const classe = (actif: boolean) =>
        `flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-semibold ${actif ? 'text-[#FACC15]' : 'text-[#C9D4F0]'}`

    return (
        <nav aria-label="Navigation rapide"
             className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex bg-[var(--nav)] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
            {liens.map(({ href, label, Icone }) => {
                const actif = pathname === href || pathname.startsWith(href + '/')
                return (
                    <Link key={href} href={href} aria-current={actif ? 'page' : undefined} className={classe(actif)}>
                        <Icone className="w-5 h-5" aria-hidden="true" />{label}
                    </Link>
                )
            })}
            <button type="button" onClick={() => window.dispatchEvent(new Event(EVENEMENT_MENU))} className={classe(false)}>
                <Menu className="w-5 h-5" aria-hidden="true" />Menu
            </button>
        </nav>
    )
}
