# Development Systems Architecture OS
## Claude Code Master Build Specification

**Working product name:** Development Systems Architecture OS (DSA OS)  
**Owner:** The Purple Lamb Company  
**Methodological foundation:** Development Architecture Method™  
**Primary purpose:** Create the digital operating environment through which Development Systems Architecture engagements are scoped, delivered, documented, paid for, reviewed, implemented, and converted into reusable intellectual property.

---

# 1. PRODUCT DEFINITION

DSA OS is not a generic client portal, CRM, project-management tool, or document repository.

It is a structured operating system for Development Systems Architecture engagements.

The platform must help The Purple Lamb Company:

1. Turn complex client initiatives into structured development architecture.
2. Deliver the four core architecture domains consistently:
   - Knowledge Architecture
   - Capability Architecture
   - Strategic Model Architecture
   - Application Architecture
3. Preserve project evidence, decisions, assumptions, risks, dependencies, and outputs.
4. Give clients a clear view of project progress, decisions required, deliverables, implementation status, and financial obligations.
5. Protect and distinguish TPLCo methodology/IP from client-owned work product and confidential client information.
6. Convert completed engagements into reusable architecture patterns without exposing client-confidential information.
7. Create the software foundation for future certification and licensing of the Development Architecture Method™.

The platform should feel like institutional infrastructure, not freelance consulting software.

---

# 2. HARD PROJECT BOUNDARY

This project is completely independent from Peephole.

Claude Code must follow these rules:

- Do not read, modify, import from, connect to, or reference the Peephole repository.
- Do not reuse Peephole environment variables, database projects, API keys, Supabase projects, deployment environments, or code unless explicitly instructed in the future.
- Do not place this app inside the Peephole repository.
- Maintain a separate Git repository.
- Maintain separate environment files.
- Maintain separate deployment configuration.
- Maintain separate database infrastructure.

Recommended local repository name:

`development-architecture-os`

---

# 3. CORE PRODUCT PRINCIPLE

The platform should represent architecture as structured data, not merely pages and documents.

A client engagement should be modeled as a connected system of architecture objects.

Examples:

- Knowledge Area
- Capability
- Skill
- Strategic Model
- Assumption
- Constraint
- Risk
- Opportunity
- Stakeholder
- Decision
- Dependency
- Metric
- Application Format
- Recommendation
- Implementation Action
- Evidence Source
- Deliverable

These objects should be able to relate to one another.

Example:

Capability: Commercial Acquisition
→ requires Skill: Property Underwriting
→ informed by Knowledge Area: Commercial Real Estate Market
→ constrained by Risk: Capital Availability
→ measured by Metric: Qualified Acquisitions / Month
→ implemented through Application Format: Acquisition Team

This relational architecture is a central design principle.

---

# 4. USER TYPES

## Internal TPLCo Roles

### System Administrator
Full platform access.

Can:
- manage users
- manage organizations
- manage platform settings
- manage methodology/IP library
- manage templates
- manage financial settings
- manage permissions
- access portfolio intelligence

### Principal Architect
Owns architecture engagements.

Can:
- create engagements
- edit all architecture objects
- run diagnostics
- manage client reviews
- approve deliverables
- make recommendations
- create reusable IP candidates
- view project financials

### Architect
Can create and edit architecture work within assigned projects.

### Researcher
Can manage research, evidence, knowledge areas, source summaries, citations, and research questions.

### Project Administrator
Can manage project setup, meetings, client requests, document uploads, timeline, deliverables, and status updates.

### Finance Administrator
Can manage contracts, invoices, payments, payment schedules, change orders, and financial reporting.

---

## Client Roles

### Executive Sponsor
Full client-side project visibility, including financials unless restricted.

### Client Project Lead
Can see project architecture, participate in reviews, respond to requests, upload files, comment, and manage client-side actions.

### Client Finance
Can access contracts, invoices, payment schedule, receipts, and financial documents.

### Client Contributor
Can access only assigned project areas, requests, reviews, and documents.

### Client Viewer
Read-only access to approved project content.

Permissions must be role-based and organization-scoped.

---

# 5. PRIMARY APPLICATION AREAS

The application should contain seven major systems.

