# Changelog — Session du 20/09/2026

Une fonctionnalité demandée par l'utilisateur sur `app.js`/`index-complet.html`, vérifiée en
direct sur le site déployé — avec au passage un piège de timing découvert pendant cette
vérification (à distinguer du piège hard-reload/service-worker déjà documenté dans
`CLAUDE.md`, celui-ci concerne le délai de build/publication de GitHub Pages lui-même).

## Repas composé ajouté par l'IA — lignes d'ingrédients séparées

**Demande initiale** : l'utilisateur ajoute parfois un repas au journal via l'Assistant IA
(ex. "riz, poulet grillé et brocoli") puis voulait pouvoir le transformer en recette. La
fonctionnalité "Lier à une recette" existait déjà (menu du titre de repas dans le journal),
mais un repas composé loggé par l'IA était enregistré comme **une seule ligne agrégée**
(macros totales), pas comme plusieurs ingrédients — la recette créée n'aurait donc eu qu'un
seul "ingrédient" flou représentant tout le repas.

**Fix** : `addAIEntry()` détecte maintenant, via `_parseNoteIngredients()` (déjà utilisée par
ailleurs pour l'affichage du détail d'une entrée), si la note IA contient 2+ ingrédients. Si
oui, insertion d'un titre `📚 <nom du repas>` + une ligne par ingrédient dans le journal —
exactement le même schéma que l'ajout d'une recette existante (`addRecipeToCurrentMeal`) —
au lieu d'une ligne unique. Le poids total reste mis à l'échelle si l'utilisateur modifie la
quantité avant de valider (`ratio = q / somme des quantités des ingrédients de la note`).

**Limite connue, documentée en commentaire dans le code** : la note IA ne donne les macros
(P/G/L) qu'au total du repas, jamais par ingrédient (contrainte du prompt IA lui-même —
"Pas de macros dans la note"). Les macros par ingrédient sont donc réparties
proportionnellement à la part de kcal de chaque ingrédient, seule clé de répartition
disponible — une approximation, pas une valeur mesurée par ingrédient.

**Vérifié en direct** : repas test à trois ingrédients (riz/poulet/brocoli) ajouté via
l'Assistant IA sur le site déployé → confirmé en base (Supabase, requête directe) que le
journal contient bien un titre 📚 + 3 lignes distinctes avec kcal exact par ligne (195 / 396
/ 27, total 618 ≈ 619 affiché) ; confirmé visuellement dans le DOM du journal ; testé
"Lier à une recette" sur ce repas → les 3 ingrédients apparaissent bien séparément dans la
modale de création de recette. Entrées de test supprimées ensuite (le journal réel de
l'utilisateur est revenu exactement à son état d'avant test : mêmes totaux kcal/bilan).

**Piège de timing découvert pendant cette vérification** : un premier hard-reload
(Ctrl+Shift+R) juste après le `git push` a chargé l'**ancien** `app.js` — le hard-reload a
eu lieu avant que GitHub Pages ait fini de builder/publier le nouveau commit, pas à cause
d'un cache navigateur. Un hard-reload garantit de contourner le cache local, mais ne garantit
pas que le serveur ait déjà le nouveau contenu à cet instant précis. Repéré via
`fetch('app.js', {cache:'no-store'})` (le serveur avait déjà le nouveau fichier,
`last-modified` récent) comparé à `addAIEntry.toString()` dans la page (qui tournait encore
sur l'ancien code) — le mismatch venait du timing du push/build, pas du navigateur. Un
second hard-reload quelques instants plus tard a chargé la bonne version. À vérifier
systématiquement après un push tout juste fait : comparer le code réellement exécuté en
mémoire (`maFonction.toString()`) au contenu servi (`fetch(..., {cache:'no-store'})`) plutôt
que de supposer qu'un hard-reload suffit immédiatement après un push.
