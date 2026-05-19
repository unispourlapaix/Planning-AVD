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
