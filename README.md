# Planning AVD (Vite)

## Démarrage local

```bash
npm install
npm run dev
```

## Build production

```bash
npm run build
npm run preview
```

Le build produit des fichiers statiques dans `dist/`.

## GitHub Pages

Cette app **doit** être déployée depuis le dossier `dist/` (build Vite), pas depuis les sources `src/*.jsx`.

Si vous ouvrez `index.html` source directement sans build, le navigateur peut afficher des erreurs JS (imports/JSX non transformés).

Le workflow `.github/workflows/deploy-gh-pages.yml` construit puis publie automatiquement `dist/` sur GitHub Pages.

## Dépannage production

- Si vous voyez une erreur `babel.min.js` ou `import declarations may only appear at top level`, la page servie est une ancienne version CDN/Babel.
- Vérifiez que GitHub Pages publie **le workflow GitHub Actions** (branche `gh-pages` artifact) et non une ancienne racine statique.
- Faites un hard refresh (Ctrl/Cmd+Shift+R) pour vider le cache navigateur/CDN.


## Configuration GitHub Pages (obligatoire)

Pour éviter l’erreur MIME `text/jsx` (module bloqué sur `src/main.jsx`), configurez GitHub Pages **exactement** ainsi :

1. Ouvrez **Settings → Pages** du dépôt.
2. Dans **Build and deployment**, choisissez **Source: GitHub Actions**.
3. Vérifiez que le workflow `Deploy to GitHub Pages` s’exécute et publie `dist/`.
4. **Ne pas** utiliser **Deploy from a branch** avec les sources (`src/*.jsx`).
5. Faites un rechargement forcé du navigateur (`Ctrl+F5` ou `Cmd+Shift+R`) pour vider le cache.

Si vous déployez la branche source au lieu du build `dist/`, le navigateur reçoit `src/main.jsx` en `text/jsx` et bloque le module.


## Erreur 404 + CSP sur `unispourlapaix.github.io/Planning-AVD`

Si vous voyez:
- `GET .../Planning-AVD/ [404]`
- CSP `default-src 'none'`
- favicon bloqué

cela signifie généralement que GitHub renvoie sa **page 404 système** (pas votre app).

Causes fréquentes:
1. Le workflow Pages ne s'est pas déclenché (mauvaise branche).
2. Pages n'est pas configuré sur **GitHub Actions**.
3. Le déploiement a échoué.

Vérifications:
1. `Settings → Pages → Source: GitHub Actions`.
2. Onglet `Actions` : workflow vert sur la branche utilisée (`main`, `master` ou `work`).
3. Ouvrir l'URL fournie par le job `deploy` après succès.

Note: la CSP `default-src 'none'` vient de la page 404 GitHub, pas de votre `index.html`.
