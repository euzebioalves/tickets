import React, { useMemo, useState } from 'react'
export default function TicketsTable({ items, loading, error }){
  const [q, setQ] = useState('')
  const filtered = useMemo(()=>{
    const t = (q||'').toLowerCase()
    if (!t) return items
    return items.filter(i=> (i.title+i.body).toLowerCase().includes(t))
  }, [items, q])

  return (
    <div>
      <div style={{display:'flex', gap:8, marginBottom:8}}>
        <input className="input" style={{flex:1}} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por título/descrição..." />
        <span className="small">{filtered.length} de {items.length}</span>
      </div>
      {error && <div className="chip" style={{borderColor:'rgba(255,84,112,0.5)', color:'#ffb3c2'}}>Erro: {error}</div>}
      <div style={{overflowX:'auto'}}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th><th>Título</th><th>Status</th><th>Prioridade</th><th>Atualizado</th><th>Repo</th><th>Abrir</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="7">Carregando…</td></tr> :
              filtered.map(i=> (
                <tr key={i.id}>
                  <td>{i.number}</td>
                  <td>{i.title}</td>
                  <td>{i.status}</td>
                  <td>{i.priority}</td>
                  <td>{new Date(i.updated_at).toLocaleString()}</td>
                  <td>{i.repo}</td>
                  <td><a href={i.url} target="_blank">GitHub</a></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
