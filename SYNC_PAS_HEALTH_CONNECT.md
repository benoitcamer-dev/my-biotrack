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
**aucune séance « Exercice »** (vérifié le 12/10/2026) : on ne dispose donc que de totaux
journaliers, sans durée ni vitesse.

## Calcul des calories

Pour chaque jour (heure de Paris) :

```
km comptés = km du jour (Health Connect)
           − km des marches saisies à la main ce jour-là   (évite le double comptage)
kcal       = poids × km comptés × coût net à 5,5 km/h      (≈ 0,58 kcal/kg/km)
```

| Élément | Valeur | Pourquoi |
|---|---|---|
| Base sédentaire | aucune (retirée le 12/10/2026, v7) | Le × 1,2 du « Métabolisme » couvre déjà la digestion (~10 %) et laisse peu de marge pour la marche : tous les pas comptent. Avant : 3 500 pas déduits. |
| Allure de référence | 5,5 km/h (`WALK_SPEED_KMH`) | Allure habituelle donnée par l'utilisateur. |
| Coût net | (MET(5,5) − 1) / 5,5 ≈ 0,58 kcal/kg/km | On retire le repos (déjà compté dans le BMR). Même courbe MET que l'app (Compendium 2011). |
| Poids | dernier poids pesé (`weight_entries`), sinon profil, sinon 75 kg | |
| Conversion pas → km | foulée réelle du jour (distance / pas), sinon 0,75 m | |

- Entrée **supprimée** si le résultat tombe sous 10 kcal (pas de « −0 ») ; elle revient si les
  pas augmentent.
- Les **7 derniers jours** sont recalculés à chaque synchro : une marche saisie après coup est
  déduite à la synchro suivante (≤ 1 h).
- Le détail du calcul est dans la **fiche de l'entrée** (note après `||`).

Ordre de grandeur : la vitesse joue peu **par km** (5 → 6,5 km/h : +20 % en net), contrairement
aux marches saisies à la main, calculées **par heure** (MET × poids × durée), où elle compte
beaucoup (+42 %).

Pour changer un réglage : modifier la constante en tête de
`supabase/functions/hc-webhook/index.ts`, redéployer la fonction (MCP Supabase
`deploy_edge_function`, `verify_jwt = false`), puis lancer une synchro.

## Réglages HC Webhook (téléphone)

- Types de données : **Pas** + **Distance**, résolution **Quotidien**.
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
| `hc_daily` | user_id, date, steps, meters — on garde le **max** reçu par jour (le jour le plus ancien de la fenêtre de 48 h n'arrive que partiellement). |
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
| Pas d'entrée « Marche du jour » | HC Webhook → Journaux : dernier envoi en **200** ? Moins de 10 kcal comptés (les marches saisies couvrent tout) ? |
| 401 dans les Journaux | Clé `x-api-key` absente/incorrecte dans l'app. |
| 500 dans les Journaux | Logs de la fonction : Supabase → Edge Functions → hc-webhook → Logs. |
| Pas de synchro automatique | Autorisation arrière-plan Health Connect, optimisation batterie, intervalle enregistré. |
| Marche saisie non déduite | Attendre la synchro suivante (≤ 1 h) ou forcer ; la marche doit contenir « 🚶 » ou « marche » et une distance en km. |

## Pistes non retenues (pour mémoire)

- **Séances « Exercice »** pour avoir la vitesse réelle de chaque marche : Google Fit n'en écrit
  pas dans Health Connect.
- **Vitesse minute par minute** (résolution 1 min dans HC Webhook + table des minutes) : faisable,
  écartée pour l'instant (gain de quelques kcal/jour) ; à reconsidérer si l'allure fixe ne suffit pas.
