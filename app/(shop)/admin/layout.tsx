import SidebarAdminWrapper from '@/components/shop/SidebarAdminWrapper'

export default function LayoutAdmin({
                                        children,
                                    }: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-background flex">
            <SidebarAdminWrapper />
            <div className="flex-1 flex flex-col min-w-0 pt-14 lg:pt-0">
                {children}
            </div>
        </div>
    )
}