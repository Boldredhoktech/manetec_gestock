import { Store, Users, CreditCard, Calendar, AlertTriangle } from 'lucide-react'
import BadgePlan from '@/components/redhok/BadgePlan'
import { formatDate } from '@/lib/utils'

interface Props {
    boutique: {
        nom: string
        plan: string
        plan_expire_le: string | null
        devise: string
    } | null
    nbUtilisateurs: number
    role: string
}

const LABELS_ROLE: Record<string, string> = {
    super_admin_boutique: 'Super Admin',
    vendeur:              'Vendeur',
    stock_manager:        'Gestionnaire de stock',
    comptable:            'Comptable',
}

export default function CartesBienvenue({ boutique, nbUtilisateurs, role }: Props) {
    const expireBientot = boutique?.plan_expire_le
        ? new Date(boutique.plan_expire_le) < new Date(Date.now() + 7 * 86400000)
        : false

    return (
        <div className="space-y-6">

            {/* Alerte expiration */}
            {expireBientot && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                        Votre abonnement expire le{' '}
                        <strong>{formatDate(boutique!.plan_expire_le!)}</strong>.
                        Contactez Bold Redhok Tech pour le renouveler.
                    </span>
                </div>
            )}

            {/* Cartes stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Boutique</p>
                        <div className="bg-blue-500/10 p-2 rounded-lg">
                            <Store className="w-4 h-4 text-blue-500" />
                        </div>
                    </div>
                    <p className="text-lg font-bold text-foreground truncate">
                        {boutique?.nom ?? '—'}
                    </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Votre rôle</p>
                        <div className="bg-purple-500/10 p-2 rounded-lg">
                            <Users className="w-4 h-4 text-purple-500" />
                        </div>
                    </div>
                    <p className="text-lg font-bold text-foreground">
                        {LABELS_ROLE[role] ?? role}
                    </p>
                </div>

                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Plan actif</p>
                        <div className="bg-amber-500/10 p-2 rounded-lg">
                            <CreditCard className="w-4 h-4 text-amber-500" />
                        </div>
                    </div>
                    <div>
                        <BadgePlan plan={boutique?.plan ?? 'starter'} />
                    </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Utilisateurs actifs</p>
                        <div className="bg-green-500/10 p-2 rounded-lg">
                            <Calendar className="w-4 h-4 text-green-500" />
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                        {nbUtilisateurs}
                    </p>
                </div>
            </div>

        </div>
    )
}