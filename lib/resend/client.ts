import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const EXPEDITEUR = `${process.env.RESEND_FROM_NAME ?? 'Manetec Gestock'} <${process.env.RESEND_FROM_EMAIL ?? 'noreply@boldredhok.com'}>`