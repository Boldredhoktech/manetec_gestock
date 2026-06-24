import { Package, Info, Shield, RotateCcw, Smartphone } from 'lucide-react'

interface Props { produit: any }

const TYPE_LABELS: Record<string, { label: string; desc: string; couleur: string }> = {
    simple:   { label: 'Simple',   desc: 'Article standard à l\'unité',     couleur: 'bg-blue-100 text-blue-700'   },
    ponderal: { label: 'Pondéral', desc: 'Vendu au poids ou à la fraction', couleur: 'bg-purple-100 text-purple-700' },
    kit:      { label: 'Kit',      desc: 'Assemblage de plusieurs produits', couleur: 'bg-amber-100 text-amber-700'  },
}

export default function CarteInfosProduit({ produit }: Props) {
    const typeConfig = TYPE_LABELS[produit.type_produit] ?? TYPE_LABELS.simple
    const config = produit.type_config_json as any

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-5">

            {/* En-tête */}
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <div className="bg-[#1a56db]/10 p-2 rounded-lg">
                    <Package className="w-5 h-5 text-[#1a56db]" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Informations générales</h2>
                <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold ${typeConfig.couleur}`}>
          {typeConfig.label}
        </span>
            </div>

            {/* Infos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <InfoLine label="Catégorie"    val={(produit.categories as any)?.nom ?? '—'} />
                <InfoLine label="Marque"       val={(produit.brands as any)?.nom ?? '—'} />
                <InfoLine label="Unité"        val={produit.unite} />
                <InfoLine label="Code-barres"  val={produit.code_barres ?? '—'} />
                <InfoLine label="Seuil alerte" val={`${produit.seuil_alerte} ${produit.unite}`} />
                <InfoLine label="TVA"          val={produit.tva_pct > 0 ? `${produit.tva_pct}%` : 'Sans TVA'} />
            </div>

            {/* Description */}
            {produit.description && (
                <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
                    {produit.description}
                </div>
            )}

            {/* Options spéciales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {produit.necessite_imei && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-blue-700">IMEI requis</p>
                            <p className="text-xs text-blue-600">À saisir à la vente</p>
                        </div>
                    </div>
                )}
                {produit.necessite_serie && (
                    <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                        <Info className="w-4 h-4 text-purple-600 shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-purple-700">N° de série requis</p>
                            <p className="text-xs text-purple-600">À saisir à la vente</p>
                        </div>
                    </div>
                )}
                {produit.garantie_mois && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                        <Shield className="w-4 h-4 text-green-600 shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-green-700">Garantie</p>
                            <p className="text-xs text-green-600">{produit.garantie_mois} mois</p>
                        </div>
                    </div>
                )}
                {produit.est_retournable && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-amber-700">Retournable</p>
                            <p className="text-xs text-amber-600">Retour autorisé</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Config Kit */}
            {produit.type_produit === 'kit' && config?.components && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-700 mb-2">Composants du kit</p>
                    {config.components.map((c: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs text-amber-700">
                            <span>{c.product_id}</span>
                            <span className="font-bold">×{c.quantity}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Config Pondéral */}
            {produit.type_produit === 'ponderal' && config && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <p className="text-xs font-bold text-purple-700 mb-2">Config pondéral</p>
                    {config.min_sell_qty && (
                        <p className="text-xs text-purple-600">Qté min : {config.min_sell_qty}</p>
                    )}
                    {config.sell_by_fraction && (
                        <p className="text-xs text-purple-600">Vente par fraction autorisée</p>
                    )}
                </div>
            )}
        </div>
    )
}

function InfoLine({ label, val }: { label: string; val: string }) {
    return (
        <div>
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-gray-800">{val}</p>
        </div>
    )
}