## 5.1 Engagement Management

Purpose: define the commercial and strategic container for a client engagement.

Features:
- organizations
- client contacts
- engagements
- engagement type
- scope
- project objective
- start/end dates
- current phase
- client team
- internal team
- contract value
- engagement status
- timeline
- linked documents

Supported engagement types:
- Development Architecture Sprint
- Development Architecture Intensive
- Embedded Development Partner
- Cohort
- Custom Engagement

---

## 5.2 Development Architecture Workspace

The core working environment.

Each engagement should contain four primary architecture workspaces.

### Knowledge Architecture

Objects/features:
- domain map
- concept hierarchy
- research questions
- knowledge areas
- knowledge gaps
- regulatory context
- competitive landscape
- system boundaries
- stakeholder context
- evidence sources

### Capability Architecture

Objects/features:
- capabilities
- skills
- role-to-skill mapping
- capability gaps
- leadership capability
- talent sequencing
- readiness status
- internal vs external ownership

### Strategic Model Architecture

Objects/features:
- model library
- project-applied models
- model assumptions
- structural leverage
- differentiation logic
- strategic implications
- risk implications
- related architecture objects

### Application Architecture

Objects/features:
- operating model
- program structure
- product structure
- governance model
- decision rights
- workflow
- delivery mechanism
- measurement system
- scaling sequence
- documentation protocol

---

# 6. PROJECT INTELLIGENCE SYSTEM

Each engagement should have a Project Intelligence environment.

Modules:

## Evidence Library
Store and classify:
- uploaded files
- external research
- interview notes
- meeting notes
- source links
- internal analysis

Each source should include:
- title
- source type
- source owner
- date
- project relevance
- linked architecture objects
- confidentiality classification
- citation / attribution field

## Assumptions Register
Fields:
- assumption
- category
- confidence
- validation status
- evidence
- owner
- impact if false

## Risk Register
Fields:
- risk
- category
- probability
- impact
- severity
- mitigation
- owner
- related objects

## Dependency Register
Fields:
- dependency
- source object
- dependent object
- status
- owner
- blocking / non-blocking

## Decision Register
Fields:
- decision title
- context
- evidence
- options
- tradeoffs
- recommendation
- client decision
- decision owner
- date
- downstream impact

## Opportunity Register
For strategic possibilities identified during architecture work.

---

# 7. CLIENT EXPERIENCE

The client dashboard must answer four questions immediately:

1. Where are we in the architecture?
2. What decisions/actions are required from us?
3. What has been delivered or implemented?
4. What do we owe, what have we paid, and what is coming next?

Recommended client navigation:

- Overview
- Architecture
- Decisions
- Actions
- Reviews
- Documents
- Implementation
- Billing
- Messages

---

# 8. CLIENT DASHBOARD

Display:

## Project Snapshot
- engagement name
- engagement type
- project objective
- overall stage
- current phase
- project health
- next executive review

## Architecture Progress
Show each domain separately:
- Knowledge Architecture
- Capability Architecture
- Strategic Model Architecture
- Application Architecture

Suggested states:
- Undefined
- Emerging
- Defined
- Structured
- Operationalized

Avoid simplistic arbitrary scoring in MVP.

## Client Actions
- items awaiting upload
- questions to answer
- approvals required
- decisions required

## Financial Snapshot
- contract value
- approved change orders
- revised contract value
- amount paid
- amount currently due
- remaining balance
- next payment amount
- next payment due date
- payment status

## Deliverables
- current deliverables
- approved deliverables
- pending review

---

# 9. COMMERCIAL & FINANCIAL MANAGEMENT

Financial visibility is a core feature, not an afterthought.

## Contract
Fields:
- engagement
- original contract value
- executed date
- start date
- end date
- payment structure
- deposit amount
- agreement document
- contract status

## Payment Schedule
Allow:
- milestone-based
- fixed installments
- percentage-based
- monthly retainer
- custom schedule

A payment milestone should contain:
- title
- description
- amount
- due date
- related architecture phase (optional)
- trigger type
- status
- invoice status

## Invoice
Fields:
- invoice number
- engagement
- amount
- issue date
- due date
- status
- payment link
- associated milestone
- PDF/reference

