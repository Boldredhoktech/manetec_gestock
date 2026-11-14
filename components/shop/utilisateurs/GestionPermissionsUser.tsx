'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    mettreAJourPermissions,
    toggleActivationUtilisateur,
} from '@/actions/users'
import {
    Shield, Check, X, Loader2, AlertCircle,
    CheckCircle, Power, User, Lock,
} from 'lucide-react'
import { estAdminComplet } from '@/lib/constants/permissions'

// Permissions disponibles par rôle (issues du document Flutter)
const PERMISSIONS_PAR_ROLE: Record<string, { code: string; label: string; description: string }[]> = {
    vendeur: [
        { code: 'suppliers.create',        label: 'Créer des fournisseurs',   description: 'Peut ajouter de nouveaux fournisseurs' },
        { code: 'reports.generate',        label: 'Générer des rapports',     description: 'Accès aux rapports PDF' },
        { code: 'clients.full_access',     label: 'Accès complet clients',    description: 'Voir les soldes et l\'historique complet' },
        { code: 'invoices.create',         label: 'Créer des factures A4',    description: 'Peut créer des factures entreprise' },
        { code: 'products.price.edit',     label: 'Modifier les prix',        description: 'Peut changer les prix de vente' },
        { code: 'sales.return',            label: 'Retours de vente',         description: 'Peut enregistrer des retours' },
        { code: 'treasury.balances.view',  label: 'Voir la trésorerie',       description: 'Soldes et journaux des caisses, banques et Mobile Money' },
        { code: 'treasury.manage',         label: 'Gérer la trésorerie',      description: 'Comptes, virements, retraits/apports, rapprochements (inclut la vue des soldes)' },
    ],
    // La clé est le rôle tel qu'il est stocké (stock_manager) : sous
    // « gestionnaire_stock », aucun gestionnaire ne se voyait rien proposer.
    stock_manager: [
        { code: 'products.price.edit',     label: 'Modifier les prix',        description: 'Peut changer les prix de vente' },
        { code: 'stock.audit.validate',    label: 'Valider les inventaires',  description: 'Peut valider les inventaires physiques' },
        { code: 'reports.generate',        label: 'Générer des rapports',     description: 'Accès aux rapports PDF' },
        { code: 'suppliers.edit',          label: 'Modifier les fournisseurs', description: 'Peut modifier les fiches fournisseurs' },
        { code: 'data.import',             label: 'Importer des données',     description: 'Imports Excel : produits et stock, clients, fournisseurs, soldes d’ouverture' },
        { code: 'treasury.balances.view',  label: 'Voir la trésorerie',       description: 'Soldes et journaux des caisses, banques et Mobile Money' },
        { code: 'treasury.manage',         label: 'Gérer la trésorerie',      description: 'Comptes, virements, retraits/apports, rapprochements (inclut la vue des soldes)' },
    ],
    comptable: [
        { code: 'users.view',              label: 'Voir les utilisateurs',    description: 'Peut consulter la liste des utilisateurs' },
        { code: 'settings.view',           label: 'Voir les paramètres',      description: 'Lecture seule des paramètres boutique' },
        { code: 'reports.all',             label: 'Tous les rapports',        description: 'Accès à tous les rapports avancés' },
        { code: 'data.import',             label: 'Importer des données',     description: 'Imports Excel : produits et stock, clients, fournisseurs, soldes d’ouverture' },
    ],
}

const ROLES_LABELS: Record<string, string> = {
    super_admin_boutique: 'Propriétaire',
    admin_boutique:       'Administrateur',
    vendeur:              'Vendeur',
    gestionnaire_stock:   'Gestionnaire stock',
    stock_manager:        'Gestionnaire stock',
    comptable:            'Comptable',
}

interface Permission { permission: string; accorde_par: string; accorde_le: string }

interface Utilisateur {
    id: string; public_id: string; nom_complet: string
    identifiant: string; role: string; est_actif: boolean
    created_at: string
    shop_user_permissions: Permission[]
}

interface Props {
    utilisateur: Utilisateur
    shopId:      string
    currentUserId: string
    estProprietaire: boolean
}

