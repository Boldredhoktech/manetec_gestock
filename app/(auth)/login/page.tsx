// app/(auth)/login/page.tsx

import type { Metadata } from 'next'
import FormulaireConnexionBoutique from '@/components/shared/FormulaireConnexionBoutique'

export const metadata: Metadata = {
    title: 'Connexion Boutique',
}

export default function PageConnexionBoutique() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-md">
                <FormulaireConnexionBoutique />
            </div>
        </main>
    )
}