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

Dans le dépôt GitHub:

1. **Settings → Pages**
2. **Build and deployment**: sélectionner **GitHub Actions**
3. Ne pas utiliser "Deploy from a branch" avec les sources `src/*.jsx`

Sinon le navigateur charge `src/main.jsx` (MIME `text/jsx`) et bloque le module.
