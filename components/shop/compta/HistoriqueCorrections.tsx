import { History } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

// Une écriture se corrige sur place, mais jamais en silence : ce bloc
// rejoue ce qui a changé, quand, et par qui.
export interface EntreeHistorique {
    event_type:     string
    user_nom:       string | null
    user_public_id: string | null
    created_at:     string
    details_json:   {
        modifications?: { champ: string; libelle: string; avant: unknown; apres: unknown }[]
        motif?:         string | null
    } | null
}

const LIBELLES_EVENEMENT: Record<string, string> = {
    EXPENSE_UPDATED:            'Dépense modifiée',
    EXPENSE_CANCELLED:          'Dépense annulée',
    EXPENSE_CATEGORY_UPDATED:   'Catégorie renommée',
    EXPENSE_CATEGORY_ENABLED:   'Catégorie remise en service',
    EXPENSE_CATEGORY_DISABLED:  'Catégorie retirée de la saisie',
    EMPLOYEE_UPDATED:           'Fiche employé modifiée',
    EMPLOYEE_DEACTIVATED:       'Employé désactivé',
    EMPLOYEE_REACTIVATED:       'Employé réintégré',
    SALARY_PAYMENT_UPDATED:     'Versement modifié',
    SALARY_PAYMENT_CANCELLED:   'Versement annulé',
}

// Les champs monétaires méritent le format monnaie ; les booléens, un mot.
const CHAMPS_MONTANT = new Set([
    'montant', 'montant_net', 'salaire_base', 'bonus', 'deductions',
])

function afficher(champ: string, valeur: unknown): string {
    if (valeur === null || valeur === undefined || valeur === '') return '—'
    if (typeof valeur === 'boolean') return valeur ? 'oui' : 'non'
    if (CHAMPS_MONTANT.has(champ) && !isNaN(Number(valeur))) {
        return formatMontant(Number(valeur))
    }
    return String(valeur)
}

function quand(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}

export default function HistoriqueCorrections({
    entrees,
}: {
    entrees: EntreeHistorique[]
}) {
    if (entrees.length === 0) {
        return (
            <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground" />
                    Historique
                </h2>
                <p className="text-xs text-muted-foreground mt-2">
                    Cette écriture n&apos;a jamais été corrigée depuis sa saisie.
                </p>
            </div>
        )
    }

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                Historique des corrections
            </h2>

            <ol className="space-y-4">
                {entrees.map((e, i) => {
                    const mods = e.details_json?.modifications ?? []
                    return (
                        <li key={i} className="border-l-2 border-border pl-3.5 space-y-1.5">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                                <span className="text-sm font-medium text-foreground">
                                    {LIBELLES_EVENEMENT[e.event_type] ?? e.event_type}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {quand(e.created_at)}
                                    {e.user_nom ? ` · ${e.user_nom}` : ''}
                                </span>
                            </div>

                            {e.details_json?.motif && (
                                <p className="text-xs text-muted-foreground italic">
                                    « {e.details_json.motif} »
                                </p>
                            )}

                            {mods.length > 0 && (
                                <ul className="space-y-0.5">
                                    {mods.map((m, j) => (
                                        <li key={j} className="text-xs text-muted-foreground">
                                            <span className="text-foreground">{m.libelle}</span>
                                            {' : '}
                                            <span className="line-through">{afficher(m.champ, m.avant)}</span>
                                            {' → '}
                                            <span className="font-medium text-foreground">
                                                {afficher(m.champ, m.apres)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}
