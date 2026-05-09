import Link from 'next/link'
import { Store, Plus, Users, Shield } from 'lucide-react'

interface AccesRapide {
    label:       string
    description: string
    href:        string
    icone:       React.ElementType
    couleur:     string
    fond:        string
    roles:       string[]
}

const ACCES: AccesRapide[] = [
    {
        label:       'Nouvelle boutique',
        description: 'Créer et enregistrer',
        href:        '/redhok/boutiques/nouvelle',
        icone:       Plus,
        couleur:     'text-green-600',
        fond:        'bg-green-50 border-green-200 hover:bg-green-100',
        roles:       ['super_platform_admin', 'platform_agent'],
    },
    {
        label:       'Toutes les boutiques',
        description: 'Gérer les boutiques',
        href:        '/redhok/boutiques',
        icone:       Store,
        couleur:     'text-blue-600',
        fond:        'bg-blue-50 border-blue-200 hover:bg-blue-100',
        roles:       ['super_platform_admin', 'platform_agent'],
    },
    {
        label:       'Équipe Bold Redhok',
        description: 'Gérer les agents',
        href:        '/redhok/agents',
        icone:       Users,
        couleur:     'text-purple-600',
        fond:        'bg-purple-50 border-purple-200 hover:bg-purple-100',
        roles:       ['super_platform_admin'],
    },
    {
        label:       'Nouvel agent',
        description: 'Ajouter un agent support',
        href:        '/redhok/agents/nouveau',
        icone:       Shield,
        couleur:     'text-indigo-600',
        fond:        'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
        roles:       ['super_platform_admin'],
    },
]

interface Props { role: string }

export default function AccesRapidesRedhok({ role }: Props) {
    const accesFiltres = ACCES.filter(a => a.roles.includes(role))

    return (
        <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Accès rapides</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {accesFiltres.map(acces => {
                    const Icone = acces.icone
                    return (
                        <Link
                            key={acces.href}
                            href={acces.href}
                            className={`border rounded-xl p-4 transition-colors space-y-2 ${acces.fond}`}
                        >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border">
                                <Icone className={`w-4 h-4 ${acces.couleur}`} />
                            </div>
                            <div>
                                <p className={`text-sm font-semibold ${acces.couleur}`}>
                                    {acces.label}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {acces.description}
                                </p>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}