-- M053: Load Complete VIQ Framework Library (44 frameworks)

DROP TABLE IF EXISTS framework_domain_map CASCADE;
DROP TABLE IF EXISTS viq_frameworks CASCADE;

CREATE TABLE viq_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viq_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  when_to_use TEXT NOT NULL,
  domain_tags TEXT[],
  tier VARCHAR(20) DEFAULT 'professional',
  active BOOLEAN DEFAULT true,
  sort_order INT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE framework_domain_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID REFERENCES viq_frameworks(id) ON DELETE CASCADE,
  domain_mode VARCHAR(50) NOT NULL,
  relevance_score INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(framework_id, domain_mode)
);

INSERT INTO viq_frameworks (viq_code, name, category, description, when_to_use, domain_tags, tier, sort_order) VALUES
('VIQ-PS-01', 'Boundary Mapping', 'problem_structuring', 'Exhaustive, non-overlapping problem decomposition. Ensures all aspects of a problem are covered without duplication.', 'Any structured problem diagnosis, project scoping, analytical framework building', ARRAY['all'], 'professional', 1),
('VIQ-PS-02', 'Issue Tree', 'problem_structuring', 'Hierarchical breakdown of a problem into component sub-issues. Each branch is testable independently.', 'Complex multi-variable problems, root cause analysis, structured diagnosis', ARRAY['all'], 'professional', 2),
('VIQ-PS-03', 'Root Interrogation', 'problem_structuring', 'Iterative questioning technique to surface root causes. Ask why at each level until the root cause emerges.', 'Manufacturing failures, service breakdowns, process issues, recurring failures', ARRAY['all'], 'professional', 3),
('VIQ-PS-04', 'Stakeholder Ecosystem Map', 'problem_structuring', 'Identifies all stakeholders, their interests, influence levels, and interdependencies.', 'Change management, stakeholder engagement, political mapping, organizational transformation', ARRAY['all'], 'professional', 4),
('VIQ-PS-05', 'Scenario Planning', 'problem_structuring', 'Develops multiple plausible futures based on key uncertainties. Builds strategic robustness across scenarios.', 'Strategic planning, risk management, long-term planning, decision-making under uncertainty', ARRAY['all'], 'professional', 5),
('VIQ-PS-06', 'Causal Loop Diagram', 'problem_structuring', 'Visualizes feedback loops and causal relationships in complex systems. Identifies reinforcing and balancing loops.', 'Complex system behavior, supply chain analysis, organizational dynamics', ARRAY['all'], 'professional', 6),
('VIQ-PS-07', 'MECE Logic', 'problem_structuring', 'Mutually Exclusive, Collectively Exhaustive. Ensures problem breakdown has no overlap and no gaps.', 'Any analysis requiring logical clarity, communication clarity, proposal structuring', ARRAY['all'], 'professional', 7),
('VIQ-ST-01', 'Competitive Force Analysis', 'strategy', 'Five-forces model of industry competitive intensity. Analyzes suppliers, customers, substitutes, entrants, and rivals.', 'Market entry decisions, competitive strategy, industry analysis, pricing decisions', ARRAY['all'], 'professional', 8),
('VIQ-ST-02', 'Strategic Option Evaluation', 'strategy', 'Framework for evaluating multiple strategic choices against criteria. Builds decision matrix with weighted factors.', 'Strategic choice decisions, M&A evaluation, technology selection, partnership evaluation', ARRAY['all'], 'professional', 9),
('VIQ-ST-03', 'Portfolio Analysis Matrix', 'strategy', 'Two-by-two matrix for categorizing business units. Guides investment and harvest decisions.', 'Multi-business strategy, capital allocation, product portfolio decisions', ARRAY['all'], 'professional', 10),
('VIQ-ST-04', 'Blue Ocean Strategy', 'strategy', 'Challenges industry assumptions to create uncontested market space. Value-cost tradeoff reframing.', 'Market positioning, new market creation, differentiation, business model innovation', ARRAY['all'], 'professional', 11),
('VIQ-ST-05', 'Core Competency Framework', 'strategy', 'Identifies distinctive capabilities that create competitive advantage. Focuses on leveraging strengths.', 'Strategic positioning, M&A evaluation, capability-based strategy, outsourcing decisions', ARRAY['all'], 'professional', 12),
('VIQ-ST-06', 'Value Chain Analysis', 'strategy', 'Breaks business into primary and support activities. Identifies where value is added or costs can be reduced.', 'Cost reduction, operational efficiency, margin improvement, supply chain optimization', ARRAY['all'], 'professional', 13),
('VIQ-ST-07', 'Growth Matrix', 'strategy', 'Four-quadrant framework: market penetration, product development, market development, diversification.', 'Growth strategy, new product decisions, market expansion, diversification evaluation', ARRAY['all'], 'professional', 14),
('VIQ-ST-08', 'Strategic Positioning Framework', 'strategy', 'Positions organization on cost vs. differentiation vs. focus dimensions. Builds competitive identity.', 'Competitive positioning, business model design, pricing strategy, target market selection', ARRAY['all'], 'professional', 15),
('VIQ-OD-01', 'Operating Model Design', 'org_design', 'Designs how organization delivers value: structure, processes, technology, talent.', 'Organizational transformation, post-merger integration, business model change', ARRAY['all'], 'professional', 16),
('VIQ-OD-02', 'Organizational Structure Matrix', 'org_design', 'Evaluates structure options: functional, divisional, matrix, network. Analyzes trade-offs.', 'Organizational redesign, growth scaling, complexity management, global coordination', ARRAY['all'], 'professional', 17),
('VIQ-OD-03', 'Capability Map', 'org_design', 'Identifies current vs. required capabilities across people, process, technology.', 'Transformation planning, capability building, talent strategy, technology roadmap', ARRAY['all'], 'professional', 18),
('VIQ-OD-04', 'Span of Control Analysis', 'org_design', 'Analyzes manager-to-direct-report ratios. Determines optimal span based on work complexity.', 'Organizational efficiency, span optimization, manager effectiveness, cost reduction', ARRAY['all'], 'professional', 19),
('VIQ-OD-05', 'Role Clarity Framework', 'org_design', 'Defines role purpose, accountabilities, responsibilities, authorities. Eliminates role confusion.', 'Organizational clarity, role definition, accountability improvement, conflict resolution', ARRAY['all'], 'professional', 20),
('VIQ-SC-01', 'Stakeholder Engagement Plan', 'stakeholder_change', 'Plans communication and engagement strategy for each stakeholder group. Tailors messaging.', 'Major change initiatives, transformation, sensitive decisions, organizational change', ARRAY['all'], 'professional', 21),
('VIQ-SC-02', 'Change Curve Model', 'stakeholder_change', 'Predicts emotional journey through change: shock, denial, anger, bargaining, depression, acceptance.', 'Organizational change, transformation, layoffs, mergers, technology implementation', ARRAY['all'], 'professional', 22),
('VIQ-SC-03', 'Resistance Analysis', 'stakeholder_change', 'Identifies sources of resistance: loss, competence concerns, values conflicts. Designs targeted interventions.', 'Change management, transformation, strategy implementation, technology adoption', ARRAY['all'], 'professional', 23),
('VIQ-SC-04', 'Coalition Building', 'stakeholder_change', 'Identifies and mobilizes influential stakeholders to support change. Builds critical mass of supporters.', 'Organizational change, transformation, political navigation, major initiatives', ARRAY['all'], 'professional', 24),
('VIQ-SC-05', 'Communication Cascading', 'stakeholder_change', 'Designs communication flow from top to bottom with reinforcement at each level.', 'Organizational announcements, strategy communication, change initiatives, crisis management', ARRAY['all'], 'professional', 25),
('VIQ-PI-01', 'Process Flow Mapping', 'process_improvement', 'Documents current process: steps, decisions, delays, waste. Identifies improvement opportunities.', 'Process optimization, waste elimination, cycle time reduction, quality improvement', ARRAY['all'], 'professional', 26),
('VIQ-PI-02', 'DMAIC Cycle', 'process_improvement', 'Define-Measure-Analyze-Improve-Control. Structured quality improvement methodology.', 'Quality improvement, process optimization, performance improvement, problem-solving', ARRAY['all'], 'professional', 27),
('VIQ-PI-03', 'Lean Principles', 'process_improvement', 'Eliminate waste (muda), reduce variation (mura), remove overburden (muri). Builds efficiency culture.', 'Manufacturing, service operations, supply chain, administrative processes, cost reduction', ARRAY['all'], 'professional', 28),
('VIQ-PI-04', 'Theory of Constraints', 'process_improvement', 'Identifies single binding constraint limiting system throughput. Focuses improvement on constraint.', 'Performance improvement, bottleneck elimination, throughput increase, resource prioritization', ARRAY['all'], 'professional', 29),
('VIQ-PI-05', 'Root Cause Prevention', 'process_improvement', 'Goes beyond fixing symptoms to prevent recurrence. Implements systemic controls.', 'Quality improvement, defect prevention, failure prevention, continuous improvement', ARRAY['all'], 'professional', 30),
('VIQ-PI-06', 'Performance Dashboard Design', 'process_improvement', 'Designs metrics dashboard: leading indicators, lagging indicators, balance.', 'Performance management, operational oversight, continuous improvement, accountability', ARRAY['all'], 'professional', 31),
('VIQ-FC-01', 'Investment Decision Framework', 'financial_commercial', 'Evaluates capital projects using NPV, IRR, payback, risk. Compares investment options.', 'Capital budgeting, project selection, investment decisions, M&A evaluation', ARRAY['all'], 'professional', 32),
('VIQ-FC-02', 'Pricing Strategy Framework', 'financial_commercial', 'Analyzes cost, value, competition, demand. Sets optimal price. Balances volume and margin.', 'Pricing decisions, new product launch, market entry, competitive response', ARRAY['all'], 'professional', 33),
('VIQ-FC-03', 'Margin Bridge Analysis', 'financial_commercial', 'Tracks margin changes from baseline to target. Identifies drivers. Quantifies impact.', 'Profitability improvement, cost reduction, pricing strategy, merger synergies', ARRAY['all'], 'professional', 34),
('VIQ-FC-04', 'Customer Economics Analysis', 'financial_commercial', 'Calculates customer lifetime value, acquisition cost, retention economics.', 'Customer strategy, market segmentation, pricing decisions, customer acquisition', ARRAY['all'], 'professional', 35),
('VIQ-FC-05', 'Business Model Canvas', 'financial_commercial', 'Visualizes business model: value proposition, channels, revenue streams, costs.', 'Business model design, new venture launch, business model innovation, strategy clarity', ARRAY['all'], 'professional', 36),
('VIQ-EA-01', 'Hypothesis Testing Framework', 'evidence_analytics', 'Structured approach: form hypothesis, design test, analyze data, draw conclusion.', 'Data analysis, research, problem-solving, decision-making, evidence-based strategy', ARRAY['all'], 'professional', 37),
('VIQ-EA-02', 'Data Storytelling', 'evidence_analytics', 'Transforms data into compelling narrative with context, insight, action.', 'Presentation, stakeholder persuasion, strategy communication, data visualization', ARRAY['all'], 'professional', 38),
('VIQ-EA-03', 'Regression Analysis Framework', 'evidence_analytics', 'Identifies relationships between variables. Isolates correlation from causation.', 'Market analysis, pricing analysis, customer analysis, performance drivers, forecasting', ARRAY['all'], 'professional', 39),
('VIQ-EA-04', 'Sensitivity Analysis', 'evidence_analytics', 'Tests how outcomes change with assumption changes. Identifies key value drivers.', 'Forecasting, pricing, investment decisions, strategy robustness, risk management', ARRAY['all'], 'professional', 40),
('VIQ-ID-01', 'Design Thinking Method', 'innovation_design', 'Human-centered design: empathize, define, ideate, prototype, test. Generates innovative solutions.', 'Product innovation, service design, problem-solving, new market entry', ARRAY['all'], 'professional', 41),
('VIQ-ID-02', 'Jobs to be Done Framework', 'innovation_design', 'Identifies underlying job customer is trying to accomplish. Builds solutions around jobs.', 'Product design, customer insight, market segmentation, innovation strategy', ARRAY['all'], 'professional', 42),
('VIQ-ID-03', 'Innovation Pipeline', 'innovation_design', 'Manages innovation portfolio across: core, adjacent, transformational.', 'Innovation management, R&D prioritization, product portfolio, growth strategy', ARRAY['all'], 'professional', 43),
('VIQ-ID-04', 'Experiment Design Framework', 'innovation_design', 'Rapid experimentation methodology: hypothesis, MVP, test, learn, iterate.', 'Product development, market testing, innovation validation, startup launch', ARRAY['all'], 'professional', 44);

