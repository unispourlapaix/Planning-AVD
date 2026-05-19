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
