// Nouveau design (lot 4) : ce formulaire s'ouvre en modale. Les anciens liens restent valables.
import { redirect } from 'next/navigation'

export default function Page() {
    redirect('/stock/produits?nouveau=1')
}
