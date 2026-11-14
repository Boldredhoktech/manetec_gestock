'use client'

import { useActionState } from 'react'
import { creerFournisseur } from '@/actions/fournisseurs'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Building2, Phone, Mail, MapPin, Globe } from 'lucide-react'
import { PiedFormulaire } from '@/components/ui/ModalesPartagees'

const etatInitial = { erreur: undefined as string | undefined }

const PAYS = [
    'Bénin','Togo','Côte d\'Ivoire','Sénégal','Mali',
    'Burkina Faso','Niger','Ghana','Nigeria','Cameroun',
    'Chine','Inde','France','Maroc','Afrique du Sud','Autre',
]

export default function FormulaireFournisseur() {
    const [etat, action, enAttente] = useActionState(
        async (_prev: typeof etatInitial, formData: FormData) => {
            const res = await creerFournisseur(formData)
            return res ?? etatInitial
        },
        etatInitial
    )

    return (
        <form action={action} className="space-y-5">

            {etat.erreur && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{etat.erreur}</span>
                </div>
            )}

            {/* Infos générales */}
            <div className="bloc-form bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-[var(--primary-strong)] flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Informations générales
                </h2>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Nom du fournisseur <span className="text-red-500">*</span>
                    </label>
                    <input name="nom" type="text" required
                           placeholder="Ex: Distribex Import-Export"
                           disabled={enAttente}
                           className={inputClass} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Nom du contact</label>
                        <input name="nomContact" type="text"
                               placeholder="Personne référente"
                               disabled={enAttente}
                               className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Poste du contact</label>
                        <input name="posteContact" type="text"
                               placeholder="Ex: Directeur commercial"
                               disabled={enAttente}
                               className={inputClass} />
                    </div>
                </div>
            </div>

            {/* Coordonnées */}
            <div className="bloc-form bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-[var(--primary-strong)] flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Coordonnées
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Téléphone</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/80" />
                            <input name="telephone" type="tel"
                                   placeholder="+229 97 00 00 00"
                                   disabled={enAttente}
                                   className={inputClass + ' pl-9'} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/80" />
                            <input name="email" type="email"
                                   placeholder="contact@fournisseur.com"
                                   disabled={enAttente}
                                   className={inputClass + ' pl-9'} />
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Adresse</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/80" />
                        <input name="adresse" type="text"
                               placeholder="Adresse complète du fournisseur"
                               disabled={enAttente}
                               className={inputClass + ' pl-9'} />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Ville</label>
                        <input name="ville" type="text"
                               placeholder="Ex: Lagos"
                               disabled={enAttente}
                               className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Pays</label>
                        <select name="pays" disabled={enAttente} className={inputClass}>
                            <option value="">— Sélectionner —</option>
                            {PAYS.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Infos légales */}
            <div className="bloc-form bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-[var(--primary-strong)] flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Informations légales
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">IFU</label>
                        <input name="ifu" type="text"
                               placeholder="Numéro IFU"
                               disabled={enAttente}
                               className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">RCCM</label>
                        <input name="rccm" type="text"
                               placeholder="Numéro RCCM"
                               disabled={enAttente}
                               className={inputClass} />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Notes internes</label>
                    <textarea name="notes" rows={3}
                              placeholder="Conditions de paiement, délais, remarques..."
                              disabled={enAttente}
                              className={inputClass + ' resize-none'} />
                </div>
            </div>

            <PiedFormulaire>
                <Button type="submit" disabled={enAttente} className="h-11 px-5 rounded-xl font-semibold">
                    {enAttente
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</>
                        : 'Créer le fournisseur'
                    }
                </Button>
            </PiedFormulaire>
        </form>
    )
}

const inputClass = `
  w-full px-3 py-2.5 bg-[var(--surface2)] border border-border rounded-xl text-sm
  focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40
  transition-colors disabled:opacity-50
`