Statuses:
- draft
- scheduled
- open
- paid
- partially paid
- overdue
- void

## Payment
Fields:
- invoice
- amount
- payment date
- payment method
- processor transaction ID
- receipt

## Change Order
Fields:
- original contract value
- change order title
- description
- scope impact
- schedule impact
- fee impact
- status
- client approval date
- revised contract value

Statuses:
- draft
- sent
- approved
- declined
- withdrawn

## Financial Calculations
System should calculate:
- original contract value
- total approved change orders
- revised contract value
- total invoiced
- total paid
- currently due
- overdue amount
- remaining uninvoiced
- remaining contract balance

Do not derive project completion percentage from payment percentage.

---

# 10. PAYMENT UX

The payment journey should visually connect to the engagement without hard-coding payment milestones to architecture phases.

Example:

✓ Deposit — $12,000 — Paid
✓ Diagnostic Completion — $6,000 — Paid
● Current Milestone — $6,000 — Due
○ Strategic Model Architecture — $6,000 — Upcoming
○ Application Architecture — $6,000 — Upcoming
○ Final Blueprint — $12,000 — Upcoming

Client should be able to open an invoice and see:
- why the invoice exists
- what milestone it corresponds to
- amount
- due date
- status
- payment link

Recommended future payment processor: Stripe.

In MVP, architect the database so Stripe can be added cleanly, but do not store raw card data.

---

# 11. EXECUTIVE REVIEW MODE

Create a structured review experience for leadership sessions.

Review agenda should support:
- development objective
- current architecture
- major findings
- critical gaps
- applied strategic models
- dependencies
- proposed architecture
- decision points
- risks
- implementation sequence

Client actions during review:
- approve
- approve with comments
- request revision
- defer
- assign decision owner

Every review action must be recorded.

---

# 12. DELIVERABLE SYSTEM

Deliverables should be generated from structured project data where possible.

Core deliverables:
- Full Architecture Blueprint
- Executive Strategy Deck
- Capability Map
- Implementation Framework
- Measurement Model
- Executive Summary

Each deliverable should have:
- version
- status
- generated date
- author
- approval status
- file or rendered output
- linked source architecture objects

Statuses:
- draft
- internal review
- client review
- approved
- superseded

---

# 13. IMPLEMENTATION TRACKING

The platform must preserve the line between architecture and operational execution.

Implementation tracking should focus on whether architecture has been adopted.

Statuses:
- Designed
- Accepted
- Implementation Started
- Operational
- Validated

Implementation item fields:
- linked architecture object
- owner
- target date
- current status
- evidence
- blockers
- notes

This is not intended to become a full general-purpose task manager.

---

# 14. METHOD & INTELLECTUAL PROPERTY SYSTEM

Create a private internal Method Library.

Client users must never access this system directly.

Categories:
- diagnostic frameworks
- architecture taxonomies
- question libraries
- templates
- strategic models
- decision frameworks
- research protocols
- capability taxonomies
- system-design patterns
- measurement frameworks
- governance patterns
- risk frameworks
- AI prompts
- blueprint structures

Each asset should include:
- title
- category
- version
- status
- owner
- description
- usage instructions
- applicable sectors
- related methodology domain
- source/origin
- IP classification

---

# 15. IP CLASSIFICATION & LINEAGE

Every significant object/document should include a classification.

Recommended classifications:
- TPLCo Method IP
- Client Confidential
- Client-Owned Source Material
- Project Work Product
- Public Source
- Licensed Third-Party Source
- Generated Analysis

The system should retain object lineage where feasible:
- source
- created by
- created from
- project
- method asset used
- date

This is essential for protecting methodology while clearly separating client ownership.

---

# 16. PATTERN LIBRARY

Allow internal architects to convert non-confidential structural learning into reusable patterns.

Pattern examples:
- New Initiative Pattern
- New Division Pattern
- New Product Line Pattern
- Economic Development Initiative Pattern
- University Program Pattern
- Nonprofit Expansion Pattern
- Commercial Development Pattern

Pattern fields:
- title
- pattern type
- architecture domains
- common capabilities
- common risks
- common dependencies
- common governance structures
- applicability conditions
- exclusions
- linked anonymized lessons