export default function GestionPermissionsUser({ utilisateur, shopId, currentUserId, estProprietaire }: Props) {
    const router = useRouter()
    // Un admin/propriétaire n'a pas de permissions modifiables (accès complet).
    const cibleEstAdmin        = estAdminComplet(utilisateur.role)
    const cibleEstProprietaire = utilisateur.role === 'super_admin_boutique'
    // On peut activer/désactiver la cible sauf : le propriétaire, soi-même,
    // ou un administrateur si l'acteur n'est pas le propriétaire.
    const peutBasculerActivation =
        !cibleEstProprietaire &&
        utilisateur.id !== currentUserId &&
        (utilisateur.role !== 'admin_boutique' || estProprietaire)

    // Permissions actuellement accordées
    const [permissionsActives, setPermissionsActives] = useState<Set<string>>(
        new Set(utilisateur.shop_user_permissions.map(p => p.permission))
    )

    const [enAttente, setEnAttente]     = useState(false)
    const [toggleEnCours, setToggleEnCours] = useState(false)
    const [message, setMessage]         = useState<{ type: 'succes'|'erreur'; texte: string } | null>(null)

    const permissionsDisponibles = PERMISSIONS_PAR_ROLE[utilisateur.role] ?? []

    function togglePermission(code: string) {
        setPermissionsActives(prev => {
            const next = new Set(prev)
            if (next.has(code)) next.delete(code)
            else next.add(code)
            return next
        })
    }

    async function handleSauvegarder() {
        setEnAttente(true)
        setMessage(null)
        const res = await mettreAJourPermissions(
            utilisateur.id,
            shopId,
            Array.from(permissionsActives)
        )
        setEnAttente(false)
        if (res?.erreur) setMessage({ type: 'erreur', texte: res.erreur })
        else setMessage({ type: 'succes', texte: 'Permissions mises à jour avec succès.' })
    }

    async function handleToggleActivation() {
        setToggleEnCours(true)
        await toggleActivationUtilisateur(utilisateur.id, !utilisateur.est_actif)
        setToggleEnCours(false)
        router.refresh()
    }

    return (
        <div className="space-y-5">

            {/* Carte infos utilisateur */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[var(--primary-soft)] rounded-2xl flex items-center justify-center shrink-0">
            <span className="text-2xl font-black text-[var(--primary-strong)]">
              {utilisateur.nom_complet.charAt(0).toUpperCase()}
            </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-lg font-bold text-foreground">{utilisateur.nom_complet}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-sm text-muted-foreground font-mono">{utilisateur.identifiant}</span>
                            <span className="text-muted-foreground/80">·</span>
                            <span className="text-sm text-[var(--primary-strong)] font-semibold">
                {ROLES_LABELS[utilisateur.role] ?? utilisateur.role}
              </span>
                        </div>
                    </div>

                    {/* Toggle activation */}
                    {peutBasculerActivation && (
                        <button
                            onClick={handleToggleActivation}
                            disabled={toggleEnCours}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                                utilisateur.est_actif
                                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                                    : 'border-green-200 text-green-600 hover:bg-green-50'
                            } disabled:opacity-50`}
                        >
                            {toggleEnCours
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Power className="w-4 h-4" />
                            }
                            {utilisateur.est_actif ? 'Désactiver' : 'Réactiver'}
                        </button>
                    )}
                </div>
            </div>

            {/* Carte permissions */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">

                <div className="flex items-center gap-2 pb-3 border-b border-border">
                    <div className="bg-[var(--primary-soft)] p-2 rounded-lg">
                        <Shield className="w-5 h-5 text-[var(--primary-strong)]" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-foreground">Permissions étendues</h2>
                        <p className="text-xs text-muted-foreground/80 mt-0.5">
                            En plus des permissions par défaut du rôle {ROLES_LABELS[utilisateur.role]}
                        </p>
                    </div>
                </div>

                {cibleEstAdmin ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                        <Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-amber-700">
                                {cibleEstProprietaire ? 'Propriétaire' : 'Administrateur'}
                            </p>
                            <p className="text-xs text-amber-600 mt-0.5">
                                {cibleEstProprietaire ? 'Le propriétaire' : 'Un administrateur'} a accès à toutes les fonctionnalités. Ses permissions ne peuvent pas être modifiées.
                            </p>
                        </div>
                    </div>
                ) : permissionsDisponibles.length === 0 ? (
                    <p className="text-sm text-muted-foreground/80 italic text-center py-4">
                        Aucune extension de permission disponible pour ce rôle.
                    </p>
                ) : (
                    <>
                        {message && (
                            <div className={`flex items-center gap-2.5 p-3.5 rounded-xl text-sm ${
                                message.type === 'succes'
                                    ? 'bg-green-50 border border-green-200 text-green-700'
                                    : 'bg-red-50 border border-red-200 text-red-700'
                            }`}>
                                {message.type === 'succes'
                                    ? <CheckCircle className="w-4 h-4 shrink-0" />
                                    : <AlertCircle className="w-4 h-4 shrink-0" />
                                }
                                {message.texte}
                            </div>
                        )}

                        <div className="space-y-2.5">
                            {permissionsDisponibles.map(perm => {
                                const active = permissionsActives.has(perm.code)
                                return (
                                    <label key={perm.code}
                                           className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                               active
                                                   ? 'bg-[var(--primary-soft)] border-primary/40'
                                                   : 'bg-[var(--surface2)] border-border hover:border-border'
                                           }`}
                                    >
                                        <div className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${
                                            active
                                                ? 'bg-primary border-primary'
                                                : 'bg-card border-border'
                                        }`}>
                                            {active && <Check className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-bold ${active ? 'text-[var(--primary-strong)]' : 'text-foreground'}`}>
                                                {perm.label}
                                            </p>
                                            <p className="text-xs text-muted-foreground/80 mt-0.5">{perm.description}</p>
                                        </div>
                                        <input type="checkbox" className="sr-only"
                                               checked={active}
                                               onChange={() => togglePermission(perm.code)} />
                                    </label>
                                )
                            })}
                        </div>

                        <button
                            onClick={handleSauvegarder}
                            disabled={enAttente}
                            className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-primary text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-black/10"
                        >
                            {enAttente
                                ? <><Loader2 className="w-4 h-4 animate-spin" />Sauvegarde...</>
                                : <><Shield className="w-4 h-4" />Enregistrer les permissions</>
                            }
                        </button>
                    </>
                )}
            </div>

        </div>
    )
}