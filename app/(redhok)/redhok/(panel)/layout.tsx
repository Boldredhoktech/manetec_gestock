import SidebarRedhok from '@/components/redhok/SidebarRedhok'

export default function LayoutRedhokApp({
                                            children,
                                        }: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-background flex">
            <SidebarRedhok />
            <div className="flex-1 flex flex-col min-w-0 pt-14 lg:pt-0">
                {children}
            </div>
        </div>
    )
}