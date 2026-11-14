// app/(shop)/admin/clients/nouveau/page.tsx
// Nouveau design (lot 3) : la création se fait dans une modale sur la
// liste. Les anciens liens restent valables.
import { redirect } from 'next/navigation'

export default function PageNouveauClient() {
    redirect('/admin/clients?nouveau=1')
}
