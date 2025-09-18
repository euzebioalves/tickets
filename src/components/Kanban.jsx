import React from 'react'
import { STATUS_LABELS } from '../api/github.js'

const columns = [
  { key:'Pending', name:'Pendente' },
  { key:'InProgress', name:'Em andamento' },
  { key:'Blocked', name:'Bloqueado' },
  { key:'Review', name:'Revisão' },
  { key:'Done', name:'Concluído' },
]

export default function Kanban({ items, onMove }){
  const grouped = Object.fromEntries(columns.map(c=>[c.key, []]))
  items.forEach(i => grouped[i.status||'Pending']?.push(i))

  return (
    <div className="kb">
      {columns.map(col => (
        <div className="kb-col" key={col.key}>
          <h4>{col.name} <span className="small">{grouped[col.key].length}</span></h4>
          {grouped[col.key].map(t => (
            <div className="ticket" key={t.id}>
              <div style={{display:'flex', justifyContent:'space-between', gap:8}}>
                <strong>#{t.number}</strong>
                <span className="badge">{t.priority}</span>
              </div>
              <div style={{margin:'6px 0'}}>{t.title}</div>
              <div className="chips">
                <span className={"badge "+(t.status==='Done'?'ok': t.status==='Blocked'?'bad':'')}>{t.status}</span>
                <a className="badge" href={t.url} target="_blank">GitHub</a>
                {t.repo && <span className="badge">{t.repo.split('/')[1]}</span>}
              </div>
              <div style={{display:'flex', gap:6, marginTop:8, flexWrap:'wrap'}}>
                {STATUS_LABELS.filter(s=>s!==t.status).map(s=>(
                  <button key={s} className="btn" onClick={()=>onMove(t, s)}>{s}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
