'use client'

import { Shield, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deconnexion } from '@/actions/auth'

interface Props {
    admin: {
        nom_complet: string
        email: string
        role: string
    }
}

const LABELS_ROLE: Record<string, string> = {
    super_platform_admin: 'Super Admin Plateforme',
    platform_agent: 'Agent Support',
}

export default function DashboardRedhokHeader({ admin }: Props) {
    return (
        <header className="bg-card border-b border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">

                    {/* Logo + Nom */}
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground leading-none">
                                Bold Redhok Tech
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Manetec Gestock · Plateforme
                            </p>
                        </div>
                    </div>

                    {/* Infos admin + déconnexion */}
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium text-foreground leading-none">
                                {admin.nom_complet}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {LABELS_ROLE[admin.role] ?? admin.role}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deconnexion('platform')}
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Déconnexion
                        </Button>
                    </div>

                </div>
            </div>
        </header>
    )
}