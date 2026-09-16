# Changelog — Session du 16/09/2026

Trois correctifs (assistant IA ×2, navigation formulaire Sport) sur `app.js`/`index.html`/
`index-complet.html`, chacun vérifié en direct sur le site déployé après un vrai
hard-reload (Ctrl+Shift+R + désenregistrement du service worker + purge des caches — voir
piège rencontré au point 3), plus deux réponses factuelles à l'utilisateur sans changement
de code.

## 1. Modèles Gemini dépréciés (`gemini-2.0-flash` retiré par Google)

**Symptôme remonté par l'utilisateur** : erreur "model gemini-2.0-flash no longer
available" lors de l'usage de l'assistant IA.

**Cause** : `GEMINI_MODELS` (deux occurrences : `callGemini()` pour le chat texte, et le
bloc équivalent dans `askAIWithPhoto()`) listait des noms de version figés
(`gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`). Google déprécie ces
identifiants régulièrement (2.0 déjà mort au 01/06/2026, 2.5 meurt le 16/10/2026) — le
fallback en cascade ne se déclenchait que sur surcharge (503/"high demand"), pas sur un
modèle simplement retiré, donc l'erreur remontait telle quelle dès que le dernier modèle de
la liste devenait invalide.

**Fix** : remplacement par les alias `-latest` officiels de Google
(`gemini-flash-latest`, `gemini-flash-lite-latest`), qui pointent toujours vers la version
courante et suivent les dépréciations automatiquement (préavis de 2 semaines par email en
cas de changement cassant, d'après la doc Google) — évite de refaire ce fix à chaque
retrait de modèle.

**Vérifié en direct** : requête test envoyée depuis l'app déployée ("1 pomme" → réponse
Gemini correcte, 78 kcal), entrée de test retirée après coup.

## 2. Assistant IA + photo : le texte tapé était ignoré

**Remonté par l'utilisateur** : en tapant une précision dans le champ de l'assistant avant
d'envoyer une photo (ex. "c'est un bol de porridge à l'avoine avec des myrtilles"), ce
texte n'était jamais pris en compte par l'IA.

**Cause** : `askAIWithPhoto()` envoyait toujours le même prompt fixe
("Analyse cette photo et estime les calories.") sans jamais lire `#ai-input`, contrairement
à `askAI()` (mode texte seul) qui lit bien ce champ.

**Fix** : lecture de `#ai-input` en début de fonction ; si non vide, le texte est ajouté au
prompt envoyé à Gemini ("Precision de l'utilisateur : ...") et affiché dans le journal de
conversation ("📷 Photo envoyée — ..."), puis le champ est vidé via `clearAIInput()` (déjà
utilisé par `askAI()`).

**Vérifié en direct** : requête avec image + note "TEST_NOTE_ABC" interceptée côté réseau —
le corps de la requête envoyée à Gemini contenait bien la note, et le journal de
conversation l'affichait.

## 3. Piège redécouvert : cache HTTP vs Service Worker (deux couches distinctes)

En testant le point 2, un premier test montrait le texte toujours absent malgré un
Ctrl+Shift+R. Cause : `caches.delete()` (Cache Storage du service worker) ne vide **pas**
le cache HTTP disque du navigateur (`Cache-Control: max-age=600` servi par GitHub Pages) —
les deux sont des couches de cache séparées. Un onglet où le service worker avait déjà été
désenregistré a quand même continué à servir un `app.js` d'il y a plusieurs minutes via un
simple `navigate()` (sans hard-reload), le cache HTTP disque n'étant pas concerné par le
nettoyage du service worker. Seul un vrai Ctrl+Shift+R **après** avoir désenregistré le
service worker a fini par charger la version fraîche (confirmé en comparant la longueur de
`askAIWithPhoto.toString()` avant/après : 5014 caractères obsolètes vs 5284 frais).
À garder en tête pour les prochaines vérifications live : `caches.delete()` seul ne suffit
pas à garantir la fraîcheur, il faut aussi le hard-reload navigateur.

## 4. Formulaire Sport : pas de moyen de revenir en arrière (Itinéraire/Vélo → choix)

**Remonté par l'utilisateur** : en cliquant par mégarde sur "Itinéraire" (ou "Vélo") depuis
le choix d'activité sportive, aucun moyen de revenir à cet écran de choix sans fermer toute
la fiche "Ajouter" (× ou "Fermer") et rouvrir.

**Fix** : nouvelle fonction `backToSportPicker()` (masque `#walk-advanced`/`#bike-advanced`/
`#bike-mode-tabs`, ré-affiche le picker via `showAllSports()`), reliée à un bouton
"← Retour" ajouté en haut du formulaire Itinéraire/Simple (statique, `index.html`) et en
haut du formulaire Vélo (injecté dans `renderBikeFavsInModal()`, seul point d'entrée qui
reconstruit `#bike-advanced` en `innerHTML`).

**Vérifié en direct** : depuis "Itinéraire" et depuis "Vélo", le bouton "← Retour" ramène
bien au choix Vélo/Itinéraire/Simple, sans fermer la fiche "Ajouter".

## Réponses sans changement de code

- **Retour arrière sur le formulaire Sport (mobile)** : pas de flèche "retour" dédiée.
  Onglets "Simple"/"Itinéraire" en haut du formulaire pour changer de mode sans perdre les
  données ; bouton × ou "Fermer" pour quitter tout l'écran "Ajouter" sans enregistrer.
- **Message "automatisation n8n" affiché lors d'une sync vélo → Google Fit** : aucune
  occurrence de "n8n" dans le code de ce projet (`app.js`, `index.html`) — la sync appelle
  directement l'API Google Fit, rien côté app ne référence n8n. Le message vient très
  probablement d'un workflow n8n externe (autre projet du dossier `IA - Automatisations`)
  qui écoute les changements Google Fit/Health Connect sur le téléphone.
