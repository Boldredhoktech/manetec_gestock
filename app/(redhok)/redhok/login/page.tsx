import type { Metadata } from 'next'
import FormulaireConnexionPlateforme from '@/components/redhok/FormulaireConnexionPlateforme'

export const metadata: Metadata = {
    title: 'Accès Plateforme — Bold Redhok Tech',
}

export default function PageConnexionPlateforme() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-md">
                <FormulaireConnexionPlateforme />
            </div>
        </main>
    )
}