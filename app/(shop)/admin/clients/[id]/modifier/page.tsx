// app/(shop)/admin/clients/[id]/modifier/page.tsx
// Nouveau design (lot 3) : la modification se fait dans une modale sur
// la fiche. Les anciens liens restent valables.
import { redirect } from 'next/navigation'

export default async function PageModifierClient({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    redirect(`/admin/clients/${id}?modifier=1`)
}
