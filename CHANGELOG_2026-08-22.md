# Changelog — Session du 22/08/2026

Audit + corrections sur le journal, les favoris, les recettes et la robustesse concurrence/isolation des données. Fichiers touchés : `app.js`, `index-complet.html` (source de vérité), `styles.css`, `index.html`.

## Bugs corrigés

- **Favoris inactifs depuis la fiche détail d'une entrée du journal** — l'id de l'aliment était injecté sans guillemets dans l'attribut `onclick` (`_toggleFavFromPopup(${matchedFood.id},...)`). Comme `custom_foods.id` est un identifiant texte, ça produisait du JS invalide et le clic ne faisait strictement rien. Corrigé par un guillemetage cohérent avec le reste du code (`'${matchedFood.id}'`).
- **Recherche d'ingrédient inactive dans l'éditeur de recette** (création et modification) — le champ `#re-desc` n'avait aucun `oninput`, contrairement au champ de recherche principal du journal qui filtre en direct avec un debounce de 600 ms. Ajout de `onRecipeSearchInput()` sur le même modèle.
- **Suppression de recette sans confirmation ni annulation possible** — un seul tap détruisait la recette instantanément. Ajout d'une confirmation (`showConfirm`), alignée sur le comportement déjà en place pour les aliments personnalisés.

## Robustesse & isolation des données (multi-utilisateurs)

- Ajout systématique de `.eq('user_id', user.id)` sur une quinzaine de requêtes `UPDATE`/`DELETE` (`entries`, `custom_foods`, `weight_entries`, `favorites`) qui ne filtraient jusque-là que par `id` de ligne. Défense en profondeur : n'importe qui devinant un id ne peut plus modifier/supprimer une ligne d'un autre compte, même en cas de faille de policy RLS côté Supabase.
- Vérifié en conditions réelles (requêtes anonymes en lecture sur `entries`/`custom_foods`/`weight_entries`/`favorites`) : RLS bloque bien tout accès non authentifié — confirmé sain, cette passe consolide le reste.

## Anti double-clic & retours visuels

- Bouton **"Valider"** du journal : passe en `disabled` + "Ajout…" pendant l'envoi, reprend son état initial ensuite (y compris en cas d'erreur), toast de confirmation à la fin.
- Ajout d'un garde anti double-tap (sur le même principe que la validation du journal) sur : sauvegarde d'un aliment personnalisé, sauvegarde d'une recette, ajout/retrait d'un favori depuis la fiche détail. Évite la création de doublons en cas de tap rapide répété.
- Toast de confirmation ajouté après sauvegarde d'une recette.

## Sécurité — injection HTML (XSS stocké)

- Nouvelle fonction `escHtml()` (échappement `&<>"'`), appliquée à l'affichage du nom de repas/aliment dans le journal et dans le titre de la fiche détail — ces deux champs affichaient jusqu'ici du texte libre utilisateur tel quel via `innerHTML`.

## Ergonomie mobile

- Taille du texte principal du journal (`.entry-desc`) : 12px → 14px ; sous-texte (`.entry-sub`) : 11px → 12px. C'est la ligne la plus lue de toute l'app au quotidien.

## Non traité (documenté pour une prochaine passe)

- Cibles tactiles sous 44px : `.entry-action` (36px), `.food-btn` (40px).
- `escHtml()` pas encore appliqué aux noms de recette/aliment dans les listes (moins fréquentés que le journal).
- Architecture mono-fichier (`app.js`, ~6800 lignes) : pas de risque immédiat mais point de vigilance si le projet passe à plusieurs développeurs.

## Désynchronisation dossier local ↔ dépôt distant (découverte + résolue)

Le dossier de travail local (utilisé pour préparer les correctifs ci-dessus) n'était pas un dépôt git et datait du 15/08 — le dépôt GitHub avait continué d'évoluer sans jamais être resynchronisé en local (dernier push le 16/08 : fonctionnalité "Domicile" pour les lieux enregistrés, réordonnancement des étapes d'itinéraire, icônes Lucide sur plusieurs écrans, bannière "nouvelle version disponible" du service worker, `CLAUDE.md`/`verify.js`/`README.md`/`manifest.json`/`sw.js`/icônes absents en local).

Un simple upload des fichiers locaux aurait donc **effacé** tout ce travail distant. À la place :
1. Clone du dépôt distant à part (`gh repo clone`).
2. Chaque correctif de cette session appliqué directement sur le clone, fonction par fonction, en vérifiant à chaque fois que le code environnant correspondait avant de modifier.
3. Vérifications (`node --check`, équilibrage `{}`/`<div>`, puis `node verify.js` une fois découvert) avant chaque commit.
4. Push (`2a9d005`), vérifié en direct sur `raw.githubusercontent.com` et via l'API GitHub Pages (`status: "built"`).
5. `PROJECT_BRIEF.md` local (20 Ko, détaillé) et distant (6 Ko, référençant `CLAUDE.md`/`verify.js`) avaient aussi divergé structurellement — fusionnés en un seul document (`a2be366`), en gardant le détail historique de la version locale et les références de la version distante. `DESIGN.md`/`PRODUCT.md` étaient en fait identiques des deux côtés (juste une différence de fin de ligne CRLF/LF) — rien à fusionner.
6. Dossier local complété avec les fichiers manquants (`CLAUDE.md`, `README.md`, `verify.js`, `manifest.json`, `sw.js`, icônes, `.gitignore`, `_headers`) pour repartir sur une base locale complète et à jour.

**Résolu (suite de session, 22/08/2026)** : `git init` local + `git remote add origin` vers `benoitcamer-dev/my-biotrack` + `git fetch`. Avant tout commit, vérification que le HEAD local retombait exactement sur `origin/main` (`4451b10`, dernier commit distant) — confirmé, aucun écart de contenu. Seuls 3 fichiers `.impeccable/*` (état du skill Impeccable, suivi en remote) manquaient en local : restaurés depuis `origin/main` plutôt que régénérés à la main. Branche `main` locale mise en tracking sur `origin/main`. Le dossier local est désormais un vrai dépôt git synchronisé — cause racine de l'épisode de désync corrigée.

Restent en clutter à la racine, non trackés et non liés à l'app (fichiers de scratch d'une session de debug antérieure au 18/08, jamais nettoyés) : `ACTION_CONFIRMATION.txt`, `ANALYSIS_SUMMARY.txt`, `ACTION_PLAN_debug_optimization.md`, `ok.md` — à supprimer ou trier avec l'utilisateur, pas fait d'office.