CREATE INDEX idx_frameworks_category ON viq_frameworks(category);
CREATE INDEX idx_frameworks_active ON viq_frameworks(active);
CREATE INDEX idx_domain_map_domain ON framework_domain_map(domain_mode);
CREATE INDEX idx_domain_map_relevance ON framework_domain_map(relevance_score DESC);

INSERT INTO framework_domain_map (framework_id, domain_mode, relevance_score)
SELECT id, 'DBA Research', 9 FROM viq_frameworks WHERE category IN ('problem_structuring', 'evidence_analytics')
UNION ALL
SELECT id, 'DBA Research', 7 FROM viq_frameworks WHERE category IN ('strategy', 'process_improvement')
UNION ALL
SELECT id, 'DBA Research', 5 FROM viq_frameworks WHERE category NOT IN ('problem_structuring', 'evidence_analytics', 'strategy', 'process_improvement');

INSERT INTO framework_domain_map (framework_id, domain_mode, relevance_score)
SELECT id, 'FM Consulting', 9 FROM viq_frameworks WHERE category IN ('process_improvement', 'org_design')
UNION ALL
SELECT id, 'FM Consulting', 8 FROM viq_frameworks WHERE category IN ('stakeholder_change', 'problem_structuring')
UNION ALL
SELECT id, 'FM Consulting', 6 FROM viq_frameworks WHERE category IN ('financial_commercial', 'strategy');

