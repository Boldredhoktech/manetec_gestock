'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
    /** Titre affiché dans la barre mobile (nom de la boutique / plateforme) */
    title: string
    /** Contenu de la sidebar (logo, navigation, footer) */
    children: React.ReactNode
    /** Ordinateur : barre repliée en icônes (nouveau design). */
    replie?: boolean
}

/**
 * Enveloppe responsive pour les sidebars.
 *  - ≥ lg (1024px)  : sidebar fixe classique dans le flux (tablette paysage + desktop)
 *  - < lg           : barre supérieure mobile avec hamburger + drawer coulissant + overlay
 *                     (téléphone Android + tablette portrait)
 */
export default function SidebarDrawer({ title, children, replie = false }: Props) {
    const [open, setOpen] = useState(false)
    const pathname = usePathname()

    // Fermer le drawer à chaque navigation
    useEffect(() => { setOpen(false) }, [pathname])

    // Le bouton « Menu » du bas d'écran (téléphone) ouvre le tiroir.
    useEffect(() => {
        const ouvrir = () => setOpen(true)
        window.addEventListener('manetec:menu', ouvrir)
        return () => window.removeEventListener('manetec:menu', ouvrir)
    }, [])

    // Bloquer le scroll du body quand le drawer est ouvert
    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [open])

    return (
        <>
            {/* ── Barre supérieure mobile ─────────────────────────── */}
            <div className="lg:hidden fixed top-0 inset-x-0 h-14 z-40 flex items-center gap-3 px-4 sidebar-royal shadow-md">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label="Ouvrir le menu"
                    className="p-2 -ml-2 rounded-lg text-white hover:bg-white/15 transition-colors"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shrink-0">
                    <Image src="/logo/app_logo.png" alt="Manetec Gestock" width={28} height={28}
                           className="object-contain" />
                </span>
                <span className="text-sm font-bold text-white truncate">{title}</span>
            </div>

            {/* ── Overlay ─────────────────────────────────────────── */}
            {open && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* ── Sidebar / Drawer ────────────────────────────────── */}
            <aside
                className={cn(
                    'sidebar-royal w-60 shrink-0 flex flex-col z-50 transition-[width] duration-200',
                    replie && 'lg:w-[76px]',
                    'fixed inset-y-0 left-0 transition-transform duration-300 ease-in-out',
                    // Ordinateur : la barre reste à la hauteur de l'écran et
                    // défile seule, indépendamment de la page.
                    'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
                    open ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                {/* Bouton de fermeture (mobile uniquement) */}
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fermer le menu"
                    className="lg:hidden absolute top-3 right-3 p-2 rounded-lg text-white hover:bg-white/15 transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                {children}
            </aside>
        </>
    )
}
