import React, { useEffect, useMemo, useRef, useState } from 'react'
import { fetchIssues, createIssue, updateIssueStatus, STATUS_LABELS, PRIORITY_LABELS, parseCSV } from './api/github.js'
import TicketsTable from './components/TicketsTable.jsx'
import Kanban from './components/Kanban.jsx'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

function Settings({ onClose }) {
  const [repo, setRepo] = useState(localStorage.getItem('gh_repo') || '')
  const [reposRead, setReposRead] = useState(localStorage.getItem('gh_repos_read') || '')
  const [token, setToken] = useState(localStorage.getItem('gh_token') || '')
  const save = () => {
    localStorage.setItem('gh_repo', repo.trim())
    localStorage.setItem('gh_repos_read', reposRead.trim())
    localStorage.setItem('gh_token', token.trim())
    onClose(); location.reload()
  }
  return (
    <div className="modal">
      <div className="card">
        <h3>Configurações</h3>
        <p className="small">Repositório <b>principal</b> para escrita e repositórios de <b>leitura</b> (vírgula) para consolidar chamados.</p>
        <div style={{display:'grid', gap:10}}>
          <label>Repositório (escrita) – owner/repo<br/>
            <input className="input" value={repo} onChange={e=>setRepo(e.target.value)} placeholder="ex.: pontoid/dextickets" />
          </label>
          <label>Repositórios de leitura (vírgula)<br/>
            <input className="input" value={reposRead} onChange={e=>setReposRead(e.target.value)} placeholder="ex.: pontoid/dextickets, pontoid/outro-repo" />
          </label>
          <label>Token (PAT) – opcional para criar/editar<br/>
            <input className="input" value={token} onChange={e=>setToken(e.target.value)} placeholder="ghp_..." />
          </label>
          <div style={{display:'flex', gap:8}}>
            <button className="btn" onClick={onClose}>Fechar</button>
            <button className="btn primary" onClick={save}>Salvar e recarregar</button>
          </div>
        </div>
        <p className="small">⚠️ O token é salvo apenas no seu navegador (localStorage).</p>
      </div>
    </div>
  )
}

function ImportModal({ onClose, onImported, existing }){
  const [mode, setMode] = useState('csv')
  const [text, setText] = useState('')
  const [info, setInfo] = useState('Cabeçalho: title;body;status;priority;labels')
  const [loading, setLoading] = useState(false)

  const norm = s => (s||'').trim().toLowerCase()
  const extractCode = (title='') => {
    const m = String(title).trim().match(/^(\d{6,})/)
    return m ? m[1] : null
  }
  const existingTitles = new Set(existing.map(i=>norm(i.title)))
  const existingCodes = new Set(existing.map(i=>extractCode(i.title)).filter(Boolean))

  const parseAndCreate = async () => {
    setLoading(true)
    try {
      let items = []
      if (mode === 'csv') items = parseCSV(text)
      else items = JSON.parse(text)

      let created = 0, skipped = 0
      for (const it of items) {
        const title = (it.title||'').trim()
        if (!title) { skipped++; continue }
        const code = extractCode(title)
        const tnorm = norm(title)
        if (existingTitles.has(tnorm) || (code && existingCodes.has(code))) {
          skipped++; continue
        }
        const labels = (it.labels||'').split(',').map(s=>s.trim()).filter(Boolean)
        const status = STATUS_LABELS.includes(it.status) ? it.status : 'Pending'
        const priority = PRIORITY_LABELS.includes(it.priority) ? it.priority : 'Medium'
        await createIssue({ title, body: it.body||'', status, priority, labels })
        existingTitles.add(tnorm)
        if (code) existingCodes.add(code)
        created++
      }
      window.alert(`Importação concluída. Criados: ${created}. Ignorados por duplicidade: ${skipped}.`)
      onImported(); onClose()
    } catch (e) {
      setInfo('Erro ao importar: ' + String(e.message||e))
    } finally { setLoading(false) }
  }
  return (
    <div className="modal">
      <div className="card">
        <h3>Importar chamados</h3>
        <div className="chips">
          <button className={"btn "+(mode==='csv'?'primary':'')} onClick={()=>{setMode('csv'); setInfo('Cabeçalho: title;body;status;priority;labels')}}>CSV</button>
          <button className={"btn "+(mode==='json'?'primary':'')} onClick={()=>{setMode('json'); setInfo('JSON: array de objetos {title, body, status, priority, labels}')}}>JSON</button>
        </div>
        <textarea className="textarea" placeholder="Cole aqui..." value={text} onChange={e=>setText(e.target.value)}></textarea>
        <div style={{display:'flex', gap:8, marginTop:8}}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={parseAndCreate} disabled={loading}>{loading?'Importando…':'Importar'}</button>
        </div>
        <p className="small">Regras anti-duplicidade: título idêntico (case-insensitive) OU número inicial do chamado (ex.: <code>2508080006</code>) já existente.</p>
      </div>
    </div>
  )
}