INSERT INTO framework_domain_map (framework_id, domain_mode, relevance_score)
SELECT id, 'SaaS / Tech', 9 FROM viq_frameworks WHERE category IN ('innovation_design', 'strategy')
UNION ALL
SELECT id, 'SaaS / Tech', 8 FROM viq_frameworks WHERE category IN ('financial_commercial', 'problem_structuring')
UNION ALL
SELECT id, 'SaaS / Tech', 7 FROM viq_frameworks WHERE category IN ('process_improvement', 'evidence_analytics');

INSERT INTO framework_domain_map (framework_id, domain_mode, relevance_score)
SELECT id, 'Executive OS', 9 FROM viq_frameworks WHERE category IN ('org_design', 'stakeholder_change')
UNION ALL
SELECT id, 'Executive OS', 8 FROM viq_frameworks WHERE category IN ('strategy', 'problem_structuring')
UNION ALL
SELECT id, 'Executive OS', 7 FROM viq_frameworks WHERE category IN ('process_improvement', 'innovation_design');

INSERT INTO framework_domain_map (framework_id, domain_mode, relevance_score)
SELECT id, 'Business', 8 FROM viq_frameworks WHERE category IN ('strategy', 'financial_commercial')
UNION ALL
SELECT id, 'Business', 8 FROM viq_frameworks WHERE category IN ('innovation_design', 'process_improvement')
UNION ALL
SELECT id, 'Business', 7 FROM viq_frameworks WHERE category NOT IN ('strategy', 'financial_commercial', 'innovation_design', 'process_improvement');
