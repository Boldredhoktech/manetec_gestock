import { Package, Users, UserSquare, ShoppingCart, TrendingUp } from 'lucide-react'
import { getPlanLimites } from '@/lib/constants/plans'

interface Props {
    plan:            string
    nbProduits:      number
    nbClients:       number
    nbUtilisateurs:  number
    nbVentes:        number
}

const ILLIMITE = 999999

function Ligne({
    icone: Icone, label, valeur, max,
}: { icone: any; label: string; valeur: number; max: number }) {
    const illimite = max >= ILLIMITE
    const pct      = illimite ? 0 : Math.min(100, Math.round((valeur / max) * 100))
    const proche   = !illimite && valeur >= max * 0.8
    const atteint  = !illimite && valeur >= max

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                    <Icone className="w-4 h-4" />
                    {label}
                </span>
                <span className={`font-bold ${atteint ? 'text-destructive' : proche ? 'text-amber-600' : 'text-foreground'}`}>
                    {valeur}{illimite ? '' : ` / ${max}`}
                </span>
            </div>
            {!illimite && (
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                        className={`h-full rounded-full ${atteint ? 'bg-destructive' : proche ? 'bg-amber-500' : 'bg-[#15335a]'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
        </div>
    )
}

export default function CarteUsageBoutique({
    plan, nbProduits, nbClients, nbUtilisateurs, nbVentes,
}: Props) {
    const limites = getPlanLimites(plan)
    const produitProche = nbProduits >= limites.max_produits * 0.8 && limites.max_produits < ILLIMITE
    const userProche    = nbUtilisateurs >= limites.max_utilisateurs * 0.8 && limites.max_utilisateurs < ILLIMITE
    const clientProche  = nbClients >= limites.max_clients * 0.8 && limites.max_clients < ILLIMITE
    const suggererUpgrade = produitProche || userProche || clientProche

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Utilisation & quotas ({limites.label})
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <Ligne icone={Package}      label="Produits"      valeur={nbProduits}     max={limites.max_produits} />
                <Ligne icone={UserSquare}   label="Clients"       valeur={nbClients}      max={limites.max_clients} />
                <Ligne icone={Users}        label="Utilisateurs"  valeur={nbUtilisateurs} max={limites.max_utilisateurs} />
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <ShoppingCart className="w-4 h-4" />
                            Ventes enregistrées
                        </span>
                        <span className="font-bold text-foreground">{nbVentes}</span>
                    </div>
                </div>
            </div>

            {suggererUpgrade && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 text-xs">
                    <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                        Cette boutique approche des limites de son plan <strong>{limites.label}</strong>.
                        C'est le bon moment pour proposer une montée vers une offre supérieure.
                    </span>
                </div>
            )}
        </div>
    )
}
