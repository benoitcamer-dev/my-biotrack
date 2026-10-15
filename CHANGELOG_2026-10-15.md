# Changelog — Session du 15/10/2026

Demande de l'utilisateur : les kcal de l'itinéraire aller-retour Domicile → Psy n'étaient
pas cohérentes.

Commit : `9005e5c`.

## 1. Cause : lieu « Psy » géocodé au milieu de la rue

Le lieu enregistré « Psy » (`24 rue Vendôme, 69006 Lyon`) avait été résolu par ORS en
« Rue Vendôme, Lyon, France » : point générique de la rue, à ~1 km au sud du vrai n° 24.
`geocodePlace()` réutilisant les coordonnées enregistrées, l'itinéraire donnait 0,36 km
l'aller (0,7 km A/R) au lieu de 1,3 km (2,6 km A/R) → kcal sous-estimées ×4. La formule
kcal n'était pas en cause.

## 2. Fix géocodage : numéro de rue exigé (`9005e5c`)

`geocodeAddress()` : si l'adresse commence par un numéro et que le libellé renvoyé ne le
contient pas, on passe au service suivant (Google → ORS → Nominatim, qui trouve bien le
n° 24). Si aucun ne le trouve, le premier résultat est renvoyé avec `approx: true`, et
`savePlace()` affiche un avertissement « Numéro introuvable, position approximative » au
lieu du simple « Lieu trouvé ». Nominatim : libellé reconstruit « n° rue, ville »
(`addressdetails=1`).

## 3. Données corrigées

- « Psy » réenregistré dans l'app (adresse `24 Rue Vendôme, 69006 Lyon, France`) :
  coords 45,77374 / 4,84388 en base. Vérifié : itinéraire Domicile ↔ Psy = 1,3 km,
  2,6 km A/R, 28 min à 5,5 km/h, 125 kcal.
- Les 12 autres lieux contrôlés avec la nouvelle fonction : écart ≤ 16 m (81 m pour la gare
  Part-Dieu, 56 m pour la Société Générale « 6 … 2c », marquée approx) — rien à corriger.

## Revue

- Vérifié : `node verify.js`, test Node de la vraie `geocodeAddress()` sur les 13 lieux,
  code en ligne après hard reload, coordonnées en base Supabase, itinéraire recalculé live.
- À noter : la copie locale des lieux sur le téléphone se resynchronise au prochain
  chargement de l'app (`loadSettingsRemote()`).
