// Nouveau design (lot 5) : ce formulaire s'ouvre en modale. Les anciens liens restent valables.
import { redirect } from 'next/navigation'

export default function Page() {
    redirect('/compta/salaires?nouveau=1')
}
