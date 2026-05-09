import Link from 'next/link'
import {
    ShoppingCart, Plus, UserSquare, Package,
    Warehouse, FileText, Tags, BarChart3,
} from 'lucide-react'

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
        label:       'Nouvelle vente',
        description: 'Ouvrir la caisse',
        href:        '/pos',
        icone:       ShoppingCart,
        couleur:     'text-green-600',
        fond:        'bg-green-50 border-green-200 hover:bg-green-100',
        roles:       ['super_admin_boutique', 'vendeur', 'comptable'],
    },
    {
        label:       'Nouveau client',
        description: 'Enregistrer un client',
        href:        '/admin/clients/nouveau',
        icone:       Plus,
        couleur:     'text-purple-600',
        fond:        'bg-purple-50 border-purple-200 hover:bg-purple-100',
        roles:       ['super_admin_boutique', 'vendeur', 'comptable'],
    },
    {
        label:       'Nouveau produit',
        description: 'Ajouter au catalogue',
        href:        '/stock/produits/nouveau',
        icone:       Package,
        couleur:     'text-blue-600',
        fond:        'bg-blue-50 border-blue-200 hover:bg-blue-100',
        roles:       ['super_admin_boutique', 'stock_manager'],
    },
    {
        label:       'Voir les clients',
        description: 'Liste des clients',
        href:        '/admin/clients',
        icone:       UserSquare,
        couleur:     'text-indigo-600',
        fond:        'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
        roles:       ['super_admin_boutique', 'vendeur', 'comptable'],
    },
    {
        label:       'Voir les produits',
        description: 'Catalogue complet',
        href:        '/stock/produits',
        icone:       Package,
        couleur:     'text-cyan-600',
        fond:        'bg-cyan-50 border-cyan-200 hover:bg-cyan-100',
        roles:       ['super_admin_boutique', 'stock_manager', 'comptable'],
    },
    {
        label:       'Entrepôts',
        description: 'Gérer les entrepôts',
        href:        '/stock/entrepots',
        icone:       Warehouse,
        couleur:     'text-amber-600',
        fond:        'bg-amber-50 border-amber-200 hover:bg-amber-100',
        roles:       ['super_admin_boutique', 'stock_manager'],
    },
    {
        label:       'Catégories',
        description: 'Gérer les catégories',
        href:        '/stock/categories',
        icone:       Tags,
        couleur:     'text-rose-600',
        fond:        'bg-rose-50 border-rose-200 hover:bg-rose-100',
        roles:       ['super_admin_boutique', 'stock_manager'],
    },
    {
        label:       'Factures',
        description: 'Gérer les factures',
        href:        '/admin/factures',
        icone:       FileText,
        couleur:     'text-teal-600',
        fond:        'bg-teal-50 border-teal-200 hover:bg-teal-100',
        roles:       ['super_admin_boutique', 'vendeur', 'comptable'],
    },
    {
        label:       'Mouvements stock',
        description: 'Historique des mouvements',
        href:        '/stock/mouvements',
        icone:       BarChart3,
        couleur:     'text-orange-600',
        fond:        'bg-orange-50 border-orange-200 hover:bg-orange-100',
        roles:       ['super_admin_boutique', 'stock_manager'],
    },
]

interface Props { role: string }

export default function AccesRapidesBoutique({ role }: Props) {
    const accesFiltres = ACCES.filter(a => a.roles.includes(role))

    return (
        <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Accès rapides</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {accesFiltres.map(acces => {
                    const Icone = acces.icone
                    return (
                        <Link
                            key={acces.href + acces.label}
                            href={acces.href}
                            className={`border rounded-xl p-4 transition-colors space-y-2 ${acces.fond}`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white border`}>
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