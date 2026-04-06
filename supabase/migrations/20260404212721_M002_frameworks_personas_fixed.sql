insert into persona_configs (code, name, nemoclaw_register, brief_focus_areas, active_by_default) values
  ('CEO',            'CEO / Founder',        'peer',     array['strategic_direction','platform_decisions','investor_narrative','team_leadership'], true),
  ('ACADEMIC',       'Academic / Researcher', 'mentor',  array['thesis_progress','literature_synthesis','supervisor_prep','methodology'], false),
  ('CONSULTANT',     'Consultant / Advisor',  'advisor',  array['client_delivery','proposals','regulatory_navigation','thought_leadership'], false),
  ('EXECUTIVE',      'Executive / Director',  'advisor',  array['operational_leadership','team_performance','board_reporting','stakeholders'], false),
  ('CHIEF_OF_STAFF', 'Chief of Staff',        'peer',     array['principal_support','cross_functional_coordination','strategic_initiatives'], false),
  ('WHOLE_LIFE',     'Whole-Life / Integrated','coach',   array['energy_management','work_life_integration','long_term_purpose','sustainable_performance'], false)
on conflict (code) do nothing;

create table if not exists frameworks (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text not null,
  prompt_fragment text not null,
  persona_required text,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table frameworks enable row level security;
drop policy if exists "Frameworks are public" on frameworks;
create policy "Frameworks are public" on frameworks for select using (true);

create table if not exists framework_configs (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid references frameworks(id) not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  domain_context text,
  domain_vocabulary text[] default '{}',
  activation_weight float default 1.0,
  last_used_at timestamptz,
  usage_count integer default 0,
  unique(framework_id, user_id)
);

alter table framework_configs enable row level security;
drop policy if exists "Users own their framework configs" on framework_configs;
create policy "Users own their framework configs" on framework_configs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into frameworks (code, name, description, prompt_fragment, persona_required) values
('SDL', 'Strategic Dialogue Framework', 'Structures strategic thinking dialogues. Surfaces assumptions, challenges blindspots, and drives toward clear strategic choices.', 'SDL: Surface the assumption underneath the question, identify the real choice being made, and help the user articulate the decision they are avoiding.', 'CEO'),
('POM', 'Portfolio and Operations Management', 'Multi-project portfolio prioritisation, resource allocation, and sprint sequencing across concurrent initiatives.', 'POM: Rank by strategic value and urgency, identify resource conflicts, surface what must be sequenced vs parallelised, and flag what is being under-resourced.', 'CEO'),
('OAE', 'Organisational and Academic Exchange', 'Bridges organisational practice and academic inquiry. Enables rigorous thinking in both registers without compromising either.', 'OAE: Maintain the rigour of academic language while grounding it in operational reality. Do not let one register collapse into the other.', null),
('CVDM', 'Contextual Value and Decision Matrix', 'Structured decision-making with explicit value weighting. Maps decisions against contextual constraints and strategic priorities.', 'CVDM: Surface the decision criteria explicitly, weight them against the current context, and identify which criteria the user is implicitly prioritising without admitting it.', null),
('CPA', 'Client and Principal Alignment', 'Manages principal-agent dynamics in client or stakeholder relationships. Surfaces misalignment before it becomes conflict.', 'CPA: Identify what the principal says they want, what they actually need, and where those differ. Surface the alignment gap before it becomes a delivery problem.', 'CONSULTANT'),
('UMS', 'Unified Management System', 'Integrates operational rhythms, review cycles, and management cadences into a coherent system.', 'UMS: Ensure reviews, retrospectives, and forward planning are properly sequenced and not crowding each other out. Identify missing management rhythms.', 'EXECUTIVE'),
('VFO', 'Vision, Focus, and Output', 'Connects long-term vision to medium-term focus areas to daily and weekly outputs. Prevents strategic drift.', 'VFO: Trace from the user stated vision down to today tasks. Surface where daily activity has drifted from strategic intent.', 'CEO'),
('CFE', 'Cognitive and Focus Economy', 'Manages cognitive load, attention, and energy as finite strategic resources. Optimises decision quality.', 'CFE: Treat cognitive capacity as a finite resource. Identify where the user is spending attention on low-value decisions. Surface what to eliminate, delegate, or defer.', 'WHOLE_LIFE'),
('ADF', 'Adaptive Decision Framework', 'Decision-making under uncertainty and rapid change. Distinguishes reversible from irreversible decisions.', 'ADF: Distinguish reversible from irreversible decisions, recommend fast action on the former and more deliberate process for the latter.', null),
('GSM', 'Growth and Stakeholder Management', 'Manages growth-stage challenges including team scaling, investor relations, and market positioning.', 'GSM: Surface the scaling tensions (speed vs quality, founder-led vs delegated, growth vs profitability) and help the user make the trade-off explicitly.', 'CEO'),
('SPA', 'Strategic Priority Alignment', 'Ensures individual actions, team efforts, and resource allocation remain aligned with top strategic priorities.', 'SPA: Map current activities against the top 3 strategic priorities. Surface the misalignment between stated priorities and actual time/resource allocation.', null),
('RTE', 'Reflection, Tension, and Evolution', 'Creates structured space for reflection on tensions, contradictions, and growth edges in professional practice.', 'RTE: Name the tension explicitly, explore what each side is protecting, and identify the synthesis that enables growth.', null),
('IML', 'Integrated Methodology and Literature', 'Research methodology alignment, literature synthesis, and academic-practice integration for doctoral or professional research.', 'IML: Ensure the methodology is coherent with the research question, that the literature review is positioning the contribution clearly, and that academic and practice sources are being used appropriately.', 'ACADEMIC')
on conflict (code) do nothing;;
