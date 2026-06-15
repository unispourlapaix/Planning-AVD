# Configuration Firebase Planning-AVD

## Activer le compte administrateur

1. Connectez-vous une première fois dans l'application avec le compte Google admin.
2. Dans Firebase Console, ouvrez Firestore Database.
3. Créez la collection `planning-avd-admins`.
4. Ajoutez un document dont l'identifiant est l'UID Firebase du compte admin.
5. Ajoutez le champ `email` avec l'adresse email admin.

L'UID est visible dans Firebase Console, rubrique Authentication, liste des utilisateurs.

## Publier les règles Firestore

Les règles à utiliser sont dans `firestore.rules`.

Depuis Firebase Console :

1. Ouvrez Firestore Database.
2. Ouvrez l'onglet Règles.
3. Remplacez le contenu par celui du fichier `firestore.rules`.
4. Cliquez sur Publier.

## Utilisation

1. L'admin renseigne l'email Google de chaque auxiliaire dans Réglages.
2. L'admin prépare le mois puis clique sur Publier.
3. L'auxiliaire se connecte avec son propre compte Google.
4. Il voit uniquement son planning personnel publié.
5. S'il veut échanger un créneau, il clique sur le créneau et envoie une demande.
6. L'admin valide ou refuse la demande dans l'application. Une validation applique le changement et republie le planning.
