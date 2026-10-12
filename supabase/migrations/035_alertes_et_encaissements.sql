-- 035_alertes_et_encaissements.sql
-- ═══════════════════════════════════════════════════════════════
-- Abonnement, Lot 4.
--
-- 1. ABO-11 : chaque alerte d'expiration envoyée est mémorisée. Sans
--    cela, une fois le cron réparé (ABO-10), une boutique recevait un
--    e-mail par jour pendant la dernière semaine puis un e-mail
--    « expiré » chaque jour, pour toujours.
--    Clé : (boutique, palier, échéance). Un renouvellement change
--    l'échéance : le cycle d'alertes repart de zéro.
-- 2. ABO-18 : un paiement passé par la sandbox KkiaPay est marqué, pour
--    ne jamais compter dans les encaissements de la plateforme.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE abonnement_alertes (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id     uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    -- 'J-7', 'J-1', 'J0', puis 'relance-1' … 'relance-8' (une par semaine).
    palier      text        NOT NULL,
    echeance    timestamptz NOT NULL,
    email       text        NOT NULL,
    succes      boolean     NOT NULL,
    erreur      text,
    envoye_le   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (shop_id, palier, echeance)
);

COMMENT ON TABLE abonnement_alertes IS
    'Alertes d''expiration envoyées par le cron. Une ligne réussie par (boutique, palier, échéance) : jamais deux fois le même e-mail.';

ALTER TABLE abonnement_alertes ENABLE ROW LEVEL SECURITY;
-- Aucune politique : seul le serveur (clé service) lit et écrit.

ALTER TABLE abonnement_paiements
    ADD COLUMN sandbox boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN abonnement_paiements.sandbox IS
    'Paiement passé par la sandbox KkiaPay (test) : exclu de tout encaissement.';

-- Tous les paiements en ligne enregistrés jusqu'ici l'ont été avec les
-- clés de test (aucune clé officielle n'a encore été installée).
UPDATE abonnement_paiements SET sandbox = true WHERE moyen = 'kkiapay';