No client-confidential content should be copied into patterns.

---

# 17. PORTFOLIO INTELLIGENCE

Internal-only dashboard.

Metrics may include:
- active engagements
- engagements by type
- engagements by sector
- total contracted revenue
- collected revenue
- outstanding revenue
- average project duration
- architecture stage distribution
- recurring capability gaps
- recurring risks
- frequently applied models
- reusable patterns created
- deliverable approval times

Do not expose cross-client data to client users.

---

# 18. ARCHITECTURE INTELLIGENCE (POST-MVP)

AI should sit underneath the methodology, not replace it.

Future capabilities:
- summarize evidence
- identify knowledge gaps
- identify unsupported assumptions
- identify architecture contradictions
- suggest relevant internal models
- detect missing capabilities
- analyze dependencies
- prepare executive review briefs
- draft deliverables from structured project data
- run structural coherence analysis

The system must always distinguish:
- source evidence
- architect judgment
- AI-generated analysis
- client decision

---

# 19. STRUCTURAL COHERENCE ENGINE (FUTURE)

Future premium capability.

Evaluate relationships such as:
- strategy ↔ capability
- capability ↔ operations
- operations ↔ objectives
- governance ↔ responsibility
- metrics ↔ intended outcomes
- knowledge ↔ decisions

Surface:
- contradictions
- missing dependencies
- unsupported assumptions
- governance conflicts
- measurement gaps
- implementation drift

Potential future output:
- Structural Coherence Report

---

# 20. METHOD VERSIONING

Method assets should support versioning.

Examples:
- DAM 1.0
- DAM 1.1
- DAM 2.0

Track:
- version number
- effective date
- change summary
- author
- impacted templates
- impacted engagements

Each engagement should record the methodology version used.

---

# 21. CERTIFICATION / LICENSING (FUTURE)

Do not build in MVP, but preserve architectural room for:
- Certified Development Architect accounts
- licensing organizations
- license status
- method access level
- continuing education
- authorized templates
- usage tracking
- method updates
- renewal dates

The eventual goal is to allow licensed practitioners to use the Development Architecture Method™ through the platform without exposing internal system administration.

---

# 22. MVP SCOPE

The first production-capable version should focus on delivering actual TPLCo client engagements.

## Build in MVP

### Foundation
- authentication
- organizations
- user profiles
- role-based access
- engagements
- team assignments

### Engagement Management
- engagement setup
- project objective
- engagement type
- timeline
- current phase
- client team
- internal team

### Architecture Core
- four architecture domains
- structured architecture objects
- object relationships
- architecture status

### Project Intelligence
- evidence
- assumptions
- risks
- dependencies
- decisions

### Client Portal
- overview dashboard
- architecture progress
- decisions/actions
- documents
- deliverables
- billing snapshot

### Financial System
- contracts
- payment schedules
- milestones
- invoices
- payments
- balances
- change orders

### Reviews
- executive review records
- approvals
- comments

### Method/IP Foundation
- internal-only method assets
- IP classification
- method version field

### Auditability
- created_at
- updated_at
- created_by
- key activity history

---

# 23. DO NOT BUILD IN FIRST MVP

Do not build yet:
- certification portal
- external licensed architect marketplace
- advanced portfolio analytics
- full AI coherence engine
- complex graph visualization
- native mobile apps
- in-app video conferencing
- full accounting ledger
- payroll
- CRM marketing automation
- generalized task/project management
- real-time collaborative whiteboard
- custom payment processing

Design interfaces so these can be added later.

---

# 24. RECOMMENDED TECHNICAL STACK

Recommended starting stack:

## Frontend
- Next.js
- TypeScript
- React
- Tailwind CSS
- component library such as shadcn/ui

## Backend / Database
- Supabase
  - PostgreSQL
  - Auth
  - Row Level Security
  - Storage
  - Realtime only where justified

## Deployment
- Vercel

## Payments
- Stripe (integration after financial data model is stable)

## File Storage
- Supabase Storage initially

## Validation
- Zod

## Forms
- React Hook Form

## Data access
Prefer typed server-side database access and explicit authorization checks.

