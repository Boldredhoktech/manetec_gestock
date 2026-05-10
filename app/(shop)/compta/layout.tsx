import SidebarCompta from '@/components/shop/SidebarCompta'

export default function LayoutCompta({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background flex">
            <SidebarCompta />
            <div className="flex-1 flex flex-col min-w-0">{children}</div>
        </div>
    )
}