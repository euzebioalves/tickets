const GITHUB_API = 'https://api.github.com'

function getToken() { return localStorage.getItem('gh_token') || '' }
function getRepo() { return localStorage.getItem('gh_repo') || '' }
function getReadRepos() {
  const raw = localStorage.getItem('gh_repos_read') || ''
  const arr = raw.split(',').map(s=>s.trim()).filter(Boolean)
  const primary = getRepo()
  if (primary && !arr.includes(primary)) arr.unshift(primary)
  return arr
}
function headers() {
  const h = { 'Accept': 'application/vnd.github+json' }
  const token = getToken()
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export const STATUS_LABELS = ['Pending','InProgress','Blocked','Review','Done']
export const PRIORITY_LABELS = ['Low','Medium','High','Critical']

export function parseIssue(issue) {
  const labels = (issue.labels || []).map(l => typeof l === 'string' ? l : l.name)
  const status = STATUS_LABELS.find(s => labels.includes(`status:${s}`)) || 'Pending'
  const priority = PRIORITY_LABELS.find(p => labels.includes(`priority:${p}`)) || 'Medium'
  const business_status = status === 'Done' ? 'Atendido' : (status === 'Blocked' ? 'Bloqueado' : 'Pendente')
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body || '',
    state: issue.state,
    status, priority, business_status,
    labels,
    assignee: issue.assignee?.login || null,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    url: issue.html_url,
    repo: issue.repository_url?.split('/repos/')[1] || null
  }
}

export async function fetchIssues({ q='' } = {}) {
  const repos = getReadRepos()
  if (!repos.length) throw new Error('Nenhum repositório configurado. Abra Configurações.')
  const all = []
  for (const repo of repos) {
    const query = `repo:${repo} is:issue in:title,body ${q}`.trim()
    const url = `${GITHUB_API}/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=100`
    const res = await fetch(url, { headers: headers() })
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} @ ${repo}`)
    const data = await res.json()
    data.items.forEach(i => all.push(parseIssue(i)))
  }
  all.sort((a,b)=> new Date(b.updated_at) - new Date(a.updated_at))
  return all
}

export async function createIssue({ title, body, status='Pending', priority='Medium', labels=[] }) {
  const repo = getRepo()
  if (!repo) throw new Error('Repositório de escrita não configurado.')
  const url = `${GITHUB_API}/repos/${repo}/issues`
  const labelSet = Array.from(new Set([`status:${status}`, `priority:${priority}`, ...labels]))
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, labels: labelSet })
  })
  if (!res.ok) throw new Error(`Falha ao criar issue: ${res.status}`)
  return parseIssue(await res.json())
}

export async function updateIssueStatus(number, status) {
  const repo = getRepo()
  const url = `${GITHUB_API}/repos/${repo}/issues/${number}`
  const current = await fetch(url, { headers: headers() })
  const issue = await current.json()
  const labels = (issue.labels || []).map(l => l.name)
  const others = labels.filter(l => !l.startsWith('status:'))
  const newLabels = [...others, `status:${status}`]
  const res = await fetch(url, { method:'PATCH', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ labels: newLabels }) })
  if (!res.ok) throw new Error(`Falha ao atualizar status: ${res.status}`)
  return parseIssue(await res.json())
}

export function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length)
  if (!lines.length) return []
  const headers = lines[0].split(';').map(s=>s.trim())
  const rows = lines.slice(1).map(l => l.split(';'))
  return rows.map(cells => Object.fromEntries(headers.map((h,i)=>[h, cells[i]||''])))
}