## Charts / Visualizations
Use a lightweight chart library only where needed.

Avoid adding unnecessary dependencies.

---

# 25. SECURITY REQUIREMENTS

This application will hold confidential client strategy, financial data, and intellectual property.

Required principles:
- tenant isolation by organization/project
- Supabase Row Level Security
- least-privilege access
- secure server-side financial calculations
- no raw card storage
- secure environment variables
- role-based authorization
- audit trails for high-value actions
- private storage buckets for client documents
- protected method/IP content
- no cross-client data leakage

Never rely on frontend hiding alone for authorization.

---

# 26. INITIAL DATABASE MODEL

This is a starting architecture, not an immutable schema.

## users / profiles
- id
- auth_user_id
- first_name
- last_name
- email
- status
- created_at

## organizations
- id
- name
- type [tplco, client, licensed_practice_future]
- status
- created_at

## organization_members
- id
- organization_id
- user_id
- role
- status

## engagements
- id
- client_organization_id
- title
- slug
- engagement_type
- objective
- description
- methodology_version
- status
- current_phase
- start_date
- target_end_date
- original_contract_value
- revised_contract_value
- created_by
- created_at

## engagement_members
- id
- engagement_id
- user_id
- side [internal, client]
- role
- permissions_override_json

## architecture_objects
- id
- engagement_id
- domain [knowledge, capability, strategic_model, application]
- object_type
- title
- description
- status
- maturity_state
- owner_user_id
- client_visible
- ip_classification
- metadata_json
- created_by
- created_at
- updated_at

## architecture_relationships
- id
- engagement_id
- source_object_id
- target_object_id
- relationship_type
- description

## evidence_sources
- id
- engagement_id
- title
- source_type
- source_url
- storage_path
- summary
- confidentiality
- ip_classification
- created_by

## object_evidence_links
- id
- architecture_object_id
- evidence_source_id
- relationship_type

## assumptions
- id
- engagement_id
- statement
- category
- confidence
- validation_status
- impact_if_false
- owner_user_id

## risks
- id
- engagement_id
- title
- description
- category
- probability
- impact
- severity
- mitigation
- owner_user_id
- status

## dependencies
- id
- engagement_id
- source_object_id
- target_object_id
- dependency_type
- blocking
- status
- owner_user_id

## decisions
- id
- engagement_id
- title
- context
- evidence_summary
- recommendation
- client_decision
- decision_status
- decision_owner_user_id
- decided_at

## decision_options
- id
- decision_id
- title
- description
- tradeoffs

## client_actions
- id
- engagement_id
- title
- description
- assigned_to_user_id
- action_type
- due_date
- status

## executive_reviews
- id
- engagement_id
- title
- review_date
- status
- summary
- created_by

## review_items
- id
- executive_review_id
- item_type
- linked_object_id
- status
- client_response
- notes

## deliverables
- id
- engagement_id
- deliverable_type
- title
- version
- status
- storage_path
- client_visible
- approval_status
- generated_at

## contracts
- id
- engagement_id
- original_contract_value
- executed_date
- payment_structure
- deposit_amount
- storage_path
- status

## payment_milestones
- id
- engagement_id
- contract_id
- title
- description
- amount
- due_date
- related_phase
- trigger_type
- status

## invoices
- id
- engagement_id
- payment_milestone_id
- invoice_number
- amount
- issue_date
- due_date
- status
- payment_url
- external_processor_id

## payments
- id
- invoice_id
- amount
- payment_date
- payment_method
- external_transaction_id
- receipt_url

## change_orders
- id
- engagement_id
- title
- description
- scope_impact
- schedule_impact
- fee_impact
- status
- approved_at

## method_assets
- id
- title
- category
- methodology_domain
- version
- status
- description
- usage_instructions
- applicable_sectors
- ip_classification
- owner_user_id

## activity_log
- id
- organization_id
- engagement_id
- actor_user_id
- action_type
- entity_type
- entity_id
- metadata_json
- created_at

---

# 27. PERMISSIONS MODEL

Authorization must account for:

1. organization membership
2. engagement membership
3. internal vs client side
4. assigned role
5. object client_visibility
6. financial visibility
7. method/IP protection

Rules:

