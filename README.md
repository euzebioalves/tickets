# DexTickets • GitHub Pages (MVP v3)

Painel web **profissional** para gestão de chamados prioritários, hospedado no **GitHub Pages** e usando **GitHub Issues** como backend.

## Novidades v3
- **Validação anti-duplicidade** no Seed e na Importação:
  - Bloqueia criação se já existir **mesmo título** (case-insensitive) **ou** se o **título começar por um número** (ex.: `2508080006`) que já exista em outro chamado.
  - Exibe contagem de criados e ignorados.

## Como usar
- Igual à v2 (PDF, filtros, import CSV/JSON, multi-repo).

## CSV de exemplo
```
title;body;status;priority;labels
"2508080006 – Calendário com destaques";"Visão escola e SRE";"Pending";"Medium";"SAIO,Alimentação"
"2505270035 – Relatório movimentações";"Campos e status";"Pending";"Medium";"Relatório"
```
