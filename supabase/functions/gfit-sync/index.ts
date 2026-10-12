// Désactivée le 12/10/2026 : sync Google Fit retirée (API dépréciée), remplacée par hc-webhook.
// Version déployée (v14, verify_jwt = true) — l'ancien code (v13) est dans l'historique git.
Deno.serve(() => new Response(JSON.stringify({ error: "gone" }), { status: 410, headers: { "Content-Type": "application/json" } }));