- Client users only access engagements tied to their organization.
- Client contributors only see allowed/assigned content.
- Client finance users can see billing but need not see all architecture content.
- Client viewers cannot edit.
- No client user can access method_assets.
- Internal researchers should not automatically receive financial admin permissions.
- Finance administrators should not require architecture editing rights.
- Only authorized internal roles can mark content as reusable IP.

Use database-level RLS wherever feasible.

---

# 28. NAVIGATION

## Internal Navigation

Dashboard

Clients
- Organizations
- Contacts

Engagements
- Active
- Upcoming
- Completed

Architecture
- Knowledge
- Capability
- Strategic Models
- Application

Intelligence
- Evidence
- Assumptions
- Risks
- Dependencies
- Decisions

Reviews

Deliverables

Finance
- Contracts
- Milestones
- Invoices
- Payments
- Change Orders

Method Library

Portfolio

Settings

---

## Client Navigation

Overview

Architecture

Decisions

Actions

Reviews

Documents

Implementation

Billing

Messages

---

# 29. DESIGN DIRECTION

The experience should feel:
- institutional
- architectural
- premium
- calm
- structured
- executive-level
- intellectually rigorous

Avoid:
- playful SaaS appearance
- excessive gradients
- gamification
- childish progress systems
- generic kanban-first design
- visual clutter

Use strong hierarchy, whitespace, structured cards, timelines, diagrams, tables, and restrained visual indicators.

The UI should reinforce the idea that the client is inside an architecture environment.

---

# 30. FIRST IMPLEMENTATION PHASE

Claude Code should begin only with Phase 1.

## Phase 1 Goal
Create the safe technical foundation and a working engagement shell.

Build:
1. Next.js + TypeScript application
2. Supabase integration
3. Authentication
4. Organizations
5. User profiles
6. Organization membership
7. Role model
8. Engagement CRUD
9. Engagement membership
10. Basic internal dashboard
11. Basic client dashboard shell
12. RLS foundation
13. Seed/demo data
14. README
15. environment example file
16. architecture documentation

Do not build the full architecture workspace yet.
Do not build Stripe yet.
Do not build AI yet.

At the end of Phase 1, confirm that:
- an internal user can create a client organization
- an internal user can create an engagement
- users can be assigned to an engagement
- a client user only sees their own engagement
- a client user cannot access Method/IP areas
- the repository is isolated from Peephole

---

# 31. PHASE SEQUENCE

## Phase 1 — Foundation
Auth, organizations, roles, engagements, access control.

## Phase 2 — Commercial Engagement System
Contracts, payment schedules, milestones, invoices, payments, change orders, billing dashboard.

## Phase 3 — Architecture Core
Four architecture domains, architecture objects, relationships, maturity states.

## Phase 4 — Project Intelligence
Evidence, assumptions, risks, dependencies, decisions, actions.

## Phase 5 — Client Experience
Reviews, approvals, deliverables, implementation visibility, polished client dashboard.

## Phase 6 — Method/IP System
Method Library, templates, IP lineage, versioning, pattern library.

## Phase 7 — Architecture Intelligence
AI-assisted analysis, research support, coherence checks.

## Phase 8 — Portfolio Intelligence
Cross-engagement intelligence and internal metrics.

## Phase 9 — Certification/Licensing
Licensed Development Architect environment.

---

# 32. ENGINEERING RULES FOR CLAUDE CODE

- Work in small, testable increments.
- Before major schema changes, explain the proposed change.
- Never modify unrelated files without reason.
- Never connect to Peephole infrastructure.
- Use TypeScript strict mode.
- Prefer clear domain naming over abbreviations.
- Keep business logic out of UI components where practical.
- Use migrations for database changes.
- Build authorization into the data layer.
- Maintain seed/demo data for development.
- Keep README current.
- Record architecture decisions in `/docs/architecture-decisions/`.
- Do not add dependencies without justification.
- Do not attempt future phases unless explicitly instructed.
- At the end of each phase, summarize:
  - what was built
  - files changed
  - schema changes
  - tests performed
  - security considerations
  - unresolved questions
  - recommended next step

---

# 33. DEFINITION OF SUCCESS FOR MVP

