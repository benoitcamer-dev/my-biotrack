# Vélo Domyos EB 520 B — suivi (session du 15/11/2026)

Objectif : récupérer les séances de vélo (calories) dans l'app sans saisie, et caler le calcul des kcal.

## Décisions de la session
- APK : abandonné (gain trop faible, voir discussion du 15/11).
- Calcul « Marche auto » : **gardé tel quel** (poids seul, MET net). Vérifié : 15/11 = 68 kcal, recalcul à la main = 67 ; poids 84,75 kg bien appliqué.
- Calcul personnalisé (Mifflin-St Jeor : taille 183, âge 33, sexe H) : **en attente**, à reproposer avec les chiffres du vélo (effet attendu ≈ −10 % sur marche et vélo « vitesse »). Poids à utiliser : dernier poids pesé.
- Vélo mode « kcal machine » : correction −25 % par défaut (`bt_bike_correction`), calée sur l'ancien EB 140 → à recalibrer sur l'EB 520 B.

## Constats vérifiés (15/11, ADB + pages Kinomap)
- Le vélo « Domyos-Bike-0337 - EB520B » est déjà appairé dans Kinomap (com.kinomap.training 4.7.4, installée le 10/11).
- Domyos E Connected est remplacée par Kinomap (depuis mai 2025).
- Kinomap peut écrire dans Health Connect (séances, calories totales, puissance, pouls, distance, vitesse) mais **0 droit accordé** pour l'instant. Réglage : Mon profil → roue dentée → « Santé Connect » → AUTORISER.
- HC Webhook (1.9.22) : droits accordés = pas, distance seulement. Droits Exercice / Calories totales : non accordés. La fonction Supabase `hc-webhook` (v12) ne traite que pas + distance.
- Essai Kinomap : **30 jours restants le 15/11 (≈ jusqu'au 10/12/2026)**. Après l'essai, la page officielle dit que « Export of your activity data » demande un abonnement (11,99 €/mois ou 89,99 €/an). Non confirmé si Health Connect est concerné. Ne rien payer.
- Ne pas appuyer sur « C'EST PARTI » (Avantages DOMYOS) sans savoir ce que ça engage.
- Veille écran du Pixel : remise à 60000 (vérifié).

## Plan de demain (séance de vélo)
Prévenir Claude avant de partir.
1. **Test Kinomap → Health Connect** : l'utilisateur accorde les droits d'écriture dans Kinomap, fait la séance, note durée / watts / kcal affichées par la console (photo). Claude vérifie par ADB si la séance et ses calories arrivent dans Health Connect.
2. **Test Bluetooth direct (PC, lecture seule)** : Kinomap fermée sur le tél (le vélo n'accepte probablement qu'une connexion), PC près du vélo, l'utilisateur pédale ~2 min ; Claude lit le service FTMS (watts, cadence, vitesse, kcal ?). Demander l'accord avant d'installer une bibliothèque Bluetooth Node.
3. Comparer kcal console / kcal calculées depuis les watts (≈ kJ de travail) → proposer une correction chiffrée pour le mode « kcal machine » (et voir si la soustraction du repos s'impose, cohérence avec la marche en kcal nettes).
4. Si l'export Health Connect marche : accorder à HC Webhook la lecture Exercice + Calories, adapter `hc-webhook`. Vers le 10/12 : revérifier que l'export survit à la fin de l'essai.

## Repli
Saisie manuelle des kcal de la console dans l'app (10 s par séance). Google Agenda : l'événement vélo se crée déjà à la validation de l'entrée dans l'app.

---

# Session du 16/11/2026 — lecture Bluetooth directe (résultats vérifiés)

## Lecture FTMS : fonctionne (PC, Chrome Android, Brave Android)
- Vélo `Domyos-Bike-0337`, service FTMS `0x1826`, caractéristique **Indoor Bike Data `0x2AD2`** (notify, ~4 paquets/s). Flags observés `0x0B76` : km/h, km/h moyen, cadence (0,5 tr/min), distance (3 octets), résistance, W, kcal (total, /h, /min), pouls, durée écoulée (s). **Pas de durée restante** dans les paquets → durée cible réglée côté app (en minutes).
- Pouls = 0 sans capteur (à reconfirmer mains sur les capteurs ou ceinture). 1er paquet : distance parasite (11 m) → ignorer l'incohérence initiale.
- **Brave Android (1.99.57)** : API bloquée par défaut (« Web Bluetooth API globally disabled »). Réglage `brave://flags/#brave-web-bluetooth-api` → **Enabled** + relancer (fait le 16/11). Le réglage Chromium `#enable-web-bluetooth` est « non disponible » : ce n'est pas lui. Chrome Android fonctionne sans réglage. Permission « Appareils à proximité » à accepter. Localhost = contexte sécurisé (test) ; GitHub Pages = HTTPS.
- **Une seule connexion à la fois** : un onglet Chrome resté connecté empêchait Brave de voir le vélo (`dumpsys bluetooth_manager` : client GATT `com.android.chrome`). Prévoir déconnexion à la fin/fermeture du modal. Fermer aussi Kinomap.
- `wakeLock` disponible dans Brave.

## Formule de la console (vérifiée, R²=1,000 sur 481 paquets, écart max 0,5 kcal/h)
`kcal/h = 132 + 3,30 × W` → socle de repos 132 kcal/h + effort à rendement implicite 26 %. Recoupée sur 2 autres relevés (91 W → 432, 95 W → 445).
**Étendue le 16/11 (2e capture PC, 848 paquets sur 212 s, W de 60 à 140, tr/min 51–74)** : `kcal/h = 131,8 + 3,302 × W`, R² = 1,0000, écart max 0,6 kcal/h → la formule tient de 60 à 140 W. Non testé au-delà de 140 W ni sous 60 W.
Le champ **résistance** FTMS dépend du mode du vélo (3–4 le matin, 9 à 13 en 2e capture ; l'utilisateur ne peut pas descendre sous 9 dans ce mode) : ne pas l'utiliser dans les calculs, seuls les watts comptent. Le 1er paquet de chaque connexion a une distance parasite (11 m puis 104 m).

## Relevés du jour (même séance console continue)
| Relevé | Console | kcal | Distance | W moy |
|---|---|---|---|---|
| PC 120 s | 210→330 s | 22→37 | 1927 m | 89 |
| Chrome 20 s | 793→812 s | 92→94 | 4742 m | 93 |
| Brave 10 s | 1292 s | 149 | 7582 m | 88 |
Entre relevés : 426 puis 412 kcal/h ; 21,0 puis 21,3 km/h → cohérent. W moyens de toute la séance ≈ 86 W : **estimés** via la formule (pas mesurés en continu).

## Correction −25 %
Conservée. Sur 1292 s (149 kcal console) : −25 % = 112 ; effort seul (sans socle) ≈ 102 ; rendement réel 22 % ≈ 120. Brut/net à trancher après quelques séances (la marche est en kcal nettes).

## Supabase (projet zlbwoxsmmdytoucgyhmc)
- Table **`bike_sessions`** créée le 16/11/2026 (migration `create_bike_sessions`) : 1 ligne/séance — date, ended_at, end_reason (manual/idle/disconnect/draft), duration_s, measured_s, partial, avg_w, max_w, mech_kj, avg_rpm, avg_kmh, distance_m, avg_hr, console_kcal, correction_pct, kcal_saved, kcal_from_watts, entry_id. RLS activée, 4 policies `authenticated` (own rows). Vérifié : 0 ligne. Aucune entrée vélo dans `entries` depuis le 14/11.

## Décisions validées (codées le 16/11/2026 — voir « Fin de session » en bas ; jamais testées sur le vélo)
- Séance en direct DANS la PWA Brave (modal vélo, mode « Kcal machine »). Affichage : watts, kcal (corrigées + estimation « effort seul » depuis les watts), durée écoulée et restante **en minutes**, distance, km/h, pouls. Durée cible réglable (min), mémorisée.
- Option **A** : enregistrement automatique de l'entrée à la fin, avec message + bouton Annuler. Option **B** : une ligne `bike_sessions` par séance.
- Fin de séance : bouton « Terminer » / 3 min sans pédaler (watts et cadence à 0, compte à rebours) / déconnexion du vélo. Brouillon local toutes les 10 s → proposition de reprise si l'app a été fermée.
- Mesure continue des watts : pondérée par la durée console (paquets en double ignorés), moyenne, max, kJ. **Couverture** = secondes mesurées ÷ durée console. Connexion tardive : les compteurs cumulés de la console (durée, kcal, distance) couvrent toute la séance ; les W moyens de la partie manquée se reconstruisent par la formule ci-dessus et se recoupent avec la partie mesurée (tolérance ≈ ±3 W). Seuil « partielle » : < 95 % de couverture mesurée.

## Reste à faire
1. Coder : `app.js` + `index.html` + `styles.css` (+ bundle `index-complet.html` via `node verify.js`), puis commit/push ciblé (⚠️ ne pas commiter les icônes `D` déjà supprimées dans l'arbre de travail) et **vérification live Brave** (hard reload, SW).
2. Comparer les valeurs de l'écran console avec le Bluetooth (regarder l'écran pendant que l'app est connectée). Mesurer aussi ce qui se passe quand le vélo s'éteint en pleine séance (gattserverdisconnected ? paquets coupés ?) — non testé.

## Comportement à l'arrêt de pédalage (capture PC du 16/11, 60 s dont ~30 s d'arrêt puis reprise)
- Le vélo **continue d'envoyer ses paquets (4/s)** à l'arrêt : W=0, tr/min=0, km/h=0, kcal/h=0. Pas de déconnexion pendant une pause de 30 s.
- La **durée console `s` s'arrête** pendant l'arrêt (2102 → 2102 sur 30 s ; 31 s de console pour 60 s d'horloge), et kcal et distance sont figées → la durée console = temps de pédalage effectif. Les kcal/h valent 0 à l'arrêt : le socle de 132 kcal/h n'est compté que **quand on pédale** (W>0).
- Formule confirmée aussi à faible puissance : 10 W → 164 kcal/h (formule 164,8), 56 W → 316, 68 W → 356, 77 W → 386.
- À la reprise la puissance monte en ~30 s (10 → 56 → 68 → 77 W).
- Le 1er paquet de chaque connexion a une distance fausse (122 m puis 12 280 m) : l'ignorer.
- **Conséquences pour l'app** : (1) fin de séance « arrêt de pédalage » = W=0 et tr/min=0 pendant **30 s d'horloge** (seuil choisi par l'utilisateur ; une pause plus longue donne 2 séances, accepté) — le chrono console ne peut pas servir à détecter l'arrêt puisqu'il se fige ; (2) la couverture reste `secondes mesurées (en temps console) ÷ durée console` ; (3) vélo éteint = événement de déconnexion ou plus aucun paquet pendant ~10 s → fin « disconnect » ; (4) la table `bike_sessions` a `duration_s` (temps console = pédalage) mais pas la durée d'horloge : envisager une colonne `wall_s` (migration à faire) pour l'heure de début de l'événement Agenda.
3. Test Kinomap → Health Connect non fait (droits d'écriture Kinomap à accorder) ; essai Kinomap jusqu'au ~10/12.
4. Session ADB : veille remise à 60000 (vérifié). Page de test jetable (scratchpad, non conservée) : un bouton `requestDevice({filters:[{services:[0x1826]}]})` + `startNotifications` sur `0x2AD2`.

---

# Fin de session du 16/11/2026 (soir) — état et reprise

## Fait (vérifié)
- **Panneau vélo en direct codé et déployé** (commits `d9642cc`, `609ee55` ; vérifié en ligne par `curl` sur `app.js`) : modal Sport → Vélo → « Kcal machine » → bouton **Connecter le vélo** → watts, kcal corrigées, écoulé/restant (min), km, km/h, pouls, kcal « effort seul », durée cible mémorisée (`bt_bike_target_min`). Fin : « Terminer » / 30 s sans pédaler / déconnexion (aucun paquet 10 s) / fermeture du modal. Enregistrement auto de l'entrée + ligne `bike_sessions` + événement Agenda, bouton « Annuler l'enregistrement », brouillon local toutes les 10 s (`bt_bike_live_draft`). Séance < 30 s ou 0 kcal : non enregistrée (**seuil ajouté par moi, non validé**). Parseur FTMS testé sur paquets synthétiques (résistance 1 ou 2 octets). `node verify.js` OK.
- **Supabase** : colonne `bike_sessions.wall_s` ajoutée (migration `bike_sessions_add_wall_s`) ; table `google_tokens` recréée (RLS, 0 policy, aucun droit anon/authenticated) ; Edge Functions `gcal-connect` et `gcal-token` déployées (v1, `verify_jwt` = true, 401 sans session vérifié), sources dans `supabase/functions/`.
- **Google Agenda sans fenêtre** : `gcalPreAuth()` essaie dans l'ordre jeton serveur (`gcal-token`) → renouvellement silencieux (`prompt:'none'`) → fenêtre. Bouton « Connecter Google Agenda (une fois) » dans Réglages : **fait, ligne `google_tokens` présente** (jeton non vide, portée `calendar.events`, 16/11 10:43 Paris). Écran de consentement Google passé **« En production »** (vérifié) → le jeton durable n'expire plus à 7 jours. Secrets `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` déjà présents dans Supabase (créés le 01/05/2026 pour l'ancienne synchro Fit).

## Découvertes
- Le vélo (auto-alimenté) **s'éteint dès qu'on arrête de pédaler** et n'est alors plus visible en Bluetooth : il faut **pédaler avant d'appuyer sur « Connecter le vélo »**. Les compteurs console sont cumulés depuis son réveil → une connexion tardive ne perd rien.
- **Brave Android n'a pas `navigator.bluetooth.getDevices`** (vérifié par CDP) : pas de reconnexion automatique possible, tap sur « Connecter le vélo » à chaque séance (j'avais codé une reconnexion auto, retirée dans `609ee55`). Piste non essayée : réglage dans `brave://flags`.
- Constaté par ADB/CDP (16/11, 10:48) : panneau bloqué sur « Connexion… », 0 paquet, fenêtre Bluetooth ouverte sans vélo (il dormait). Corrigé : message « pédale d'abord », filet 90 s.
- Correction mémorisée sur le téléphone = **−20 %** (`bt_bike_correction`), pas −25 % : l'entrée manuelle du 16/11 (id 3835, 306 kcal console → 245) est à −20 %. Le défaut du code reste 25 (autres appareils). Décision utilisateur : garder 20 %.
- Google ne réaffiche plus un secret client ; **max 2 secrets par client** (le client « LeGrosBarbu Web » en a 2 : `****X5u3` 27/04 et `****2MbK` 01/05). Le secret Supabase date du 01/05 → correspond très probablement à `****2MbK` : **ne pas supprimer ce secret dans Google** sans en recoller un nouveau dans Supabase (sinon `gcal-token`/`gcal-connect` cassent).
- Entrée vélo du 16/11 (id 3835) : saisie manuelle (aucune ligne `bike_sessions`, pas de durée dans le texte).

## Backlog
**À faire**
1. **Test réel du panneau** sur une vraie séance : pédaler → Connecter le vélo → choisir le vélo → comparer écran console / panneau → Terminer → vérifier `bike_sessions` (couverture, avg_w, wall_s) et l'entrée. Rien n'a encore été reçu du vélo par l'app (0 paquet).
2. Vérifier que l'événement **Agenda se crée sans que Google redemande** (`gcal-token` jamais encore appelé en vrai).
3. Tester le cas **vélo éteint en pleine séance** (fin « disconnect » attendue ≤ 10 s) et la reprise de brouillon.
4. Vérification live Brave complète (hard reload / SW) — seul le fichier servi a été contrôlé, pas le rendu.
**À décider**
- Seuil « séance < 30 s non enregistrée » (mon ajout) ; défaut de correction 25 → 20 dans le code ?
- Calcul personnalisé Mifflin-St Jeor (en attente, voir plus haut) ; correction −25/−20 % : brut ou net (voir « Correction −25 % »).
- Piste flag Brave pour `getDevices` (reconnexion auto).
**Plus tard**
- Test Kinomap → Health Connect (droits d'écriture Kinomap = 0) ; essai Kinomap jusqu'au ~10/12/2026, rien à payer.
- Mettre à jour `PRODUCT.md` / changelog daté si la fonction est jugée stable.

## Phrase de reprise
« Reprends `VELO_EB520B_SUIVI.md` (section Fin de session du 16/11/2026) : je vais faire une vraie séance, teste le panneau vélo avec moi (je pédale, Connecter le vélo, Terminer), compare avec la console et vérifie `bike_sessions` et l'agenda. »
