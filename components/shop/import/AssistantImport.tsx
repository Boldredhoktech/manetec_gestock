'use client'

// ═══════════════════════════════════════════════════════════════
// Assistant d'import Excel (mig 042) : 1. modèle  2. fichier + date
// 3. aperçu ligne par ligne  4. import des lignes valides.
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Upload, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { analyserImport, importerDonnees, type ResultatAnalyse } from '@/actions/import'
import { COLONNES, LIBELLES_IMPORT, TYPES_IMPORT, type TypeImport } from '@/lib/import/colonnes'

const aujourdhui = () => new Date().toISOString().slice(0, 10)
const fr = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR')

export default function AssistantImport({ dateDemarrage }: { dateDemarrage: string | null }) {
    const router = useRouter()
    const [type, setType] = useState<TypeImport>('produits')
    const [date, setDate] = useState(dateDemarrage ?? aujourdhui())
    const [analyse, setAnalyse] = useState<ResultatAnalyse | null>(null)
    const [filtre, setFiltre] = useState<'toutes' | 'rejet' | 'note'>('toutes')
    const [erreur, setErreur] = useState<string | null>(null)
    const [resultat, setResultat] = useState<{ id: string; publicId: string; importees: number; rejets: { ligne: number; nom: string; motif: string }[] } | null>(null)
    const [enAnalyse, demarrerAnalyse] = useTransition()
    const [enImport, demarrerImport] = useTransition()

    const colonnesAffichees = useMemo(() => {
        const toutes = COLONNES[type]
        const trouvees = new Set(analyse?.colonnesTrouvees ?? [])
        return toutes.filter(c => c.obligatoire || trouvees.has(c.cle)).slice(0, 7)
    }, [type, analyse])

    const valides = analyse?.lignes.filter(l => l.statut !== 'rejet') ?? []
    const rejetees = analyse?.lignes.filter(l => l.statut === 'rejet') ?? []
    const avecNote = analyse?.lignes.filter(l => l.statut === 'note') ?? []
    const visibles = (analyse?.lignes ?? []).filter(l => filtre === 'toutes' || l.statut === filtre)

    function changerType(t: TypeImport) {
        setType(t); setAnalyse(null); setResultat(null); setErreur(null); setFiltre('toutes')
    }

    function analyser(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        fd.set('type', type)
        setErreur(null); setResultat(null)
        demarrerAnalyse(async () => {
            const r = await analyserImport(fd)
            if ('erreur' in r) { setErreur(r.erreur); setAnalyse(null) } else { setAnalyse(r); setFiltre(r.lignes.some(l => l.statut === 'rejet') ? 'rejet' : 'toutes') }
        })
    }

    function importer() {
        if (!analyse) return
        setErreur(null)
        demarrerImport(async () => {
            const r = await importerDonnees(type, valides.map(l => l.valeurs), analyse.nomFichier, dateDemarrage ? null : date,
                rejetees.map(l => ({ ligne: l.ligne, motif: l.erreurs.join(' '), donnees: l.valeurs })))
            if ('erreur' in r) { setErreur(r.erreur); return }
            setResultat(r); setAnalyse(null); router.refresh()
        })
    }

    return (
        <div className="space-y-5">
            <div role="tablist" aria-label="Type d'import" className="flex flex-wrap gap-1.5 p-1.5 bg-card border border-border rounded-xl w-fit max-w-full">
                {TYPES_IMPORT.map(t => (
                    <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => changerType(t)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${type === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                        {LIBELLES_IMPORT[t]}
                    </button>
                ))}
            </div>

            <ol className="grid gap-3 md:grid-cols-2">
                <li className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <p className="font-semibold text-sm">1. Téléchargez le modèle et remplissez-le</p>
                    <p className="text-sm text-muted-foreground">
                        Obligatoire : {COLONNES[type].filter(c => c.obligatoire).map(c => c.titre).join(' et ')}. Tout le reste est facultatif.
                    </p>
                    <a href={`/api/v1/xlsx/import?type=${type}`}
                       className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-input bg-background text-sm font-semibold hover:bg-muted">
                        <Download className="w-4 h-4" aria-hidden="true" />Modèle {LIBELLES_IMPORT[type].toLowerCase()} (.xlsx)
                    </a>
                </li>
                <li className="bg-card border border-border rounded-xl p-4">
                    <form onSubmit={analyser} className="space-y-3">
                        <p className="font-semibold text-sm">2. Déposez le fichier rempli</p>
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium">Fichier Excel</span>
                            <input name="fichier" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                   className="block w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-muted file:font-medium" />
                        </label>
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium">Date de démarrage</span>
                            <input type="date" value={date} max={aujourdhui()} disabled={!!dateDemarrage}
                                   onChange={e => setDate(e.target.value)}
                                   className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm disabled:opacity-70" />
                            <span className="block text-xs text-muted-foreground">
                                {dateDemarrage
                                    ? `Fixée au ${fr(dateDemarrage)} par un premier import : tous les soldes d'ouverture y sont datés.`
                                    : 'Le stock, les créances et les dettes d\'ouverture seront datés de ce jour. Fixée une fois pour toutes.'}
                            </span>
                        </label>
                        <Button type="submit" disabled={enAnalyse} className="w-full">
                            {enAnalyse ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyse…</> : <><Upload className="w-4 h-4 mr-2" />Analyser le fichier</>}
                        </Button>
                    </form>
                </li>
            </ol>

            {erreur && (
                <div role="alert" className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{erreur}</span>
                </div>
            )}

            {resultat && (
                <div role="status" className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-3 text-sm space-y-2">
                    <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="w-4 h-4" />
                        Import {resultat.publicId} : {resultat.importees} ligne(s) importée(s){resultat.rejets.length ? `, ${resultat.rejets.length} refusée(s) au dernier contrôle` : ''}.
                    </p>
                    {resultat.rejets.length > 0 && (
                        <>
                            <ul className="list-disc pl-6 text-xs">
                                {resultat.rejets.slice(0, 8).map(r => <li key={r.ligne}>Ligne {r.ligne} ({r.nom}) : {r.motif}</li>)}
                            </ul>
                            <a href={`/api/v1/xlsx/import?rejets=${resultat.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold underline">
                                <Download className="w-3.5 h-3.5" />Télécharger les lignes rejetées pour les corriger
                            </a>
                        </>
                    )}
                </div>
            )}

            {analyse && (
                <section aria-labelledby="apercu" className="bg-card border border-border rounded-xl">
                    <div className="p-4 border-b border-border space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 id="apercu" className="font-semibold flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />3. Aperçu de {analyse.nomFichier}
                            </h2>
                            <div role="group" aria-label="Filtre" className="flex gap-1.5">
                                {([['toutes', `Toutes (${analyse.lignes.length})`], ['rejet', `Rejetées (${rejetees.length})`], ['note', `À noter (${avecNote.length})`]] as const).map(([k, l]) => (
                                    <button key={k} type="button" aria-pressed={filtre === k} onClick={() => setFiltre(k)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filtre === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input'}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                            <div className="rounded-lg bg-blue-50 text-blue-900 px-3 py-2"><span className="block text-xs font-semibold">Prêtes</span><b className="text-lg">{valides.length}</b></div>
                            <div className="rounded-lg bg-red-50 text-red-800 px-3 py-2"><span className="block text-xs font-semibold">Rejetées</span><b className="text-lg">{rejetees.length}</b></div>
                            <div className="rounded-lg bg-amber-50 text-amber-900 px-3 py-2"><span className="block text-xs font-semibold">Avec une note</span><b className="text-lg">{avecNote.length}</b></div>
                            {analyse.quota && analyse.quota.max >= 0 && analyse.quota.max < 999999 && (
                                <div className="rounded-lg bg-muted px-3 py-2"><span className="block text-xs font-semibold">Quota du forfait</span>
                                    <b className="text-lg">{analyse.quota.actuels} / {analyse.quota.max}</b></div>
                            )}
                        </div>
                        {analyse.enteteInconnues.length > 0 && (
                            <p className="text-xs text-amber-800">Colonnes non reconnues, ignorées : {analyse.enteteInconnues.join(', ')}.</p>
                        )}
                    </div>
                    <div className="overflow-x-auto max-h-[520px]">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead className="sticky top-0 bg-card">
                                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                                    <th className="px-3 py-2">Ligne</th>
                                    {colonnesAffichees.map(c => <th key={c.cle} className="px-3 py-2">{c.titre}</th>)}
                                    <th className="px-3 py-2">Résultat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.slice(0, 500).map(l => (
                                    <tr key={l.ligne} className={`border-t border-border ${l.statut === 'rejet' ? 'bg-red-50/60' : ''}`}>
                                        <td className="px-3 py-2 text-muted-foreground tabular-nums">{l.ligne}</td>
                                        {colonnesAffichees.map(c => {
                                            const v = l.valeurs[c.cle]
                                            return <td key={c.cle} className="px-3 py-2">
                                                {v === null || v === undefined ? <span className="text-muted-foreground">—</span>
                                                    : typeof v === 'boolean' ? (v ? 'Oui' : 'Non')
                                                    : typeof v === 'string' && v.startsWith('!') ? <span className="text-red-700">{v.slice(1)}</span>
                                                    : typeof v === 'number' ? v.toLocaleString('fr-FR') : String(v)}
                                            </td>
                                        })}
                                        <td className="px-3 py-2 text-xs">
                                            {l.statut === 'rejet'
                                                ? <span className="text-red-700 font-medium">{l.erreurs.join(' ')}</span>
                                                : l.statut === 'note'
                                                    ? <span className="text-amber-800">{l.notes.join(' ')}</span>
                                                    : <span className="text-blue-700 font-medium">Prête</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {visibles.length > 500 && <p className="p-3 text-xs text-muted-foreground">500 premières lignes affichées sur {visibles.length}.</p>}
                    </div>
                    <div className="p-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                            {rejetees.length > 0 ? 'Les lignes rejetées ne seront pas importées : corrigez-les puis réimportez le fichier.' : 'Toutes les lignes sont prêtes.'}
                            {!dateDemarrage && ` Date de démarrage : ${fr(date)}.`}
                        </p>
                        <Button type="button" onClick={importer} disabled={enImport || valides.length === 0}>
                            {enImport ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Import…</> : `4. Importer ${valides.length} ligne(s)`}
                        </Button>
                    </div>
                </section>
            )}
        </div>
    )
}
