import SidebarAdmin from '@/components/shop/SidebarAdmin'

export default function LayoutAdmin({
                                        children,
                                    }: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-background flex">
            <SidebarAdmin />
            <div className="flex-1 flex flex-col min-w-0">
                {children}
            </div>
        </div>
    )
}