'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, AlertCircle, Send } from 'lucide-react'

interface Client { id: string; nom: string; email: string }

interface Props {
    clients:     Client[]
    nomBoutique: string
}

export default function FormulairePromo({ clients, nomBoutique }: Props) {
    const [selection, setSelection]   = useState<string[]>([])
    const [titre, setTitre]           = useState('')
    const [message, setMessage]       = useState('')
    const [enAttente, setEnAttente]   = useState(false)
    const [resultat, setResultat]     = useState<{ succes: number; echecs: number } | null>(null)
    const [erreur, setErreur]         = useState<string>()

    const tousSelectionnes = selection.length === clients.length

    function toggleClient(id: string) {
        setSelection(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    function toggleTous() {
        setSelection(tousSelectionnes ? [] : clients.map(c => c.id))
    }

    async function handleEnvoyer() {
        if (!titre.trim() || !message.trim()) {
            setErreur('Le titre et le message sont obligatoires.')
            return
        }
        if (selection.length === 0) {
            setErreur('Sélectionnez au moins un client.')
            return
        }

        setEnAttente(true)
        setErreur(undefined)

        let succes = 0
        let echecs = 0

        const clientsSelectionnes = clients.filter(c => selection.includes(c.id))

        for (const client of clientsSelectionnes) {
            try {
                const resp = await fetch('/api/v1/notifications/promo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        emailDestinataire: client.email,
                        nomClient:         client.nom,
                        nomBoutique,
                        titre,
                        message,
                    }),
                })
                if (resp.ok) succes++
                else echecs++
            } catch { echecs++ }
        }

        setEnAttente(false)
        setResultat({ succes, echecs })
        setSelection([])
        setTitre('')
        setMessage('')
    }

    return (
        <div className="space-y-5">

            {erreur && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {erreur}
                </div>
            )}

            {resultat && (
                <div className="flex items-start gap-3 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold">Envoi terminé</p>
                        <p>{resultat.succes} email(s) envoyé(s) avec succès
                            {resultat.echecs > 0 && `, ${resultat.echecs} échec(s)`}.
                        </p>
                    </div>
                </div>
            )}

            {/* Message */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Contenu du message</h2>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Titre / Objet <span className="text-destructive">*</span>
                    </label>
                    <input type="text" value={titre}
                           onChange={e => setTitre(e.target.value)}
                           placeholder="Ex: Offre spéciale de fin de mois 🎁"
                           disabled={enAttente}
                           className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Message <span className="text-destructive">*</span>
                    </label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)}
                              rows={6}
                              placeholder="Rédigez votre message ici..."
                              disabled={enAttente}
                              className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none" />
                    <p className="text-xs text-muted-foreground">
                        {message.length} caractère(s)
                    </p>
                </div>
            </div>

            {/* Sélection clients */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">
                        Destinataires ({selection.length}/{clients.length})
                    </h2>
                    <button type="button" onClick={toggleTous}
                            className="text-xs text-primary hover:underline font-medium">
                        {tousSelectionnes ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                </div>

                {clients.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun client avec email enregistré.
                    </p>
                ) : (
                    <div className="max-h-64 overflow-y-auto space-y-1.5">
                        {clients.map(client => (
                            <label key={client.id}
                                   className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors">
                                <input type="checkbox"
                                       checked={selection.includes(client.id)}
                                       onChange={() => toggleClient(client.id)}
                                       className="rounded" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{client.nom}</p>
                                    <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <Button onClick={handleEnvoyer}
                    disabled={enAttente || selection.length === 0 || !titre || !message}
                    className="w-full">
                {enAttente ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi en cours...</>
                ) : (
                    <><Send className="w-4 h-4 mr-2" />Envoyer à {selection.length} client(s)</>
                )}
            </Button>
        </div>
    )
}