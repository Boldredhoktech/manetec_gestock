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
    const enAlerte   = stockTotal <= seuilAlerte
    const enRupture  = stockTotal <= 0

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center gap-2">
                <div className="bg-[#15335a]/10 p-2 rounded-lg">
                    <Warehouse className="w-5 h-5 text-[#15335a]" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Stock disponible</h2>
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
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Par entrepôt</p>
                    {stockLevels.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Warehouse className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-xs text-gray-700 font-medium">
                  {s.warehouses?.nom ?? 'Entrepôt'}
                                    {s.warehouses?.est_defaut && (
                                        <span className="ml-1.5 text-[10px] text-[#15335a] font-bold">défaut</span>
                                    )}
                </span>
                            </div>
                            <span className={`text-sm font-bold ${
                                s.quantite <= 0 ? 'text-red-500' : 'text-gray-800'
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