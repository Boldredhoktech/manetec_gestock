'use client'

import { useActionState } from 'react'
import { modifierClient } from '@/actions/clients'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'

const PAYS = [
    'Bénin','Togo','Côte d\'Ivoire','Sénégal','Mali',
    'Burkina Faso','Niger','Ghana','Nigeria','Cameroun','France','Autre',
]

interface Client {
    id: string; nom: string; telephone: string | null
    email: string | null; adresse: string | null
    ville: string | null; pays: string | null
    site_web: string | null; ifu: string | null
    rccm: string | null; notes: string | null
}

interface Props { client: Client }

interface EtatAction { erreur?: string; succes?: boolean }

export default function FormulaireModifierClient({ client }: Props) {
    const [etat, action, enAttente] = useActionState(
        async (_prev: EtatAction, formData: FormData): Promise<EtatAction> => {
            formData.set('clientId', client.id)
            const res = await modifierClient(formData)
            if (res?.erreur) return { erreur: res.erreur }
            return { succes: true }
        },
        {}
    )

    return (
        <form action={action} className="space-y-5 py-6">

            {etat.erreur && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {etat.erreur}
                </div>
            )}
            {etat.succes && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Client modifié avec succès.
                </div>
            )}

            {/* Infos personnelles */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <h2 className="text-sm font-bold text-[#1a56db]">Informations personnelles</h2>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                        Nom complet <span className="text-red-500">*</span>
                    </label>
                    <input name="nom" type="text" required
                           defaultValue={client.nom} disabled={enAttente}
                           className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 focus:border-[#1a56db]/40 disabled:opacity-50" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {[
                        { name: 'telephone', label: 'Téléphone',  type: 'tel',   val: client.telephone,  placeholder: '+229 97 00 00 00' },
                        { name: 'email',     label: 'Email',       type: 'email', val: client.email,      placeholder: 'email@exemple.com' },
                    ].map(f => (
                        <div key={f.name} className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">{f.label}</label>
                            <input name={f.name} type={f.type} defaultValue={f.val ?? ''}
                                   placeholder={f.placeholder} disabled={enAttente}
                                   className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 disabled:opacity-50" />
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Ville</label>
                        <input name="ville" type="text" defaultValue={client.ville ?? ''}
                               placeholder="Cotonou" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Pays</label>
                        <select name="pays" defaultValue={client.pays ?? ''} disabled={enAttente}
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 disabled:opacity-50">
                            <option value="">— Sélectionner —</option>
                            {PAYS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Adresse</label>
                    <input name="adresse" type="text" defaultValue={client.adresse ?? ''}
                           placeholder="Adresse complète" disabled={enAttente}
                           className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 disabled:opacity-50" />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Site web</label>
                    <input name="site_web" type="url" defaultValue={client.site_web ?? ''}
                           placeholder="https://..." disabled={enAttente}
                           className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 disabled:opacity-50" />
                </div>
            </div>

            {/* Infos légales */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <h2 className="text-sm font-bold text-[#1a56db]">Informations légales</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">IFU</label>
                        <input name="ifu" type="text" defaultValue={client.ifu ?? ''}
                               placeholder="Numéro IFU" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">RCCM</label>
                        <input name="rccm" type="text" defaultValue={client.rccm ?? ''}
                               placeholder="Numéro RCCM" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 disabled:opacity-50" />
                    </div>
                </div>
            </div>

            {/* Notes */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3 shadow-sm">
                <h2 className="text-sm font-bold text-[#1a56db]">Notes internes</h2>
                <textarea name="notes" rows={3} defaultValue={client.notes ?? ''}
                          placeholder="Notes non visibles par le client..."
                          disabled={enAttente}
                          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 disabled:opacity-50 resize-none" />
            </div>

            <Button type="submit" disabled={enAttente}
                    className="w-full bg-[#1a56db] hover:bg-[#1648c0] text-white font-bold py-3 rounded-xl shadow-lg shadow-[#1a56db]/20 hover:shadow-[#1a56db]/40 transition-all">
                {enAttente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Modification...</>
                    : 'Enregistrer les modifications'
                }
            </Button>
        </form>
    )
}