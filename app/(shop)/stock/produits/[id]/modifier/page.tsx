// Nouveau design (lot 4) : ce formulaire s'ouvre en modale. Les anciens liens restent valables.
import { redirect } from 'next/navigation'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    redirect(`/stock/produits/${id}?modifier=1`)
}
