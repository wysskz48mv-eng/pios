// pios-legal-academic-intelligence-agent
// File: supabase/functions/pios-legal-academic-intelligence-agent/index.ts
//
// Handles both legal_intelligence and academic_intelligence agent types.
//
// Legal:    tracks regulatory updates, ICO/PDPL/ISO changes, compliance news.
//           Writes to insights (insight_type='compliance').
//
// Academic: searches new research publications matching DBA/research keywords.
//           Writes to insights (insight_type='research') and publications table.
//
// Deployed: 2026-04-08  ID: e1068277-90bf-4ad1-a5c5-51249458edfd
// Schedules:
//   Monday 04:00 UTC  → POST { agent_type: 'legal_intelligence' }
//   Sunday 02:00 UTC  → POST { agent_type: 'academic_intelligence' }
//   (both run Sunday if no agent_type specified)
//
// Required Supabase secrets:
