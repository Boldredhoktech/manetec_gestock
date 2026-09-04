import SidebarBoutiqueWrapper from '@/components/shop/SidebarBoutiqueWrapper'

// Les trois sections de la boutique partagent la MEME sidebar : passer
// du stock a la comptabilite ne doit plus faire disparaitre la moitie
// du menu (voir lib/constants/navigation.ts).
export default function LayoutCompta({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background flex">
            <SidebarBoutiqueWrapper />
            <div className="flex-1 flex flex-col min-w-0 pt-14 lg:pt-0">
                {children}
            </div>
        </div>
    )
}
