'use client'

import { useState } from 'react'
import { toggleActivationAgent } from '@/actions/agents'
import { formatDate } from '@/lib/utils'
import { Shield, User, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Agent {
    id: string
    public_id: string
    nom_complet: string
    email: string
    role: string
    est_actif: boolean
    created_at: string
}

interface Props {
    agents: Agent[]
    estSuperAdmin: boolean
}

const LABELS_ROLE: Record<string, string> = {
    super_platform_admin: 'Super Admin',
    platform_agent: 'Agent Support',
}

export default function TableauAgents({ agents, estSuperAdmin }: Props) {
    const [enAttenteId, setEnAttenteId] = useState<string | null>(null)

    async function handleToggle(agent: Agent) {
        setEnAttenteId(agent.id)
        await toggleActivationAgent(agent.id, !agent.est_actif)
        setEnAttenteId(null)
    }

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Membre</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rôle</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ajouté le</th>
                        {estSuperAdmin && (
                            <th className="px-4 py-3" />
                        )}
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                    {agents.map(agent => (
                        <tr key={agent.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="bg-muted rounded-full p-1.5">
                                        {agent.role === 'super_platform_admin'
                                            ? <Shield className="w-3.5 h-3.5 text-primary" />
                                            : <User className="w-3.5 h-3.5 text-muted-foreground" />
                                        }
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">
                                            {agent.nom_complet}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {agent.email}
                                        </p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                    {agent.public_id}
                  </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                                {LABELS_ROLE[agent.role] ?? agent.role}
                            </td>
                            <td className="px-4 py-3">
                                {agent.est_actif ? (
                                    <span className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Actif
                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 text-destructive text-xs font-medium">
                      <XCircle className="w-3.5 h-3.5" />
                      Inactif
                    </span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                                {formatDate(agent.created_at)}
                            </td>
                            {estSuperAdmin && (
                                <td className="px-4 py-3">
                                    {agent.role !== 'super_platform_admin' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={enAttenteId === agent.id}
                                            onClick={() => handleToggle(agent)}
                                            className="text-xs"
                                        >
                                            {enAttenteId === agent.id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : agent.est_actif ? 'Désactiver' : 'Activer'}
                                        </Button>
                                    )}
                                </td>
                            )}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}