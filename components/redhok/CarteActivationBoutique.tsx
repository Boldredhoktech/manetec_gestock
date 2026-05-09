'use client'

import { useState } from 'react'
import { toggleActivationBoutique } from '@/actions/shops'
import { Button } from '@/components/ui/button'
import { Loader2, Power } from 'lucide-react'

interface Props {
    boutique: {
        id: string
        nom: string
        est_active: boolean
    }
}

export default function CarteActivationBoutique({ boutique }: Props) {
    const [enAttente, setEnAttente] = useState(false)
    const [erreur, setErreur] = useState<string>()

    async function handleToggle() {
        setEnAttente(true)
        setErreur(undefined)
        const res = await toggleActivationBoutique(boutique.id, !boutique.est_active)
        if (res?.erreur) setErreur(res.erreur)
        setEnAttente(false)
    }

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Power className="w-4 h-4" />
                Activation de la boutique
            </h2>

            <p className="text-sm text-muted-foreground">
                La boutique est actuellement{' '}
                <strong className={boutique.est_active ? 'text-green-600' : 'text-destructive'}>
                    {boutique.est_active ? 'active' : 'inactive'}
                </strong>.
                {boutique.est_active
                    ? ' La désactiver empêchera tous les utilisateurs de se connecter.'
                    : ' La réactiver permettra aux utilisateurs de se reconnecter.'}
            </p>

            {erreur && (
                <p className="text-xs text-destructive">{erreur}</p>
            )}

            <Button
                variant={boutique.est_active ? 'destructive' : 'default'}
                size="sm"
                disabled={enAttente}
                onClick={handleToggle}
            >
                {enAttente ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                    <Power className="w-4 h-4 mr-2" />
                )}
                {boutique.est_active ? 'Désactiver la boutique' : 'Activer la boutique'}
            </Button>
        </div>
    )
}