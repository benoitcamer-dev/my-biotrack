# Changelog 21/10/2026

- **Boissons (modale d'ajout)** : la liste `DRINK_DB` (21 boissons) n'est plus affichée d'office (elle prenait ~260 px sans bouton de fermeture) — repliée derrière « Afficher les boissons courantes » (`toggleDrinkList`).
- **Sport** : au-delà de 4 favoris, repliés derrière un bouton (`toggleSportFavs`). Aucun effet en dessous (3 favoris au 21/10).
- **Bug édition boisson en cl** (`editEntry`) : une bière 50 cl rouverte affichait 470 kcal/100 (qty en cl relue comme ml), « Quantité (ml) » et un nom gardant « · 1 pinte » (dupliqué à l'enregistrement, entrée réécrite en « 50ml »). Corrigé : unité cl reconnue, kcal/100 calculées sur la quantité en ml, nom nettoyé, nombre de verres/dose restaurés. « Ajouter aux favoris » depuis une entrée comprend aussi ml/cl.
- **Bière 6°** : 47 → 52 kcal/100 ml (gluc 4.0). Autres bières/vins vérifiés (±2 kcal du calcul alcool + macros), inchangés.
- **Données Supabase corrigées (autorisé par l'utilisateur)** : entrées 637 (bière 6° 3 pintes → « 150cl », kcal_100 47), 249 (vin blanc, qty 600, kcal_100 82), 254 (rhum coca, qty 1800, kcal_100 46). `val` et macros inchangés. Relu après écriture.
