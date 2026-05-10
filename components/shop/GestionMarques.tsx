'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { creerMarque } from '@/actions/produits'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Award } from 'lucide-react'

interface Marque { id: string; public_id: string; nom: string; est_actif: boolean }
interface Props  { marques: Marque[] }

const etatInitial = { erreur: undefined as string | undefined, succes: undefined as boolean | undefined }

export default function GestionMarques({ marques }: Props) {
    const [etat, action, enAttente] = useActionState(
        async (_prev: typeof etatInitial, formData: FormData) => {
            const res = await creerMarque(formData)
            if (res?.erreur) return { erreur: res.erreur, succes: undefined }
            return { succes: true, erreur: undefined }
        },
        etatInitial
    )

    return (
        <div className="space-y-5">
            <form action={action} className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Nouvelle marque</h2>

                {etat.erreur && (
                    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {etat.erreur}
                    </div>
                )}
                {etat.succes && (
                    <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        Marque créée avec succès.
                    </div>
                )}

                <div className="flex gap-3">
                    <input name="nom" type="text" required placeholder="Ex: Samsung"
                           disabled={enAttente}
                           className="flex-1 px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    <Button type="submit" size="sm" disabled={enAttente}>
                        {enAttente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ajouter'}
                    </Button>
                </div>
            </form>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
                {marques.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">Aucune marque.</div>
                ) : (
                    <div className="divide-y divide-border">
                        {marques.map(m => (
                            <Link key={m.id} href={`/stock/marques/${m.id}`}
                                  className="flex items-center gap-2.5 px-4 py-3 hover:bg-muted/40 transition-colors group">
                                <Award className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{m.nom}</span>
                                <span className="text-xs font-mono text-muted-foreground ml-auto">{m.public_id}</span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}