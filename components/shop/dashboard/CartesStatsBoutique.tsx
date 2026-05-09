import { Package, UserSquare, ShoppingCart, TrendingUp } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

interface Props {
    nbProduits:          number
    nbClients:           number
    nbVentesAujourdhui:  number
    caAujourdhui:        number
    devise:              string
    role:                string
}

export default function CartesStatsBoutique({
                                                nbProduits, nbClients, nbVentesAujourdhui, caAujourdhui, devise, role,
                                            }: Props) {
    const cartes = [
        {
            label:   'Produits actifs',
            valeur:  nbProduits,
            icone:   Package,
            couleur: 'text-blue-500',
            fond:    'bg-blue-500/10',
            roles:   ['super_admin_boutique', 'stock_manager', 'comptable'],
            format:  'nombre',
        },
        {
            label:   'Clients enregistrés',
            valeur:  nbClients,
            icone:   UserSquare,
            couleur: 'text-purple-500',
            fond:    'bg-purple-500/10',
            roles:   ['super_admin_boutique', 'vendeur', 'comptable'],
            format:  'nombre',
        },
        {
            label:   'Ventes aujourd\'hui',
            valeur:  nbVentesAujourdhui,
            icone:   ShoppingCart,
            couleur: 'text-amber-500',
            fond:    'bg-amber-500/10',
            roles:   ['super_admin_boutique', 'vendeur', 'comptable'],
            format:  'nombre',
        },
        {
            label:   'CA aujourd\'hui',
            valeur:  caAujourdhui,
            icone:   TrendingUp,
            couleur: 'text-green-500',
            fond:    'bg-green-500/10',
            roles:   ['super_admin_boutique', 'comptable'],
            format:  'montant',
        },
    ].filter(c => c.roles.includes(role))

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cartes.map(carte => {
                const Icone = carte.icone
                return (
                    <div key={carte.label}
                         className="bg-card border border-border rounded-xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">{carte.label}</p>
                            <div className={`${carte.fond} p-2 rounded-lg`}>
                                <Icone className={`w-4 h-4 ${carte.couleur}`} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-foreground">
                            {carte.format === 'montant'
                                ? formatMontant(carte.valeur, devise)
                                : carte.valeur
                            }
                        </p>
                    </div>
                )
            })}
        </div>
    )
}