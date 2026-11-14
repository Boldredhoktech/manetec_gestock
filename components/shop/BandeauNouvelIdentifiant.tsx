// Affiché après une connexion avec l'identifiant d'avant la mig 040.
// Le cookie qui le porte s'efface dès la connexion avec le nouvel identifiant.
import { KeyRound } from 'lucide-react'

export default function BandeauNouvelIdentifiant({ identifiant }: { identifiant: string }) {
    return (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-sm">
            <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
                Votre identifiant de connexion a changé. Utilisez désormais{' '}
                <strong className="font-mono">{identifiant}</strong>{' '}
                (le mot de passe ne change pas). L&apos;ancien sera refusé après le 31 janvier 2027.
            </span>
        </div>
    )
}
