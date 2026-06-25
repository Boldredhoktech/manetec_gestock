'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
    toggleActivationUtilisateur,
    debloquerUtilisateur,
} from '@/actions/users'
import { formatDate } from '@/lib/utils'
import {
    CheckCircle, XCircle, Lock, Loader2,
    ShieldCheck, User, Calculator, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Utilisateur {
    id: string
    public_id: string
    nom_complet: string
    identifiant: string
    role: string
    est_actif: boolean
    est_bloque: boolean
    tentatives_echecs: number
    created_at: string
    desactive_le: string | null
}

interface Props {
    utilisateurs: Utilisateur[]
}

const ROLES_CONFIG: Record<string, { label: string; icone: React.ElementType; couleur: string }> = {
    super_admin_boutique: { label: 'Super Admin',   icone: ShieldCheck, couleur: 'text-purple-500' },
    vendeur:              { label: 'Vendeur',        icone: User,        couleur: 'text-blue-500'   },
    stock_manager:        { label: 'Stock Manager',  icone: Package,     couleur: 'text-amber-500'  },
    comptable:            { label: 'Comptable',      icone: Calculator,  couleur: 'text-green-500'  },
}

export default function TableauUtilisateurs({ utilisateurs }: Props) {
    const [enAttenteId, setEnAttenteId] = useState<string | null>(null)

    async function handleToggle(u: Utilisateur) {
        setEnAttenteId(u.id)
        await toggleActivationUtilisateur(u.id, !u.est_actif)
        setEnAttenteId(null)
    }

    async function handleDebloquer(u: Utilisateur) {
        setEnAttenteId(u.id + '_deblock')
        await debloquerUtilisateur(u.id)
        setEnAttenteId(null)
    }

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Utilisateur</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Identifiant</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rôle</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Créé le</th>
                        <th className="px-4 py-3" />
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                    {utilisateurs.map(u => {
                        const config = ROLES_CONFIG[u.role]
                        const Icone = config?.icone ?? User
                        return (
                            <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3">
                                    <Link href={`/admin/utilisateurs/${u.id}`}
                                          className="group flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                                        <div className="w-8 h-8 bg-[#15335a]/10 rounded-full flex items-center justify-center group-hover:bg-[#15335a]/20 transition-colors shrink-0">
                                            <span className="text-xs font-black text-[#15335a]">
                                                {u.nom_complet.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900 group-hover:text-[#15335a] transition-colors">
                                                {u.nom_complet}
                                            </p>
                                            <p className="text-xs font-mono text-gray-400">{u.public_id}</p>
                                        </div>
                                    </Link>
                                </td>
                                <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {u.identifiant}
                    </span>
                                </td>
                                <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${config?.couleur}`}>
                      <Icone className="w-3.5 h-3.5" />
                        {config?.label ?? u.role}
                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {u.est_bloque ? (
                                        <span className="flex items-center gap-1.5 text-destructive text-xs font-medium">
                        <Lock className="w-3.5 h-3.5" />
                        Bloqué ({u.tentatives_echecs} tentatives)
                      </span>
                                    ) : u.est_actif ? (
                                        <span className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Actif
                      </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        Inactif
                      </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                    {formatDate(u.created_at)}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {u.est_bloque && u.role !== 'super_admin_boutique' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-xs h-7"
                                                disabled={enAttenteId === u.id + '_deblock'}
                                                onClick={() => handleDebloquer(u)}
                                            >
                                                {enAttenteId === u.id + '_deblock'
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : 'Débloquer'
                                                }
                                            </Button>
                                        )}
                                        {u.role !== 'super_admin_boutique' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs h-7"
                                                disabled={enAttenteId === u.id}
                                                onClick={() => handleToggle(u)}
                                            >
                                                {enAttenteId === u.id
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : u.est_actif ? 'Désactiver' : 'Activer'
                                                }
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}