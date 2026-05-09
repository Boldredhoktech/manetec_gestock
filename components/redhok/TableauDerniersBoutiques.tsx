import Link from 'next/link'
import BadgePlan from '@/components/redhok/BadgePlan'
import { formatDate } from '@/lib/utils'
import { ChevronRight, CheckCircle, XCircle } from 'lucide-react'

interface Boutique {
    id: string
    public_id: string
    nom: string
    plan: string
    est_active: boolean
    plan_expire_le: string | null
    created_at: string
    ville: string | null
    pays: string
}

interface Props { boutiques: Boutique[] }

export default function TableauDerniersBoutiques({ boutiques }: Props) {
    if (boutiques.length === 0) return null

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                    Dernières boutiques enregistrées
                </h2>
                <Link href="/redhok/boutiques"
                      className="text-xs text-primary hover:underline">
                    Voir toutes →
                </Link>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="divide-y divide-border">
                    {boutiques.map(b => (
                        <div key={b.id}
                             className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {b.nom}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {b.public_id} · {[b.ville, b.pays].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-3">
                                <BadgePlan plan={b.plan} />
                                {b.est_active ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-destructive" />
                                )}
                                <span className="text-xs text-muted-foreground hidden sm:block">
                  {formatDate(b.created_at)}
                </span>
                                <Link href={`/redhok/boutiques/${b.id}`}
                                      className="text-primary hover:text-primary/80">
                                    <ChevronRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}