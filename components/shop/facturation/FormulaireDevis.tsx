'use client'

import { useState } from 'react'
import { creerDevis } from '@/actions/facturation'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import EditeurLignes from '@/components/shop/facturation/EditeurLignes'
import type { LigneFacture } from '@/actions/facturation'
import { useRouter } from 'next/navigation'

interface Props {
    clients:                 { id: string; nom: string }[]
    produits:                { id: string; nom: string; prix_vente: number; tva_pct: number; unite: string }[]
    clientIdPreselectionne?: string
}

export default function FormulaireDevis({ clients, produits, clientIdPreselectionne }: Props) {
    const router = useRouter()
    const [lignes, setLignes]               = useState<LigneFacture[]>([])
    const [clientId, setClientId]           = useState(clientIdPreselectionne ?? '')
    const [objet, setObjet]                 = useState('')
    const [dateValidite, setDateValidite]   = useState('')
    const [remisePct, setRemisePct]         = useState(0)
    const [noteClient, setNoteClient]       = useState('')
    const [noteInterne, setNoteInterne]     = useState('')
    const [enAttente, setEnAttente]         = useState(false)
    const [erreur, setErreur]               = useState<string>()
    const [succes, setSucces]               = useState<string>()

    async function handleSoumettre() {
        setEnAttente(true)
        setErreur(undefined)
        const res = await creerDevis(
            clientId || null, objet, dateValidite || null,
            remisePct, noteClient, noteInterne, lignes
        )
        setEnAttente(false)
        if (res?.erreur) { setErreur(res.erreur); return }
        setSucces(res.public_id!)
        setTimeout(() => router.push('/admin/factures'), 1500)
    }

    return (
        <div className="space-y-5">

            {erreur && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {erreur}
                </div>
            )}
            {succes && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Devis {succes} créé. Redirection...
                </div>
            )}

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Informations générales</h2>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Client</label>
                        <select
                            value={clientId}
                            onChange={e => setClientId(e.target.value)}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">— Aucun —</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.nom}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Date de validité</label>
                        <input
                            type="date"
                            value={dateValidite}
                            onChange={e => setDateValidite(e.target.value)}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Objet</label>
                    <input
                        type="text"
                        value={objet}
                        onChange={e => setObjet(e.target.value)}
                        placeholder="Objet du devis"
                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Remise globale (%)</label>
                        <input
                            type="number" min="0" max="100" step="0.5"
                            value={remisePct}
                            onChange={e => setRemisePct(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Note client</label>
                        <input
                            type="text"
                            value={noteClient}
                            onChange={e => setNoteClient(e.target.value)}
                            placeholder="Visible sur le devis"
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Note interne</label>
                    <input
                        type="text"
                        value={noteInterne}
                        onChange={e => setNoteInterne(e.target.value)}
                        placeholder="Non visible par le client"
                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Lignes du devis</h2>
                <EditeurLignes lignes={lignes} onChanger={setLignes} produits={produits} />
            </div>

            <Button
                onClick={handleSoumettre}
                disabled={enAttente || lignes.length === 0}
                className="w-full"
            >
                {enAttente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</>
                    : 'Créer le devis'
                }
            </Button>
        </div>
    )
}