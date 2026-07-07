import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let val = parts.slice(1).join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

async function run() {
  // Fetch ALL projects
  const projRes = await fetch(`${supabaseUrl}/rest/v1/projects`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const projects = await projRes.json();

  console.log(`=== TODOS OS PROJETOS NO BANCO DE DADOS (${projects?.length || 0}) ===`);
  if (projects && Array.isArray(projects)) {
    projects.forEach(p => {
      console.log(`- Obra: ${p.name} | Status: ${p.status} | ID: ${p.id}`);
    });
  }

  // Fetch ALL tasks
  const taskRes = await fetch(`${supabaseUrl}/rest/v1/tasks`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const tasks = await taskRes.json();

  console.log(`\n=== TODAS AS TAREFAS NO BANCO DE DADOS (${tasks?.length || 0}) ===`);
  if (tasks && Array.isArray(tasks)) {
    const activeProjects = projects.filter(p => p.status !== 'archived');
    const activeProjIds = activeProjects.map(p => p.id);

    const juneTasks = tasks.filter(t => {
      return t.start_date && t.start_date <= '2026-06-30' && activeProjIds.includes(t.project_id);
    });

    console.log(`\n=== TAREFAS ATIVAS PROGRAMADAS ATÉ JUNHO/2026 (${juneTasks.length}) ===\n`);
    const grouped = {};
    juneTasks.forEach(t => {
      const projName = activeProjects.find(p => p.id === t.project_id)?.name || 'Desconhecida';
      if (!grouped[projName]) grouped[projName] = [];
      grouped[projName].push(t);
    });

    for (const [projName, ptasks] of Object.entries(grouped)) {
      console.log(`📍 Obra: ${projName}`);
      ptasks.forEach(t => {
        console.log(`   - ${t.name} | Início: ${t.start_date} | Fim: ${t.end_date} | Progresso: ${t.percent_complete}%`);
      });
      console.log('');
    }
  }
}

run().catch(console.error);
