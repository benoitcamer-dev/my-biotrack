# Changelog — Session du 23/08/2026

Audit technique et UX complet (bugs signalés, cohérence du design system, ergonomie mobile) sur le journal, les recettes, le tableau de bord et le menu d'ajout. Fichiers touchés : `app.js`, `index-complet.html` (source de vérité), `styles.css`, `index.html`. Rapport complet (contexte, preuves, code des correctifs) publié en artifact — lien dans l'historique de conversation, non reproduit ici.

## Bugs signalés — déjà résolus, revérifiés en direct

Deux bugs remontés (favoris inactifs depuis le journal, recherche inopérante en modification de recette) correspondaient exactement à deux correctifs déjà livrés lors de la session du 22/08/2026 (commit `2a9d005`). Plutôt que de recorriger du code déjà sain, chacun a été revérifié en conditions réelles sur le site déployé :

- **Favoris** : fiche détail d'une entrée du journal → clic "Ajouter aux favoris" → insertion réelle confirmée dans la table `favorites` (lue via le client Supabase de la page) → UI bascule sur "Retirer des favoris" → retrait fonctionnel. Donnée de test créée puis supprimée immédiatement, aucune trace laissée en base.
- **Recherche recette** : ouverture de "Bœuf bourguignon" en modification → frappe de "poulet" dans le champ ingrédient (`#re-desc`) → liste filtrée en direct (Bouillon poulet maison dégraissé, Blanc de poulet sans peau…). Fermeture sans enregistrer : recette ressortie inchangée.

Aucune régression détectée, aucune action de code nécessaire sur ces deux points. Si le symptôme revient côté utilisateur, la piste la plus probable est un cache HTTP GitHub Pages non purgé (10 min sur les ressources liées) — un vrai hard-reload (Ctrl+Shift+R) permet de trancher.

## Correction d'architecture (précision pour l'audit)

Pas de code React Native/Expo/Flutter/Next.js séparé : LeGrosBarbu est une PWA statique unique (`index.html` + `app.js` + `styles.css`, sans build), déployée telle quelle sur GitHub Pages. La "version mobile" est exactement le même code, rendu en responsive et installable via `manifest.json` + `sw.js`. "Web vs mobile" n'est donc pas un sujet de mutualisation de code (un seul code existe), mais de responsive design et d'ergonomie tactile.

## Cohérence du design system — corrigé

Cinq constats de l'audit UI/UX, chiffrés et vérifiés (code + capture live), corrigés et déployés (commit `2c14cb5`) :

- **Couleur "Protéines" unifiée** — trois couleurs incompatibles coexistaient pour la même macro (violet sur `.macro-pill.prot`, bleu `#7da4ff` sur les badges journal `.meal-macro.p`, vert/teal `#00C896` codé en dur sur la barre du tableau de bord — `app.js:3696`). Tout ramené sur `var(--accent)`/`var(--accent2)`, avec lecture de la variable CSS depuis le JS plutôt qu'une valeur en dur.
- **Menu "+" (FAB)** — les 7 boutons (Petit-déjeuner, Déjeuner, Dîner, Snack, Boissons, Sport, Assistant IA) avaient chacun un fond/bordure d'une couleur saturée différente, en rupture avec "The One Accent Rule" de `DESIGN.md`. Fond et bordure unifiés sur l'accent violet (nouvelles variables `--accent-bg-soft` / `--accent-border-soft`) ; seule l'icône garde une teinte de repère par catégorie.
- **Contraste du texte secondaire (thème sombre)** — `--muted: #6B6B99` sur `--bg: #08080F` donnait un ratio ≈4.0:1, sous le seuil AA (4.5:1) pour ce texte utilisé partout en 9-11px (sous-titres, labels, méta). Passé à `#8886B3` (≈5.8:1), même teinte perçue. Thème clair inchangé (déjà ≈4.6:1, conforme).
- **Cibles tactiles** — `.food-btn` porté de 40px à 44px ; `.weight-entry-edit` reçoit la même zone de tap invisible (`::before{inset:-12px}`) que `.weight-entry-del` juste à côté, qui l'avait déjà (oubli de la passe du 15-16/08).
- **Affordance d'édition des recettes** — une icône crayon apparaît désormais à côté du nom sur les cartes recette cliquables (recherche et liste Recettes), jusqu'ici seul un `cursor:pointer` CSS (invisible au doigt) signalait que le tap ouvrait l'édition.

`index-complet.html` resynchronisé (bloc `<style>` + dernier `<script>`) avec `styles.css`/`app.js` à jour. `node verify.js` : tout au vert. Déployé et vérifié en direct sur le site (hard reload + `fetch(...,{cache:'no-store'})` sur `styles.css` pour écarter tout doute de cache) : barre "Protéines" violette, menu "+" unifié, icône crayon visible sur les cartes recette — tous confirmés en production.

## En attente — décision produit, pas encore traité

- **Densité du tableau de bord** — la carte du jour affiche 8 chiffres (héros, barre calories, 4 stat-boxes, bilan, barre protéines, 2 pastilles macros) avant la moindre ligne du journal, qui n'est pas visible sans scroller sur mobile au premier chargement. Piste proposée : accordéon "Détails" pour les stat-boxes/macros, chiffre héros + barre + bilan visibles d'emblée. Pas implémenté — décision volontairement laissée en suspens (voir avec l'utilisateur après quelques jours d'usage des correctifs ci-dessus).
- **Chiffre héros en rouge plein lors d'un dépassement** ("574 KCAL EN EXCÈS") — déroge à la "Gradient Numeral Rule" documentée dans `DESIGN.md` (chiffres-titres toujours en dégradé). Probablement volontaire (rouge = alerte), mais l'exception n'est nulle part actée dans le document. Faible priorité, non traité.

## Nettoyage du dossier local — rien à faire

Vérification du dossier de travail local (`git status --ignored`) : working tree strictement propre, aucun fichier non suivi et non ignoré. Les 4 fichiers de clutter identifiés lors de la session du 22/08 (`ACTION_CONFIRMATION.txt`, `ANALYSIS_SUMMARY.txt`, `ACTION_PLAN_debug_optimization.md`, `ok.md`) avaient déjà été supprimés à l'époque. Seul `.claude/` est ignoré par git (config locale de l'outil, légitime, pas du clutter applicatif). Aucune suppression nécessaire cette fois.