export default function App() {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [filters, setFilters] = useState({ q:'', status:'', priority:'', label:'' })
  const reportRef = useRef(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const data = await fetchIssues({ q: '' })
      setIssues(data)
    } catch (e) { setError(String(e.message || e)) }
    finally { setLoading(false) }
  }
  useEffect(()=>{ load() }, [])

  const filtered = useMemo(()=>{
    return issues.filter(i => {
      if (filters.status && i.status !== filters.status) return false
      if (filters.priority && i.priority !== filters.priority) return false
      if (filters.label) {
        const t = filters.label.toLowerCase()
        if (!i.labels.some(l=>l.toLowerCase().includes(t))) return false
      }
      if (filters.q) {
        const t = filters.q.toLowerCase()
        if (!(i.title.toLowerCase().includes(t) || i.body.toLowerCase().includes(t))) return false
      }
      return true
    })
  }, [issues, filters])

  const counters = useMemo(()=>{
    const total = filtered.length
    const att = filtered.filter(i=>i.status==='Done').length
    const bloq = filtered.filter(i=>i.status==='Blocked').length
    const pend = total - att - bloq
    return { total, att, pend, bloq, attPct: total? Math.round(att*100/total):0, bloqPct: total? Math.round(bloq*100/total):0 }
  }, [filtered])

  const createSample = async () => {
    // Anti-duplicidade: por título e por código numérico inicial
    const norm = s => (s||'').trim().toLowerCase()
    const extractCode = (title='') => {
      const m = String(title).trim().match(/^(\d{6,})/)
      return m ? m[1] : null
    }
    const existingTitles = new Set(issues.map(i=>norm(i.title)))
    const existingCodes = new Set(issues.map(i=>extractCode(i.title)).filter(Boolean))

    const samples = [
      { title: "2505270034 – Nomenclatura 'Cardápio executado'", body:"Status atendido.", status:'Done', labels:['SAIO','Alimentação']},
      { title: "2508080010 – Inclusão tipos de refeições (multiselect)", body:"Implementar multiselect em cardápios.", status:'Pending', labels:['SAIO','Alimentação']},
      { title: "2508080006 – Calendário com destaques por cores", body:"Visão escola e SRE/Secretaria.", status:'Pending', labels:['SAIO','Alimentação']},
      { title: "2505270027 – Relatório de fornecedores e alimentos", body:"Modelo enviado por Heline.", status:'Pending', labels:['SAIO','Relatório']},
      { title: "2508080008 – Abrir em nova aba", body:"Alimentos, Cardápios, Listagens, Agendamentos.", status:'Pending', labels:['UX']},
      { title: "2505270035 – Relatório de movimentações e transferências", body:"Campos e status detalhados.", status:'Pending', labels:['Relatório']},
    ]

    let created = 0, skipped = 0
    for (const s of samples) {
      const tnorm = norm(s.title)
      const code = extractCode(s.title)
      if (existingTitles.has(tnorm) || (code && existingCodes.has(code))) {
        skipped++; continue
      }
      await createIssue(s)
      existingTitles.add(tnorm)
      if (code) existingCodes.add(code)
      created++
    }
    window.alert(`Seed concluído. Criados: ${created}. Ignorados por duplicidade: ${skipped}.`)
    await load()
  }

  const move = async (issue, newStatus) => {
    await updateIssueStatus(issue.number, newStatus)
    await load()
  }

  const exportPDF = async () => {
    const node = reportRef.current
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#0b1020' })
    const img = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p','mm','a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
    const w = canvas.width * ratio
    const h = canvas.height * ratio
    const x = (pageWidth - w)/2
    const y = 10
    pdf.addImage(img, 'PNG', x, y, w, h)
    pdf.save('DexTickets-relatorio.pdf')
  }

  return (
    <div className="container">
      <header className="header">
        <div className="brand">
          <img src="logo_pontoid.svg" alt="Ponto iD" width="32" height="32" />
          <h1>DexTickets • Chamados Prioritários</h1>
        </div>
        <div className="toolbar">
          <button className="btn" onClick={()=>setShowSettings(true)}>Configurações</button>
          <button className="btn" onClick={()=>setShowImport(true)}>Importar</button>
          <button className="btn" onClick={exportPDF}>Exportar PDF</button>
          <button className="btn" onClick={load} disabled={loading}>{loading? 'Atualizando…' : 'Atualizar'}</button>
          <button className="btn primary" onClick={createSample}>Seed (6 chamados)</button>
        </div>
      </header>

      {showSettings && <Settings onClose={()=>setShowSettings(false)} />}
      {showImport && <ImportModal onClose={()=>setShowImport(false)} onImported={load} existing={issues} />}

      <div className="filters">
        <input className="input" placeholder="Buscar (título/descrição)" value={filters.q} onChange={e=>setFilters({...filters, q:e.target.value})} />
        <select className="select" value={filters.status} onChange={e=>setFilters({...filters, status:e.target.value})}>
          <option value="">Status (todos)</option>
          {STATUS_LABELS.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select" value={filters.priority} onChange={e=>setFilters({...filters, priority:e.target.value})}>
          <option value="">Prioridade (todas)</option>
          {PRIORITY_LABELS.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <input className="input" placeholder="Label contém..." value={filters.label} onChange={e=>setFilters({...filters, label:e.target.value})} />
      </div>

      <div ref={reportRef}>
        <div className="grid">
          <div className="card" style={{gridColumn:'span 3'}}>
            <div className="small">Total</div>
            <div style={{fontSize:28, fontWeight:700}}>{counters.total}</div>
          </div>
          <div className="card" style={{gridColumn:'span 3'}}>
            <div className="small">Atendidos</div>
            <div style={{display:'flex', alignItems:'baseline', gap:8}}>
              <div style={{fontSize:28, fontWeight:700}}>{counters.att}</div>
              <span className="badge ok">{counters.attPct}%</span>
            </div>
          </div>
          <div className="card" style={{gridColumn:'span 3'}}>
            <div className="small">Pendentes</div>
            <div style={{fontSize:28, fontWeight:700}}>{counters.pend}</div>
          </div>
          <div className="card" style={{gridColumn:'span 3'}}>
            <div className="small">Bloqueados</div>
            <div style={{display:'flex', alignItems:'baseline', gap:8}}>
              <div style={{fontSize:28, fontWeight:700}}>{counters.bloq}</div>
              <span className="badge bad">{counters.bloqPct}%</span>
            </div>
          </div>
        </div>

        <div className="grid" style={{marginTop:12}}>
          <div className="card" style={{gridColumn:'span 12'}}>
            <h3 style={{marginTop:0}}>Kanban</h3>
            <Kanban items={filtered} onMove={move} />
          </div>
        </div>

        <div className="grid" style={{marginTop:12}}>
          <div className="card" style={{gridColumn:'span 12'}}>
            <h3 style={{marginTop:0}}>Tabela</h3>
            <TicketsTable items={filtered} loading={loading} error={error} />
          </div>
        </div>
      </div>

      <footer className="footer">
        Feito por Euzebio Alves (Ponto iD) • DexTickets (GitHub Issues) • Hospedagem: GitHub Pages
      </footer>
    </div>
  )
}
