'use client'

import { useActionState } from 'react'
import { creerProduit } from '@/actions/produits'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'

interface Props {
    categories: { id: string; nom: string; parent_id: string | null }[]
    marques:    { id: string; nom: string }[]
    entrepots:  { id: string; nom: string; est_defaut: boolean }[]
}

const etatInitial = { erreur: undefined as string | undefined }

const UNITES = ['pièce', 'kg', 'g', 'litre', 'ml', 'carton', 'sachet', 'boîte', 'mètre']

export default function FormulaireProduit({ categories, marques, entrepots }: Props) {
    const entrepotDefaut = entrepots.find(e => e.est_defaut)

    const [etat, action, enAttente] = useActionState(
        async (_prev: typeof etatInitial, formData: FormData) => {
            const res = await creerProduit(formData)
            return res ?? etatInitial
        },
        etatInitial
    )

    if (entrepots.length === 0) {
        return (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-5 text-sm">
                ⚠️ Vous devez d'abord créer au moins un entrepôt avant d'ajouter des produits.
            </div>
        )
    }

    return (
        <form action={action} className="space-y-5">

            {etat.erreur && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{etat.erreur}</span>
                </div>
            )}

            {/* Informations principales */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Informations générales</h2>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Nom du produit <span className="text-destructive">*</span>
                    </label>
                    <input
                        name="nom" type="text" required
                        placeholder="Ex: Paracétamol 500mg"
                        disabled={enAttente}
                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Type</label>
                        <select name="typeProduit" disabled={enAttente}
                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                            <option value="simple">Simple</option>
                            <option value="ponderal">Pondéral (au poids)</option>
                            <option value="kit">Kit (assemblage)</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Unité</label>
                        <select name="unite" disabled={enAttente}
                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                            {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Catégorie</label>
                        <select name="categoryId" disabled={enAttente}
                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                            <option value="">— Aucune —</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Marque</label>
                        <select name="brandId" disabled={enAttente}
                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                            <option value="">— Aucune —</option>
                            {marques.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">SKU</label>
                        <input name="sku" type="text" placeholder="Code interne"
                               disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Code-barres</label>
                        <input name="codeBarres" type="text" placeholder="EAN13 ou autre"
                               disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                </div>
            </div>

            {/* Prix */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Prix</h2>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Prix d'achat</label>
                        <input name="prixAchat" type="number" min="0" step="0.01"
                               defaultValue="0" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Prix de vente <span className="text-destructive">*</span>
                        </label>
                        <input name="prixVente" type="number" min="0.01" step="0.01"
                               required defaultValue="0" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Prix de gros</label>
                        <input name="prixGros" type="number" min="0" step="0.01"
                               placeholder="Optionnel" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Prix minimum</label>
                        <input name="prixMinimum" type="number" min="0" step="0.01"
                               placeholder="Plancher de vente" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                </div>
            </div>

            {/* Stock initial */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Stock initial</h2>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Entrepôt</label>
                        <select name="warehouseId" disabled={enAttente}
                                defaultValue={entrepotDefaut?.id ?? ''}
                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                            {entrepots.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.nom}{e.est_defaut ? ' (défaut)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Quantité initiale</label>
                        <input name="stockInitial" type="number" min="0" step="0.001"
                               defaultValue="0" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Seuil d'alerte stock</label>
                    <input name="seuilAlerte" type="number" min="0"
                           defaultValue="5" disabled={enAttente}
                           className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    <p className="text-xs text-muted-foreground">
                        Une alerte s'affiche quand le stock descend sous ce seuil.
                    </p>
                </div>
            </div>

            {/* Options avancées */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Options avancées</h2>

                <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-2.5 cursor-pointer p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
                        <input type="checkbox" name="necessite_imei" value="true"
                               disabled={enAttente} className="rounded" />
                        <div>
                            <p className="text-sm font-bold text-blue-700">Nécessite IMEI</p>
                            <p className="text-xs text-blue-500">Téléphones, tablettes</p>
                        </div>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer p-3 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors">
                        <input type="checkbox" name="necessite_serie" value="true"
                               disabled={enAttente} className="rounded" />
                        <div>
                            <p className="text-sm font-bold text-purple-700">N° de série requis</p>
                            <p className="text-xs text-purple-500">Électronique, machines</p>
                        </div>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors">
                        <input type="checkbox" name="est_retournable" value="true"
                               defaultChecked disabled={enAttente} className="rounded" />
                        <div>
                            <p className="text-sm font-bold text-amber-700">Retournable</p>
                            <p className="text-xs text-amber-500">Retour client autorisé</p>
                        </div>
                    </label>

                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                        <p className="text-xs font-bold text-green-700 mb-1.5">Garantie (mois)</p>
                        <input type="number" name="garantie_mois" min="0"
                               placeholder="0 = aucune" disabled={enAttente}
                               className="w-full px-2.5 py-1.5 bg-white border border-green-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                    </div>
                </div>
            </div>

            <Button type="submit" disabled={enAttente} className="w-full">
                {enAttente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</>
                    : 'Créer le produit'
                }
            </Button>

        </form>
    )
}