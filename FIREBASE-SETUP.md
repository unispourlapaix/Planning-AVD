# Configuration Firebase Planning-AVD

## Activer le compte administrateur

1. Connectez-vous une première fois dans l'application avec le compte Google admin.
2. Dans Firebase Console, ouvrez Firestore Database.
3. Créez la collection `planning-avd-admins`.
4. Ajoutez un document dont l'identifiant est l'UID Firebase du compte admin ou son email en minuscules.
5. Ajoutez les champs :
   - `email` : adresse email admin, type `string`
   - `emailLower` : même adresse en minuscules, type `string`
   - `role` : `admin`, type `string`
   - `active` : `true`, type `boolean`

L'UID est visible dans Firebase Console, rubrique Authentication, liste des utilisateurs.

## Publier les règles Firestore

Les règles à utiliser sont dans `firestore.rules`.

Depuis Firebase Console :

1. Ouvrez Firestore Database.
2. Ouvrez l'onglet Règles.
3. Remplacez le contenu par celui du fichier `firestore.rules`.
4. Cliquez sur Publier.

Important :

- Le premier texte collé doit être exactement `rules_version = '2';`.
- Ne collez jamais seulement un bloc qui commence par `match /...`.
- Si Firebase affiche `Line 1: mismatched input 'match'`, le contenu collé est incomplet : remplacez tout l'onglet Règles par le fichier complet.
- Le fichier complet finit par deux accolades seules : `}` puis `}`.

Fichiers à garder identiques :

- `firestore.rules` à la racine du dossier local.
- `.publish-current/firestore.rules` dans le dossier publié.

## Nouveau bénéficiaire / nouvel admin

Un utilisateur connecté peut créer son propre dossier bénéficiaire depuis l'application avec l'option `Devenir admin d'un nouveau bénéficiaire`.

L'application crée alors le dossier bénéficiaire, l'identifiant unique, le membre admin et la sauvegarde personnelle de départ. L'admin invite ensuite les auxiliaires depuis `Réglages > Membres et rôles`.

Firebase accepte cette création grâce à la collection `planning-avd-admin-bootstraps`. Si cette action affiche `Missing or insufficient permissions`, publiez à nouveau le fichier complet `firestore.rules`.

## Utilisation

1. L'admin renseigne l'email Google de chaque auxiliaire dans Réglages.
2. L'admin prépare le mois puis clique sur Publier.
3. L'auxiliaire se connecte avec son propre compte Google.
4. Il voit uniquement son planning personnel publié.
5. S'il veut échanger un créneau, il clique sur le créneau et envoie une demande.
6. L'admin valide ou refuse la demande dans l'application. Une validation applique le changement et republie le planning.

## Liste de taches partagee

1. Publier `firestore.rules` apres la mise a jour de l'application.
2. L'admin clique une fois sur Sauvegarder pour enregistrer les emails actifs comme membres de l'equipe.
3. Chaque membre connecte peut ajouter une tache, choisir sa priorite et la marquer terminee.
4. Seul l'admin peut supprimer une tache.

## Liste de courses partagee

1. Les cases cochees et les articles ajoutes sont synchronises entre les membres connectes.
2. Sans connexion, la liste reste utilisable et conservee localement sur l'appareil.
