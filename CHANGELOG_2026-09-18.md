# Changelog — Session du 18/09/2026

Trois correctifs sur `app.js`/`index.html`/`index-complet.html`/`sw.js`, chacun vérifié en
direct sur le site déployé (navigation normale + contrôle du service worker confirmé, pas
un simple hard-reload — voir piège découvert au point 2), plus un ajustement UX demandé par
l'utilisateur en cours de session.

## 1. Assistant IA bloqué sur "analyse en cours" (`gemini-flash-latest` qui ne répond jamais)

**Symptôme remonté par l'utilisateur** : depuis la veille, ajouter un repas en le décrivant
à l'IA (texte ou photo) restait très longtemps sur "analyse en cours".

**Cause** : `gemini-flash-latest` (premier modèle essayé dans `GEMINI_MODELS`, texte et
photo) restait bloqué sans jamais répondre ni renvoyer d'erreur HTTP explicite — testé en
direct : requête identique à celle de l'app toujours "pending" après plus d'une minute,
alors que `gemini-flash-lite-latest` répondait en moins d'1s. Le mécanisme de repli
existant ne se déclenchait que sur une erreur 503/surcharge, jamais sur un simple silence
réseau, donc l'app attendait indéfiniment.

**Fix** : timeout de 6s (`AbortController`) sur chaque appel Gemini (`callGemini()` pour le
texte, bloc équivalent dans `askAIWithPhoto()`) — au-delà, bascule automatique sur le
modèle suivant de `GEMINI_MODELS`, comme pour une surcharge classique. Durée choisie après
retour utilisateur (12s jugé trop long vu que le modèle de repli répond de façon fiable en
moins d'1s).

**Vérifié en direct** : navigateur (fetch direct comparant les deux modèles) puis test réel
sur le Pixel 8 via ADB (PWA LeGrosBarbu sous Brave) — repas décrit ("deux oeufs au plat et
une tranche de pain") analysé en ~8-10s terminal-à-terminal au lieu d'un blocage
indéfini ; entrée de test non enregistrée dans le vrai journal.

## 2. Service worker : `app.js` périmé resservi malgré un hard-reload

**Découvert en vérifiant le point 1** : le site déployé continuait à servir un `app.js`
d'avant le dernier push malgré un vrai Ctrl+Shift+R.

**Cause** : `sw.js` faisait `fetch(e.request)` dans son handler `fetch` — un fetch normal,
qui respecte le cache HTTP du navigateur. GitHub Pages sert `Cache-Control: max-age=600` :
pendant les 10 minutes suivant un déploiement, ce fetch pouvait être satisfait par le cache
HTTP local sans jamais toucher le réseau, malgré la logique "network-first" du SW (qui ne
s'appliquait qu'à son propre Cache Storage, pas au cache HTTP du navigateur).

**Fix** : `fetch(e.request, { cache: 'reload' })` — force l'ignorance du cache HTTP local à
chaque requête, tout en le rafraîchissant au passage.

**Piège découvert pendant la vérification, documenté dans `CLAUDE.md`** : un hard-reload
peut laisser `navigator.serviceWorker.controller` à `null` (Chrome bypass le SW pour cette
navigation précise) — tester uniquement via hard-reload ne vérifie donc pas le vrai
comportement du service worker. Méthode fiable : naviguer normalement après le
hard-reload/désenregistrement initial, vérifier que `controller` n'est pas `null`, puis
contrôler que l'en-tête `date` de la réponse colle à l'heure réelle à chaque requête répétée
(le `transferSize` de la Resource Timing API s'est révélé peu fiable pour ce diagnostic
précis en présence d'un service worker).

**Vérifié en direct** : sous contrôle réel du nouveau SW, 3 requêtes successives vers
`app.js` (espacées de ~1,5s) montrent un en-tête `date` qui suit l'heure réelle à chaque
fois — confirmation qu'un vrai aller-retour réseau a lieu, plus de contenu périmé.

## 3. UX Assistant IA — trois ajustements demandés en cours de session

- **Entrée fait un retour à la ligne** au lieu de valider immédiatement l'envoi (gênant sur
  clavier mobile) : suppression du `onkeydown` qui interceptait `Enter` sur `#ai-input`
  (`index.html` + `index-complet.html`) ; l'envoi reste sur le bouton flèche.
- **`gemini-flash-lite-latest` en premier** dans `GEMINI_MODELS` (texte et photo),
  `gemini-flash-latest` en repli — le premier est actuellement instable côté Google (voir
  point 1), le second répond de façon fiable et avec une qualité d'estimation correcte.
- **Message "Toujours en cours…"** affiché après 3s d'attente pendant l'analyse (nouvelles
  fonctions `showAILoading()`/`hideAILoading()`), pour que le spinner ne paraisse pas figé
  pendant le timeout de 6s.

**Vérifié en direct** : dans le DOM de la page déployée, `#ai-input` n'a plus d'attribut
`onkeydown` ; frappe testée directement (`"test ligne 1\nligne 2"` dans `.value` après un
Entrée en cours de saisie) ; envoi testé avec bascule sur le modèle lite confirmée par une
réponse quasi instantanée.
