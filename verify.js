#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Script de vérification pré-commit, sans dépendance (juste `node verify.js`).
//
// Pas une vraie suite de tests (le code n'est pas structuré en modules
// exportables, et ajouter un framework de test irait à l'encontre du choix
// délibéré "aucun build, pas de package.json" du projet — voir PROJECT_BRIEF.md).
// À la place : formalise les vérifications faites à la main avant chaque
// commit tout au long de la session du 15-16/08/2026 (syntaxe JS, équilibrage
// HTML/CSS, synchronisation du bundle index-complet.html avec les fichiers
// séparés) pour qu'elles soient rejouables en une commande plutôt que
// ré-improvisées à chaque fois.
//
// Usage : node verify.js
// Code de sortie 0 si tout passe, 1 sinon (utilisable dans un hook git ou CI).
// ─────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const { execFileSync } = require('child_process');

let failed = false;
function ok(label) { console.log('  OK  ' + label); }
function fail(label, detail) { console.log('FAIL  ' + label + (detail ? '\n      ' + detail : '')); failed = true; }

function readIfExists(path) {
  try { return fs.readFileSync(path, 'utf-8'); } catch { return null; }
}

// ── 1. Syntaxe JS de app.js ─────────────────────────────────────────────
(function checkAppJsSyntax() {
  try {
    execFileSync(process.execPath, ['--check', 'app.js'], { stdio: 'pipe' });
    ok('app.js : syntaxe valide (node --check)');
  } catch (e) {
    fail('app.js : erreur de syntaxe', e.stderr?.toString() || e.message);
  }
})();

// ── 2. Équilibrage des balises HTML ──────────────────────────────────────
function checkTagBalance(file, tag) {
  const c = readIfExists(file);
  if (c === null) { fail(file + ' : introuvable'); return; }
  const openRe = new RegExp('<' + tag + '(\\s|>)', 'g');
  const closeRe = new RegExp('</' + tag + '>', 'g');
  const open = (c.match(openRe) || []).length;
  const close = (c.match(closeRe) || []).length;
  if (open === close) ok(file + ' : <' + tag + '> équilibrées (' + open + ')');
  else fail(file + ' : <' + tag + '> déséquilibrées', 'ouvertures=' + open + ' fermetures=' + close);
}
checkTagBalance('index.html', 'div');
checkTagBalance('index.html', 'button');
checkTagBalance('index-complet.html', 'div');
checkTagBalance('index-complet.html', 'button');

// ── 3. Équilibrage des accolades CSS ─────────────────────────────────────
function checkBraceBalance(label, css) {
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  if (open === close) ok(label + ' : accolades équilibrées (' + open + ')');
  else fail(label + ' : accolades déséquilibrées', 'ouvertures=' + open + ' fermetures=' + close);
}
const stylesCss = readIfExists('styles.css');
if (stylesCss !== null) checkBraceBalance('styles.css', stylesCss);

// ── 4. index-complet.html synchronisé avec index.html + app.js + styles.css ──
(function checkBundleSync() {
  const indexHtml = readIfExists('index.html');
  const appJs = readIfExists('app.js');
  const css = readIfExists('styles.css');
  const bundle = readIfExists('index-complet.html');
  if (!indexHtml || !appJs || !css || !bundle) { fail('sync bundle : fichier(s) manquant(s)'); return; }

  const styleMatch = bundle.match(/<style>([\s\S]*?)<\/style>/);
  if (!styleMatch) { fail('index-complet.html : bloc <style> introuvable'); }
  else if (styleMatch[1].trim() === css.trim()) ok('index-complet.html <style> == styles.css (byte-identique)');
  else fail('index-complet.html <style> désynchronisé de styles.css', 'régénérer via le pipeline habituel (voir historique du commit 5657bee)');

  const scripts = [...bundle.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const lastScript = scripts[scripts.length - 1];
  if (!lastScript) { fail('index-complet.html : dernier bloc <script> introuvable'); }
  else if (lastScript[1].trim() === appJs.trim()) ok('index-complet.html dernier <script> == app.js (byte-identique)');
  else fail('index-complet.html <script> désynchronisé de app.js', 'régénérer via le pipeline habituel (voir historique du commit 5657bee)');
})();

// ── 5. Classes CSS jamais référencées en HTML/JS (info seulement, ne fait pas échouer) ──
(function checkOrphanCss() {
  const css = readIfExists('styles.css');
  const html = readIfExists('index.html') || '';
  const js = readIfExists('app.js') || '';
  if (!css) return;
  const haystack = html + '\n' + js;
  const classNames = new Set();
  const re = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
  let m;
  while ((m = re.exec(css))) classNames.add(m[1]);
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  const orphans = [];
  for (const cls of classNames) {
    if (cls.startsWith('pac-')) continue; // injectées par Google Places à l'exécution, faux positif connu
    const wordRe = new RegExp('\\b' + escapeRe(cls) + '\\b');
    if (!wordRe.test(haystack)) orphans.push(cls);
  }
  if (orphans.length === 0) ok('styles.css : aucune classe orpheline détectée');
  else console.log('INFO  styles.css : ' + orphans.length + ' classe(s) possiblement orpheline(s) — à vérifier au cas par cas avant suppression\n      ' + orphans.sort().join(', '));
})();

console.log('');
if (failed) { console.log('❌ Vérification échouée.'); process.exit(1); }
else { console.log('✅ Tout est bon.'); process.exit(0); }
