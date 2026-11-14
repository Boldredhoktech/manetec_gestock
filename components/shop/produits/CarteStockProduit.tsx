import { Warehouse, AlertTriangle, CheckCircle } from 'lucide-react'

interface StockLevel {
    quantite: number
    warehouses: { id: string; nom: string; est_defaut: boolean } | null
}

interface Props {
    stockLevels:  StockLevel[]
    seuilAlerte:  number
    unite:        string
}

export default function CarteStockProduit({ stockLevels, seuilAlerte, unite }: Props) {
    const stockTotal = stockLevels.reduce((acc, s) => acc + s.quantite, 0)
    // Alerte dès qu'UN entrepôt passe sous le seuil : le cumul masquait
    // un rayon vide quand la réserve était pleine.
    const enAlerte   = stockLevels.length > 0
        ? stockLevels.some(s => s.quantite <= seuilAlerte)
        : stockTotal <= seuilAlerte
    const enRupture  = stockTotal <= 0

    return (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center gap-2">
                <div className="bg-[var(--primary-soft)] p-2 rounded-lg">
                    <Warehouse className="w-5 h-5 text-[var(--primary-strong)]" />
                </div>
                <h2 className="text-sm font-bold text-foreground">Stock disponible</h2>
            </div>

            {/* Total */}
            <div className={`p-4 rounded-xl text-center ${
                enRupture
                    ? 'bg-red-50 border border-red-200'
                    : enAlerte
                        ? 'bg-yellow-50 border border-yellow-200'
                        : 'bg-green-50 border border-green-200'
            }`}>
                <div className="flex items-center justify-center gap-2 mb-1">
                    {enRupture || enAlerte
                        ? <AlertTriangle className={`w-5 h-5 ${enRupture ? 'text-red-500' : 'text-yellow-500'}`} />
                        : <CheckCircle className="w-5 h-5 text-green-500" />
                    }
                    <p className={`text-2xl font-black ${
                        enRupture ? 'text-red-600' : enAlerte ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                        {stockTotal} {unite}
                    </p>
                </div>
                <p className={`text-xs font-medium ${
                    enRupture ? 'text-red-500' : enAlerte ? 'text-yellow-600' : 'text-green-600'
                }`}>
                    {enRupture ? 'RUPTURE DE STOCK' : enAlerte ? `Alerte ! Seuil : ${seuilAlerte}` : 'Stock OK'}
                </p>
            </div>

            {/* Par entrepôt */}
            {stockLevels.length > 1 && (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Par entrepôt</p>
                    {stockLevels.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 bg-[var(--surface2)] rounded-lg">
                            <div className="flex items-center gap-2">
                                <Warehouse className="w-3.5 h-3.5 text-muted-foreground/80" />
                                <span className="text-xs text-foreground font-medium">
                  {s.warehouses?.nom ?? 'Entrepôt'}
                                    {s.warehouses?.est_defaut && (
                                        <span className="ml-1.5 text-[10px] text-[var(--primary-strong)] font-bold">défaut</span>
                                    )}
                </span>
                            </div>
                            <span className={`text-sm font-bold ${
                                s.quantite <= 0 ? 'text-red-500' : 'text-foreground'
                            }`}>
                {s.quantite} {unite}
              </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}