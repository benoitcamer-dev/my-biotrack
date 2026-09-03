# Changelog — Session du 31/08/2026

## ⚠️ Scopes Google Fit retirés du projet Cloud partagé avec PESTEL

Dans le cadre d'un chantier sur le projet PESTEL (sortie de l'app OAuth Gmail
`n8n-sheets-agent` du statut "Test", pour éviter l'expiration hebdomadaire du
refresh token), Google a exigé la suppression de tout scope non justifiable
pour un usage externe avant de pouvoir valider les scopes Gmail restreints.
Les scopes suivants, configurés sur l'écran de consentement OAuth du projet
**partagé** `n8n-sheets-agent-474709`, ont été supprimés le 31/08/2026 :

- `https://www.googleapis.com/auth/fitness.activity.read`
- `https://www.googleapis.com/auth/fitness.location.read`

**Confirmé par l'utilisateur avant suppression** : ces scopes ne sont plus
utilisés par LeGrosBarbu (Google Fit n'est pas en usage actif) — voir
`PROJECT_BRIEF.md` §Stack technique, qui listait "Google Fit / Google Calendar
(sync sport, OAuth via une Edge Function Supabase)" comme intégration
optionnelle.

**Conséquence concrète** : si un jour tu veux réactiver la sync Google Fit
côté LeGrosBarbu, il faudra recréer ces deux scopes sur l'écran de
consentement OAuth du projet Google Cloud `n8n-sheets-agent-474709`
(Google Auth Platform → Accès aux données) avant que l'Edge Function Supabase
concernée puisse redemander cette autorisation à Google.

**Pourquoi supprimés là plutôt qu'ailleurs** : le client OAuth "LeGrosBarbu
Web" et le client "PESTEL n8n Gmail" partagent le **même** projet Google
Cloud (`n8n-sheets-agent-474709`, découvert le 31/08/2026 lors du chantier
PESTEL — contrairement à ce que documentait un temps
`securite_cles_credentials.md`, ce n'est pas 2 projets séparés mais 2 clients
distincts dans un seul projet). L'écran de consentement OAuth — et donc la
liste des scopes déclarés — est une ressource de projet, pas de client :
retirer un scope inutilisé y est donc visible des deux côtés.
