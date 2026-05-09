export const MOYENS_PAIEMENT = [
    { code: 'cash',          label: 'Espèces',             reference_requise: false },
    { code: 'wave',          label: 'Wave',                reference_requise: true  },
    { code: 'mtn_momo',      label: 'MTN Mobile Money',    reference_requise: true  },
    { code: 'celtiis_cash',  label: 'Celtiis Cash',        reference_requise: true  },
    { code: 'moov_money',    label: 'Moov Africa Money',   reference_requise: true  },
    { code: 'other_mobile',  label: 'Autre Mobile Money',  reference_requise: true  },
    { code: 'bank_card',     label: 'Carte bancaire',      reference_requise: false },
    { code: 'bank_transfer', label: 'Virement bancaire',   reference_requise: true  },
] as const

export type CodePaiement = typeof MOYENS_PAIEMENT[number]['code']