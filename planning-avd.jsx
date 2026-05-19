const { useMemo, useState } = React;

const initialTasks = [
  { id: 1, title: 'Définir le périmètre du sprint', owner: 'Équipe Produit', status: 'À faire', dueDate: '2026-05-25' },
  { id: 2, title: 'Préparer la maquette de la page planning', owner: 'Équipe Design', status: 'En cours', dueDate: '2026-05-27' },
  { id: 3, title: 'Valider la structure des données', owner: 'Équipe Technique', status: 'Terminé', dueDate: '2026-05-21' },
];

const statusOptions = ['À faire', 'En cours', 'Terminé'];

function PlanningAVDApp() {
  const [tasks, setTasks] = useState(initialTasks);
  const [newTask, setNewTask] = useState({ title: '', owner: '', dueDate: '', status: 'À faire' });

  const stats = useMemo(() => {
    return statusOptions.reduce((acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status).length;
      return acc;
    }, {});
  }, [tasks]);

  const addTask = (event) => {
    event.preventDefault();
    if (!newTask.title.trim() || !newTask.owner.trim() || !newTask.dueDate) return;

    setTasks((prev) => [
      ...prev,
      {
        id: Date.now(),
        ...newTask,
      },
    ]);

    setNewTask({ title: '', owner: '', dueDate: '', status: 'À faire' });
  };

  const updateStatus = (id, status) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status } : task)));
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Planning-AVD</h1>
        <p style={styles.subtitle}>Web app de planification des tâches et suivi d&apos;avancement.</p>
      </header>

      <section style={styles.metrics}>
        {statusOptions.map((status) => (
          <article key={status} style={styles.card}>
            <h2 style={styles.cardTitle}>{status}</h2>
            <p style={styles.cardValue}>{stats[status] ?? 0}</p>
          </article>
        ))}
      </section>

      <section style={styles.formSection}>
        <h2 style={styles.sectionTitle}>Ajouter une tâche</h2>
        <form style={styles.form} onSubmit={addTask}>
          <input
            style={styles.input}
            placeholder="Titre"
            value={newTask.title}
            onChange={(event) => setNewTask((prev) => ({ ...prev, title: event.target.value }))}
          />
          <input
            style={styles.input}
            placeholder="Responsable"
            value={newTask.owner}
            onChange={(event) => setNewTask((prev) => ({ ...prev, owner: event.target.value }))}
          />
          <input
            style={styles.input}
            type="date"
            value={newTask.dueDate}
            onChange={(event) => setNewTask((prev) => ({ ...prev, dueDate: event.target.value }))}
          />
          <select
            style={styles.input}
            value={newTask.status}
            onChange={(event) => setNewTask((prev) => ({ ...prev, status: event.target.value }))}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button style={styles.button} type="submit">
            Ajouter
          </button>
        </form>
      </section>

      <section>
        <h2 style={styles.sectionTitle}>Backlog</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Tâche</th>
              <th style={styles.th}>Responsable</th>
              <th style={styles.th}>Échéance</th>
              <th style={styles.th}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td style={styles.td}>{task.title}</td>
                <td style={styles.td}>{task.owner}</td>
                <td style={styles.td}>{task.dueDate}</td>
                <td style={styles.td}>
                  <select
                    style={styles.statusSelect}
                    value={task.status}
                    onChange={(event) => updateStatus(task.id, event.target.value)}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 980,
    margin: '0 auto',
    padding: 24,
    fontFamily: 'Inter, Arial, sans-serif',
    color: '#0f172a',
  },
  header: { marginBottom: 24 },
  title: { margin: 0, fontSize: 34 },
  subtitle: { marginTop: 8, color: '#334155' },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    padding: 12,
    background: '#f8fafc',
  },
  cardTitle: { margin: 0, fontSize: 14, color: '#334155' },
  cardValue: { margin: '8px 0 0', fontSize: 26, fontWeight: 700 },
  formSection: { marginBottom: 24 },
  sectionTitle: { marginBottom: 12 },
  form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 },
  input: {
    border: '1px solid #94a3b8',
    borderRadius: 8,
    padding: '10px 12px',
  },
  button: {
    border: 0,
    borderRadius: 8,
    background: '#0f172a',
    color: '#fff',
    fontWeight: 600,
    padding: '10px 14px',
    cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    borderBottom: '1px solid #cbd5e1',
    padding: 10,
    fontSize: 14,
  },
  td: { borderBottom: '1px solid #e2e8f0', padding: 10 },
  statusSelect: { border: '1px solid #94a3b8', borderRadius: 6, padding: '6px 8px' },
};


const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<PlanningAVDApp />);
}
