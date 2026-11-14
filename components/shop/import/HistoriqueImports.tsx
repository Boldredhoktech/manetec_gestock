'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import { annulerImport } from '@/actions/import'
import { LIBELLES_IMPORT, type TypeImport } from '@/lib/import/colonnes'

export interface ImportPasse {
    id: string; public_id: string; type: TypeImport; nom_fichier: string | null
    date_demarrage: string; nb_lignes: number; nb_importees: number; nb_rejetees: number
    statut: 'valide' | 'annule'; motif_annulation: string | null; created_at: string
}

function Annuler({ id }: { id: string }) {
    const router = useRouter()
    const [ouvert, setOuvert] = useState(false)
    const [motif, setMotif] = useState('')
    const [erreur, setErreur] = useState<string | null>(null)
    const [enCours, demarrer] = useTransition()
    if (!ouvert) return <button type="button" onClick={() => setOuvert(true)} className="text-xs font-medium text-destructive hover:underline">Annuler l&apos;import</button>
    return (
        <div className="flex flex-col gap-1.5 min-w-[220px]">
            <input value={motif} onChange={e => setMotif(e.target.value)} aria-label="Motif de l'annulation"
                   placeholder="Motif (ex. mauvais fichier)" className="px-2 py-1.5 border border-input rounded text-xs bg-background" />
            {erreur && <span className="text-xs text-destructive">{erreur}</span>}
            <p className="text-xs text-muted-foreground">Tout ce que l&apos;import a créé sera retiré, s&apos;il n&apos;a pas encore servi.</p>
            <div className="flex gap-2">
                <button type="button" disabled={enCours || motif.trim().length < 3}
                        onClick={() => demarrer(async () => {
                            const r = await annulerImport(id, motif)
                            if ('erreur' in r) setErreur(r.erreur); else { setOuvert(false); router.refresh() }
                        })}
                        className="px-2 py-1 rounded bg-destructive text-white text-xs font-medium disabled:opacity-50">{enCours ? '…' : 'Confirmer'}</button>
                <button type="button" onClick={() => setOuvert(false)} className="px-2 py-1 rounded border border-input text-xs">Garder</button>
            </div>
        </div>
    )
}

export default function HistoriqueImports({ imports, peutAnnuler }: { imports: ImportPasse[]; peutAnnuler: boolean }) {
    if (imports.length === 0) return <p className="p-4 text-sm text-muted-foreground">Aucun import pour l&apos;instant.</p>
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
                <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2">Import</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Fichier</th>
                        <th className="px-4 py-2 text-right">Importées</th><th className="px-4 py-2 text-right">Rejetées</th>
                        <th className="px-4 py-2">État</th><th className="px-4 py-2" />
                    </tr>
                </thead>
                <tbody>
                    {imports.map(i => (
                        <tr key={i.id} className={`border-t border-border align-top ${i.statut === 'annule' ? 'text-muted-foreground' : ''}`}>
                            <td className="px-4 py-2">
                                <span className="font-medium">{i.public_id}</span>
                                <span className="block text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString('fr-FR')}</span>
                            </td>
                            <td className="px-4 py-2">{LIBELLES_IMPORT[i.type]}</td>
                            <td className="px-4 py-2 max-w-[200px] truncate">{i.nom_fichier ?? '—'}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{i.nb_importees} / {i.nb_lignes}</td>
                            <td className="px-4 py-2 text-right tabular-nums">
                                {i.nb_rejetees > 0
                                    ? <a href={`/api/v1/xlsx/import?rejets=${i.id}`} className="inline-flex items-center gap-1 text-red-700 font-medium hover:underline">
                                        <Download className="w-3.5 h-3.5" aria-hidden="true" />{i.nb_rejetees}</a>
                                    : 0}
                            </td>
                            <td className="px-4 py-2">
                                {i.statut === 'annule'
                                    ? <span className="text-xs">Annulé{i.motif_annulation ? ` — ${i.motif_annulation}` : ''}</span>
                                    : <span className="text-xs text-blue-700 font-medium">Validé</span>}
                            </td>
                            <td className="px-4 py-2">{peutAnnuler && i.statut === 'valide' && i.nb_importees > 0 && <Annuler id={i.id} />}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
