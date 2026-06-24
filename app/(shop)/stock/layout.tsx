import SidebarStock from '@/components/shop/SidebarStock'

export default function LayoutStock({
                                        children,
                                    }: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-background flex">
            <SidebarStock />
            <div className="flex-1 flex flex-col min-w-0 pt-14 lg:pt-0">
                {children}
            </div>
        </div>
    )
}