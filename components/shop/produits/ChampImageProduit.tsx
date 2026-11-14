'use client'

// Photo du produit (forfait Pro et au-dessus).
// L'image choisie est réduite (400 px au plus) et convertie en WebP DANS
// le navigateur avant l'envoi : quelques dizaines de Ko au lieu de
// plusieurs Mo pris au téléphone.
//   • dans un <form action> : la photo part dans le champ caché « photo » ;
//   • sinon : `onChange` remonte le fichier et le choix « retirer ».

import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'

const TAILLE_MAX = 400

async function versWebp(source: File): Promise<File> {
    const image = await createImageBitmap(source)
    const echelle = Math.min(1, TAILLE_MAX / Math.max(image.width, image.height))
    const toile = document.createElement('canvas')
    toile.width = Math.round(image.width * echelle)
    toile.height = Math.round(image.height * echelle)
    toile.getContext('2d')!.drawImage(image, 0, 0, toile.width, toile.height)
    const blob = await new Promise<Blob | null>(r => toile.toBlob(r, 'image/webp', 0.8))
    // Un navigateur sans encodeur WebP rend du PNG : accepté aussi.
    const final = blob ?? await new Promise<Blob | null>(r => toile.toBlob(r, 'image/png'))
    if (!final) throw new Error('conversion')
    const ext = final.type === 'image/webp' ? 'webp' : 'png'
    return new File([final], `produit.${ext}`, { type: final.type })
}

export default function ChampImageProduit({
    urlActuelle, disabled, onChange,
}: {
    urlActuelle?: string | null
    disabled?:    boolean
    onChange?:    (fichier: File | null, retirer: boolean) => void
}) {
    const champCache = useRef<HTMLInputElement>(null)
    const [apercu, setApercu] = useState<string | null>(urlActuelle ?? null)
    const [poids, setPoids] = useState<number | null>(null)
    const [retirer, setRetirer] = useState(false)
    const [erreur, setErreur] = useState<string | null>(null)

    useEffect(() => () => { if (apercu?.startsWith('blob:')) URL.revokeObjectURL(apercu) }, [apercu])

    async function choisir(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        setErreur(null)
        try {
            const webp = await versWebp(f)
            if (webp.size > 300 * 1024) { setErreur('Image trop lourde même réduite : choisissez-en une plus simple.'); return }
            if (champCache.current) {
                const dt = new DataTransfer(); dt.items.add(webp); champCache.current.files = dt.files
            }
            setApercu(URL.createObjectURL(webp)); setPoids(webp.size); setRetirer(false)
            onChange?.(webp, false)
        } catch {
            setErreur('Image illisible : choisissez un fichier WebP, PNG ou JPEG.')
        }
    }

    function enlever() {
        if (champCache.current) champCache.current.value = ''
        setApercu(null); setPoids(null); setRetirer(true)
        onChange?.(null, true)
    }

    return (
        <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">Photo du produit</span>
            <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-xl border border-dashed border-input bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                    {apercu
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={apercu} alt="Aperçu de la photo du produit" className="w-full h-full object-cover" />
                        : <ImagePlus className="w-7 h-7 text-muted-foreground" aria-hidden="true" />}
                </div>
                <div className="space-y-1.5 min-w-0">
                    <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-input text-sm font-medium cursor-pointer hover:bg-muted ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <ImagePlus className="w-4 h-4" aria-hidden="true" />{apercu ? 'Changer l\'image' : 'Choisir une image'}
                        <input type="file" accept="image/webp,image/png,image/jpeg" onChange={choisir} disabled={disabled} className="sr-only" />
                    </label>
                    {apercu && (
                        <button type="button" onClick={enlever} disabled={disabled}
                                className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline">
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />Retirer l&apos;image
                        </button>
                    )}
                    <p className="text-xs text-muted-foreground">
                        WebP conseillé. L&apos;image est réduite automatiquement (400 px, WebP){poids ? ` : ${Math.round(poids / 1024)} Ko.` : '.'}
                    </p>
                    {erreur && <p className="text-xs text-destructive">{erreur}</p>}
                </div>
            </div>
            <input ref={champCache} type="file" name="photo" className="hidden" tabIndex={-1} aria-hidden="true" />
            {retirer && <input type="hidden" name="retirerPhoto" value="true" />}
        </div>
    )
}
