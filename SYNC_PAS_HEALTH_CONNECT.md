# Synchro des pas — Health Connect → LeGrosBarbu

Mise en place le 12/10/2026. Remplace l'ancienne sync Google Fit (API Fit dépréciée par Google,
arrêt annoncé courant 2026). Historique détaillé : `CHANGELOG_2026-10-12.md`.

## Chaîne complète

```
Google Fit (app, Pixel 8)          compte les pas avec les capteurs du téléphone
        │ écrit
        ▼
Health Connect (Android)           coffre santé local du téléphone (Pas, Distance)
        │ lu toutes les 60 min
        ▼
HC Webhook (app Android)           envoie le total du jour en JSON (POST + en-tête x-api-key)
        │
        ▼
Edge Function Supabase hc-webhook  calcule les kcal, crée/met à jour l'entrée du jour
        │
        ▼
Table entries → journal LeGrosBarbu   « 🚶 Marche du jour (N pas · X km comptés sur Y) »
```

Seule **Google Fit** écrit des pas/distances dans Health Connect sur le Pixel. Elle n'y écrit
**aucune séance « Exercice »** (vérifié le 12/10/2026). Les pas sont comptés par les capteurs de
mouvement (position Fit = « pendant l'utilisation » seulement) ; la distance est une estimation
pas × foulée (≈ 0,65-0,70 m, taille 183 cm dans le profil Fit).

Depuis la **v8** (12/10/2026), HC Webhook envoie les **intervalles bruts** (résolution
« Complet », ≈ 1 min chacun), stockés dans `hc_samples`.

## Calcul des calories

Objectif (demande de l'utilisateur) : ne compter que les **vraies marches**, pas les pas dispersés
à la maison. Pour chaque jour (heure de Paris), à partir de tous les intervalles stockés :

```
1. pas et mètres répartis minute par minute
2. minute « en marche » si ≥ 60 pas (MIN_CADENCE)
3. séquence = minutes en marche consécutives, 1 min de trou tolérée (MAX_GAP_MIN),
   gardée si ≥ 5 min en marche (MIN_BOUT_MIN)
4. par séquence : vitesse = km / durée ; kcal = (MET(vitesse) − 1) × poids × durée
5. km comptés = km des séquences − km des marches saisies à la main (kcal au prorata)
```

| Élément | Valeur | Pourquoi |
|---|---|---|
| Base sédentaire | aucune (retirée en v7) | Remplacée par le filtre par séquence (v8). |
| Seuils | 60 pas/min, 5 min, 1 min de trou | Seuils de départ, à ajuster selon le journal. |
| Vitesse | réelle, par séquence | Plus d'allure fixe (v6 : 5,5 km/h). |
| Coût net | MET(vitesse) − 1 | On retire le repos (déjà compté dans le BMR). Même courbe MET que l'app (Compendium 2011). |
| Poids | dernier poids pesé (`weight_entries`), sinon profil, sinon 75 kg | |
| Garde-fou | intervalle > 3 h ignoré | Un agrégat (ex. résolution « Quotidien ») fausserait la détection. |

- Entrée **supprimée** si le résultat tombe sous 10 kcal (pas de « −0 ») ; elle revient si ça change.
- Les **7 derniers jours** sont recalculés à chaque synchro : une marche saisie après coup est
  déduite à la synchro suivante (≤ 1 h).
- Le détail du calcul est dans la **fiche de l'entrée** (note après `||`) : nombre de séquences,
  minutes, km, vitesse moyenne, km saisis, total de la journée.
- ⚠️ La distance Fit semble courte (foulée ≈ 0,65-0,70 m) → vitesses calculées de 3,4 à 4,4 km/h
  au lieu des ~5,5 annoncés. Test de calibration prévu (trajet de distance connue) avant toute
  correction.

Pour changer un réglage : modifier la constante en tête de
`supabase/functions/hc-webhook/index.ts`, redéployer la fonction (MCP Supabase
`deploy_edge_function`, `verify_jwt = false`), puis lancer une synchro.

## Réglages HC Webhook (téléphone)

- Types de données : **Pas** + **Distance**, résolution **Complet** (depuis la v8 — ne pas repasser en Quotidien).
- Webhook : `https://zlbwoxsmmdytoucgyhmc.supabase.co/functions/v1/hc-webhook`, format JSON,
  en-tête `x-api-key` (voir Sécurité).
- Synchro : **Intervalle 60 min** ; autorisation Health Connect en arrière-plan accordée ; app
  exclue de l'optimisation batterie.
- Synchro forcée : onglet **Maison → Synchroniser maintenant** (puis confirmer).
- ⚠️ Ne **pas** utiliser « Tester le Webhook » : envoie des données fictives qui créeraient une
  fausse entrée de marche.

## Sécurité

- La clé `x-api-key` n'existe **que** dans la config de HC Webhook sur le téléphone. Supabase ne
  stocke que son empreinte SHA-256 (`hc_webhook_keys.api_key_hash`). Elle n'est ni dans le repo,
  ni dans une conversation.
- Pour la changer : générer une clé localement (sans l'afficher), écrire son SHA-256 dans
  `hc_webhook_keys`, la taper dans l'app via ADB (`adb shell input text "$(cat fichier)"`), puis
  supprimer le fichier local.

## Données côté Supabase

| Table | Contenu |
|---|---|
| `hc_samples` | user_id, kind (`steps`/`distance`), start_time, end_time, value — intervalles bruts (synchro incrémentale : tout est stocké, le calcul relit la table). |
| `hc_daily` | user_id, date, steps, meters — totaux du jour recalculés depuis `hc_samples` (information). |
| `hc_webhook_keys` | user_id, api_key_hash |
| `entries` | une entrée par jour, repérée par le tag `hc:daily-AAAA-MM-JJ` dans la note |

RLS activée sans policy sur `hc_daily` / `hc_webhook_keys` (accès service role uniquement).

## Côté app LeGrosBarbu

- Le journal se **recharge automatiquement** au retour au premier plan après > 30 s d'absence
  (Android suspend le Realtime en arrière-plan). Plus besoin du bouton 🔄.
- Plus aucun code Google Fit dans l'app. Les fonctions `gfit-sync` / `gfit-callback` sont
  neutralisées (410, JWT requis) mais pas supprimées (impossible via le MCP Supabase).

## Dépannage

| Symptôme | Vérifier |
|---|---|
| Pas d'entrée « Marche du jour » | HC Webhook → Journaux : dernier envoi en **200** ? Moins de 10 kcal comptés (aucune séquence ≥ 5 min, ou marches saisies qui couvrent tout) ? Détail : requête sur `hc_samples` du jour. |
| 401 dans les Journaux | Clé `x-api-key` absente/incorrecte dans l'app. |
| 500 dans les Journaux | Logs de la fonction : Supabase → Edge Functions → hc-webhook → Logs. |
| Pas de synchro automatique | Autorisation arrière-plan Health Connect, optimisation batterie, intervalle enregistré. |
| Marche saisie non déduite | Attendre la synchro suivante (≤ 1 h) ou forcer ; la marche doit contenir « 🚶 » ou « marche » et une distance en km. |

## Pistes non retenues (pour mémoire)

- **Séances « Exercice »** pour avoir la vitesse réelle de chaque marche : Google Fit n'en écrit
  pas dans Health Connect.
- **Vitesse minute par minute** : mise en place en v8 (12/10/2026).
