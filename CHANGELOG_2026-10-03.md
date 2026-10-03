# Changelog — Session du 03/10/2026

Une demande de l'utilisateur : en mode vélo « Kcal machine », la durée était toujours
préremplie à 40 min. Il ne voulait rien voir par défaut, et pouvoir l'ajouter s'il le souhaite.

Commit : `c26b283`.

## 1. Durée optionnelle pour le vélo en mode « Kcal machine »

**Constat** : `selectBikeMode()` mettait `#in-qty` à `40`, aussi en mode « Kcal machine »
(mode par défaut à l'ouverture du vélo). Cette durée inventée se retrouvait dans le libellé
de l'entrée (`🚴 Vélo (40min · …kcal machine → …kcal ajusté)`) et dans l'événement Google
Agenda. À l'édition d'une entrée, `editEntry()` remettait la durée Sport par défaut (30 min)
si le libellé n'en contenait pas.

**Diagnostic** : en mode machine, la durée ne sert à rien dans le calcul. Le total passait
par `bikeMachineKcalPerHour × durée / 60`, ce qui revient aux kcal machine corrigées, mais
il fallait une durée > 0 pour obtenir un résultat (sinon 0 kcal, et `submitEntry()` refusait
d'enregistrer avec « Indique une quantité ou une durée »).

**Fix** (`c26b283`) :
- Nouveau helper `getBikeMachineAdjustedKcal()` (kcal machine × (1 − correction %)). En mode
  machine, `recalc()` et `submitEntry()` l'utilisent directement comme total, sans passer par
  la durée.
- `selectBikeMode()` laisse `#in-qty` vide. `setBikeMode()` change le libellé en
  « Durée (min) · optionnel » et met le placeholder « Optionnel » en mode machine. En mode
  Vitesse, il remet 40 min si le champ est vide (la durée y reste indispensable au calcul).
- `submitEntry()` : la durée n'est plus exigée en mode machine. Les kcal machine le sont
  (toast « Indique les kcal affichées sur le vélo. »). Libellé sans durée :
  `🚴 Vélo (400kcal machine → 320kcal ajusté)`. Avec une durée : inchangé.
- `calc-sub` : le kcal/h n'est affiché que si une durée est saisie.
- `editEntry()` : une entrée machine sans « Xmin » dans son libellé rouvre avec la durée vide.
- `addBikeToGoogleCalendar()` : description `320 kcal` au lieu de `0 min · 320 kcal` quand la
  durée est vide. L'événement a alors une durée nulle (début = fin).
- Le placeholder de `#in-qty` est remis à vide dans `resetModalForm()` et `selectWalkMode()`.

**Vérification live** (hard reload, après la fin du déploiement Pages) : champ vide et
libellé « optionnel » à l'ouverture. Avec 400 kcal et une correction de 20 %, le total
est de 320 kcal, que la durée soit vide ou à 50 min (et 384 kcal/h affichés avec 50 min).
Le retour au mode Vitesse remet 40 min.
Non testé : l'enregistrement réel d'une entrée et la création de l'événement Google Agenda,
pour ne pas écrire dans le journal.