The MVP succeeds when TPLCo can run a real client architecture engagement through the platform and the client can:

- log in securely
- understand where the engagement stands
- see the four architecture domains
- respond to decisions and requests
- review deliverables
- understand what they owe
- see what they have paid
- see upcoming obligations
- access approved project documentation

And TPLCo can:

- structure the engagement
- architect the initiative
- preserve evidence and decisions
- protect proprietary methodology
- maintain financial visibility
- generate consistent deliverables
- retain reusable non-confidential structural knowledge

---

# 34. FIRST CLAUDE CODE PROMPT

Paste the following into Claude Code after creating and entering the new `development-architecture-os` repository.

---

You are helping build a new standalone application called **Development Systems Architecture OS (DSA OS)** for The Purple Lamb Company.

This application is completely independent from another product called Peephole. **Do not inspect, reference, connect to, copy from, or modify the Peephole repository or any Peephole infrastructure.** This project must maintain its own repository, dependencies, environment variables, database, and deployment configuration.

The product is the digital operating environment for a professional methodology called the **Development Architecture Method™**. It is designed to help TPLCo conduct Development Systems Architecture engagements across four domains:

1. Knowledge Architecture
2. Capability Architecture
3. Strategic Model Architecture
4. Application Architecture

The long-term application will include client project environments, architecture workspaces, structured project intelligence, engagement financials, method/IP management, portfolio intelligence, and eventually certification/licensing.

However, **do not attempt to build the entire platform now.**

First, read `DSA_OS_MASTER_BUILD_SPEC.md` in this repository and use it as the primary product specification.

Then build **Phase 1 — Foundation only**.

Phase 1 must include:

1. Next.js + TypeScript application foundation
2. Tailwind CSS and a restrained executive UI foundation
3. Supabase integration
4. Authentication
5. User profiles
6. Organizations
7. Organization membership
8. Role-based access model
9. Engagement CRUD
10. Engagement membership
11. Internal dashboard shell
12. Client dashboard shell
13. Initial Row Level Security policies
14. Seed/demo data
15. `.env.example`
16. README with setup instructions
17. `/docs/architecture-decisions/` for technical ADRs

Roles to support initially:

Internal:
- System Administrator
- Principal Architect
- Architect
- Researcher
- Project Administrator
- Finance Administrator

Client:
- Executive Sponsor
- Client Project Lead
- Client Finance
- Client Contributor
- Client Viewer

Security requirements:
- client users may only access engagements belonging to their organization
- tenant isolation must be enforced at the database layer where feasible
- no client role may access internal Method/IP content
- frontend visibility must never be the only authorization mechanism

Do not build yet:
- Stripe
- invoices
- architecture objects
- AI features
- method library UI
- certification
- advanced portfolio analytics

Before writing significant code:

1. Inspect the empty/new repository.
2. Read the master build specification.
3. Propose the Phase 1 folder structure.
4. Propose the initial Supabase schema and RLS strategy.
5. Identify any decisions you need from me.
6. Wait for my approval before making broad architectural choices that would be expensive to reverse.

Then proceed incrementally.

At the end of Phase 1, provide:
- implementation summary
- schema summary
- security/RLS summary
- files created or changed
- setup steps
- tests/checks performed
- known limitations
- recommended Phase 2 plan

The product should feel institutional, architectural, premium, calm, and executive-level. Avoid generic project-management aesthetics, gamification, visual clutter, or playful SaaS styling.

---

# 35. INITIAL REPOSITORY FILES

Recommended:

```text
development-architecture-os/
├── CLAUDE.md
├── DSA_OS_MASTER_BUILD_SPEC.md
├── README.md
├── docs/
│   ├── product/
│   ├── architecture-decisions/
│   └── database/
├── src/
├── supabase/
│   ├── migrations/
│   └── seed.sql
└── .env.example
```

---

# 36. CLAUDE.md PURPOSE

Create a concise `CLAUDE.md` that tells Claude Code:
- what DSA OS is
- that Peephole is off-limits
- current phase
- key engineering rules
- how to treat the master spec
- current approved stack
- security requirements

Keep the full product definition in this master build specification rather than duplicating everything in `CLAUDE.md`.

---

# END
