const taskCollection = db => db.collection("planning-avd-tasks");

const priorityRank = { urgent: 0, important: 1, normal: 2 };

const sortTasks = tasks => tasks.sort((a, b) =>
  Number(a.completed) - Number(b.completed)
  || (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2)
  || Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0));

export function subscribeTasks({ db, user, onChange, onError }) {
  if (!db || !user?.uid) return () => {};
  return taskCollection(db)
    .orderBy("createdAt", "desc")
    .limit(200)
    .onSnapshot(snapshot => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onChange?.(sortTasks(tasks));
    }, error => onError?.(error));
}

export async function createTask({ db, user, title, priority }) {
  const cleanTitle = String(title || "").trim().slice(0, 160);
  if (!db || !user?.uid || !user?.email) throw new Error("Connexion necessaire.");
  if (!cleanTitle) throw new Error("Ecrivez la tache a ajouter.");
  const allowedPriorities = ["normal", "important", "urgent"];
  const cleanPriority = allowedPriorities.includes(priority) ? priority : "normal";

  await taskCollection(db).add({
    title: cleanTitle,
    priority: cleanPriority,
    completed: false,
    createdByUid: user.uid,
    createdByEmail: String(user.email).trim().toLowerCase(),
    createdByName: String(user.displayName || user.email).trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function setTaskCompleted({ db, user, task, completed }) {
  if (!db || !user?.uid || !task?.id) throw new Error("Tache introuvable.");
  await taskCollection(db).doc(task.id).update({
    completed: !!completed,
    completedBy: String(user.email || "").trim().toLowerCase(),
    completedAt: completed ? firebase.firestore.FieldValue.serverTimestamp() : null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

export async function deleteTask({ db, user, task }) {
  if (!db || !user?.uid || !task?.id) throw new Error("Tache introuvable.");
  await taskCollection(db).doc(task.id).delete();
}
