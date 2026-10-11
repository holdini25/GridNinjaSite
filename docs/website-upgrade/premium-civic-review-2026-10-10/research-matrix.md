# Research matrix for the civic website direction

Reviewed **10 October 2026**. Status: review/design specification, not website implementation or publication approval. Companion: [research-catalog.example.ts](research-catalog.example.ts). Seven journal publications were checked against publisher or author-institution records; Crossref metadata was used to reconcile bibliographic fields. This is a targeted source review, not a reproduction of the research or a systematic literature review.

## Recommendation and exact homepage notes

Feature three complementary findings: demonstrated bounded flexibility, the conditions governing its benefits, and local water responsibility. Keep all three together in a quiet **Research informing the direction** strip. Journal names are text citations, not partner logos. Each note must retain its adjacent limitation and descriptive source link; the limitation cannot be hidden behind hover or a collapsed drawer. These are proposed copy strings for a later implementation, not existing public claims.

| Order / catalog ID | Exact note | Required adjacent limitation | Source label |
| --- | --- | --- | --- |
| 1 / `colangelo-grid-assets-2026` | A 256-GPU field trial demonstrated bounded power reduction while preserving the tested service requirements. | External research on one cluster; not a GridNinja result or a whole-site guarantee. | [Nature Energy · 2026](https://www.nature.com/articles/s41560-025-01927-1) |
| 2 / `senga-flexibility-tradeoffs-2026` | Power-system modeling finds that flexibility can lower system costs while emissions depend on the regional generation mix. | Emissions increased in some modeled settings. Household bill savings and GridNinja economics are not established. | [iScience · 2026](https://www.sciencedirect.com/science/article/pii/S2589004226018729) |
| 3 / `siddik-water-footprint-2021` | U.S. research links data-center water impacts to cooling, electricity generation, and local water stress. | Historical spatial modeling; not a current inventory or a site-specific water assessment. | [Environmental Research Letters · 2021](https://escholarship.org/uc/item/3xw3z2qp) |

The strip footer must read: **“External research informs the direction. GridNinja currently offers bounded assessments using authorized historical inputs.”** The full research list belongs at `/evidence#research`, in a clearly separated external-research section on the existing Evidence page. A nearby **Read the research and its limits** link points there; Methodology crosslinks may supplement it, but cannot be the sole or gated destination. The assessment CTA remains **Scope an assessment**, with **See a sample decision brief** secondary. Do not add research metrics to the synthetic brief, change its immutable versions, or suggest accepted/delivered capacity, estimated economics, live controls, grid dispatch, water savings, or heat delivery.

## Claim-to-source matrix

All seven entries are published, peer-reviewed journal research rather than preprints. Publication status and the depth of this review are distinct. “Peer reviewed” does not mean independently replicated, unbiased, universally applicable, or validated for GridNinja.

| Stable ID | Method and setting | Narrow sentence suitable for supporting copy | Principal limit | Intended existing placement |
| --- | --- | --- | --- | --- |
| `colangelo-grid-assets-2026` | Field demonstration; one 256-GPU cluster, representative AI workloads, Phoenix, Arizona | An external field trial shows that eligible AI workloads can provide bounded power flexibility while meeting the tested service requirements. | Selected cluster and workloads; no campus-wide guarantee, GridNinja result, or measured community benefit. | Homepage research strip; `/evidence#research`; `/why-gridninja` |
| `senga-flexibility-tradeoffs-2026` | Power-system investment/dispatch modeling; Texas, Mid-Atlantic, Western Interconnection | In modeled U.S. power systems, temporal flexibility lowered system costs, while emissions outcomes depended on regional conditions. | Model scenarios; flexibility is treated as cost-free. System costs are not household bills or site economics. | Homepage research strip; `/evidence#research`; `/methodology` |
| `siddik-water-footprint-2021` | Bottom-up spatial footprint modeling; U.S. data centers, watersheds and electricity supply | Water responsibility requires considering both site cooling and the electricity supply in their local resource context. | Historical estimates; no present-day inventory or individual site's hydrological conclusion. | Homepage research strip; `/methodology`; `/about` |
| `radovanovic-carbon-aware-2023` | Production-system evaluation; Google's distributed data-center fleet | Production research shows that temporally flexible computing can be scheduled around carbon signals while preserving a daily completion objective. | Workload eligibility, forecasts and probabilistic requirements matter; no blanket SLA or grid-service guarantee. | `/solutions/ai-cloud`; `/platform`; `/methodology` |
| `heering-public-support-2026` | Vignette and conjoint survey experiments; Germany, surveyed July 2025 | In a German survey experiment, power prices, water strain, energy sources and operator ownership influenced preferences over data-center proposals. | Stated preferences in Germany; ownership was especially influential. Not evidence of U.S. consent or marketing conversion. | `/about`; supporting existing `/insights` material |
| `wahlroos-heat-reuse-2017` | District-heating simulation using actual plant/heat-demand records from 2013 and 2015; Espoo, Finland | A Finnish case study shows how data-center waste heat can contribute to district heating when the local system and commercial conditions fit. | Conditional ecosystem opportunity; no transferable economics or shipped GridNinja heat capability. | `/about`; supporting existing `/insights` material; no new top-level page |
| `wabersich-safety-filter-2021` | Control theory with pendulum and quadrotor simulations; no geographic deployment | Safety-filter research separates proposed actions from constraint checks that can modify an action before execution. | Model-dependent guarantees; no data-center field validation or GridNinja safety certification. | `/proof`; `/methodology`; `/platform/dispatch-envelope` |

## Full bibliography, verification and access

### 1. Grid flexibility field evidence

**Philip Colangelo, Ayse K. Coskun, Jack Megrue, Ciaran Roberts, Shayan Sengupta, Varun Sivaram, Ethan Tiao, Aroon Vijaykar, Chris Williams, Daniel C. Wilson, Brandon Records, Zack MacFarland, Daniel Dreiling, Nathan Morey, Anuja Ratnayake, and Baskar Vairamohan.** “AI data centres as grid-interactive assets.” *Nature Energy* **11**(2), 254–261 (**2026**). DOI: [10.1038/s41560-025-01927-1](https://doi.org/10.1038/s41560-025-01927-1).

- **Dates/status:** Online 5 December 2025; February 2026 issue. Publisher identifies a version of record and explicitly acknowledges peer reviewers. Use 2026 in the volume-based citation, optionally adding “online 2025.” The DOI's 2025 is not the issue year.
- **Verified basis:** Publisher abstract, bibliographic metadata, affiliations and competing-interest statement; Crossref corroborates title, authors, volume, issue, pages and online date. Abstract reports 25% lower cluster power over three hours with the stated quality requirements maintained. That percentage is excluded from the homepage note to avoid transplanting an external result.
- **Access/depth:** Public publisher material was inspected. Complete experimental methods, supplements, raw data and code were not independently audited. A download link does not establish unrestricted commercial figure rights.
- **Independence:** Emerald AI led the work. Disclosed employment, equity and pending-patent interests matter. Neither journal citation nor collaborator names imply a GridNinja partnership or endorsement.
- **Primary record:** [Nature Energy article](https://www.nature.com/articles/s41560-025-01927-1).

### 2. Grid-system value and emissions tradeoffs

**Juan Ramon L. Senga, Shen Wang, and Christopher R. Knittel.** “Flexible data centers reduce power system costs but can increase emissions.” *iScience* **29**(7), 116497 (**2026**). DOI: [10.1016/j.isci.2026.116497](https://doi.org/10.1016/j.isci.2026.116497).

- **Dates/status:** Published journal article, July 2026 issue. [PubMed](https://pubmed.ncbi.nlm.nih.gov/42491471/) indexes online publication as 26 June 2026 and collection date as 17 July. The exact online day was not independently confirmed in accessible primary metadata; the example catalog leaves that field null and records the uncertainty rather than silently promoting it to verified primary metadata.
- **Verified basis:** Publisher summary, results, discussion and model-assumption text support the bounded claim. Regional generation mix determines whether load shifting favors cleaner supply or more fossil generation. The cost-free flexibility assumption limits commercial interpretation.
- **Access/depth:** ScienceDirect publicly indexed article sections were reviewed; direct HTML/Cell access returned 403 in this session. Complete supplements and model files were not audited. No universal numerical savings claim is approved here.
- **Primary records:** [Publisher article](https://www.sciencedirect.com/science/article/pii/S2589004226018729); [MIT research context](https://mitsloan.mit.edu/centers-initiatives/climate-policy-center/improving-electric-grid). Crossref corroborates three authors, title, journal, issue and article number. Use this journal version, not an earlier working paper, for a peer-reviewed label.

### 3. Local water impacts

**Md Abu Bakar Siddik, Arman Shehabi, and Landon Marston.** “The environmental footprint of data centers in the United States.” *Environmental Research Letters* **16**(6), 064017 (**2021**). DOI: [10.1088/1748-9326/abfba1](https://doi.org/10.1088/1748-9326/abfba1).

- **Dates/status:** Accepted 26 April 2021; published online 21 May 2021; June 2021 issue. The institution-hosted journal PDF provides article history; Crossref confirms the dates and citation.
- **Verified basis:** Journal abstract/header and university publication record establish a spatial bottom-up analysis of direct cooling and electricity-related footprints and their relation to water stress. The paper's historical percentages are deliberately not reused as current facts.
- **Access/depth:** Public institutional version-of-record PDF and abstract available; complete inputs and geospatial calculations were not reproduced. The PDF identifies CC BY 4.0, but this specification authorizes text attribution and linking only, not figure reuse.
- **Primary records:** [Institutional record](https://escholarship.org/uc/item/3xw3z2qp); [journal PDF hosted by the institution](https://escholarship.org/content/qt3xw3z2qp/qt3xw3z2qp.pdf); [publisher](https://iopscience.iop.org/article/10.1088/1748-9326/abfba1).

### 4. Carbon-aware workload scheduling

**Ana Radovanović, Ross Koningstein, Ian Schneider, Bokan Chen, Alexandre Duarte, Binz Roy, Diyue Xiao, Maya Haridasan, Patrick Hung, Nick Care, Saurav Talukdar, Eric Mullen, Kendal Smith, MariEllen Cottman, and Walfredo Cirne.** “Carbon-Aware Computing for Datacenters.” *IEEE Transactions on Power Systems* **38**(2), 1270–1280 (**2023**). DOI: [10.1109/TPWRS.2022.3173250](https://doi.org/10.1109/TPWRS.2022.3173250).

- **Dates/status:** Published online 6 May 2022; March 2023 issue. The IEEE journal record is the peer-reviewed citation, not the 2021 arXiv manuscript. Crossref verifies the complete author list and issue metadata.
- **Verified basis:** IEEE abstract describes production deployment of forecast-informed hourly capacity limits for eligible, temporally flexible workloads while preserving daily capacity and a high-probability completion objective.
- **Access/depth:** IEEE abstract and metadata were reviewed. A university-hosted PDF was indexed but direct retrieval failed; full methods, fleet-level results and implementation were not audited. Publisher shows a Creative Commons designation; exact figure permissions were not verified.
- **Primary record:** [IEEE Xplore article](https://ieeexplore.ieee.org/abstract/document/9770383). Authors describe their employer's production system; this is external operator evidence, not independent validation of GridNinja.

### 5. Community preferences

**Jonas Heering and Erik Voeten.** “How sovereign control, decarbonization and energy costs shape public support for data centers.” *Nature Communications* **17**, 9576 (**2026**). DOI: [10.1038/s41467-026-76500-9](https://doi.org/10.1038/s41467-026-76500-9).

- **Dates/status:** Published 10 August 2026, confirmed by publisher metadata and Crossref. Publisher explicitly acknowledges reviewers and links a peer-review file. A secondary index's generic December date is not used.
- **Verified basis:** Public abstract, results, discussion and methods identify German vignette/conjoint experiments fielded July 2025. Electricity-price effects, water strain, generation source and provider nationality affected stated preferences. The latter was especially influential and cannot be omitted when interpreting the paper.
- **Access/depth:** Public full-text sections were inspected; survey microdata, code and peer-review correspondence were not reanalyzed. Authors declare no competing interests.
- **Primary record:** [Nature Communications article](https://www.nature.com/articles/s41467-026-76500-9). This is research about conditional preferences, not a community endorsement, US permitting forecast, or test of GridNinja copy.

### 6. Conditional heat-reuse opportunity

**Mikko Wahlroos, Matti Pärssinen, Jukka Manner, and Sanna Syri.** “Utilizing data center waste heat in district heating – Impacts on energy efficiency and prospects for low-temperature district heating networks.” *Energy* **140**, 1228–1238 (**2017**). DOI: [10.1016/j.energy.2017.08.078](https://doi.org/10.1016/j.energy.2017.08.078).

- **Dates/status:** Accepted 16 August 2017; available online 29 August; issue publication 1 December 2017. The Aalto-hosted journal PDF identifies its version of record and article history.
- **Verified basis:** Abstract and introductory methodological sections describe simulation using actual Espoo plant/heat-demand records from 2013 and 2015, plus an existing data-center load profile. Local heat demand, network compatibility, recovery equipment and bilateral economics govern applicability.
- **Access/depth:** Institution-hosted full PDF was accessible; targeted sections reviewed. Underlying simulation was not rerun. Its CC BY-NC-ND notice does not authorize republishing or adapting figures on a commercial site.
- **Authorship resolution:** The journal title page, article-specific Aalto record and Crossref all list four authors. A separate dissertation record inconsistently adds Samuli Rinne; do not propagate that listing.
- **Primary records:** [Aalto article record](https://aaltodoc.aalto.fi/items/12e423b5-3275-4713-a068-ef3813225666); [version-of-record PDF](https://acris.aalto.fi/ws/portalfiles/portal/17305461/1_s2.0_S0360544217314548_main.pdf).

### 7. Runtime-assurance research foundation

**Kim Peter Wabersich and Melanie N. Zeilinger.** “A predictive safety filter for learning-based control of constrained nonlinear dynamical systems.” *Automatica* **129**, 109597 (**2021**). DOI: [10.1016/j.automatica.2021.109597](https://doi.org/10.1016/j.automatica.2021.109597).

- **Dates/status:** Published journal article, July 2021 issue. Exact initial online date was not verified; the catalog leaves it null. The 2018 arXiv upload date is not the journal publication year. Crossref corroborates the citation and two authors.
- **Verified basis:** Publisher abstract, introduction and conclusion describe an action-filtering framework based on predictive control and uncertainty assumptions, illustrated with pendulum and quadrotor simulations.
- **Access/depth:** Public publisher preview inspected; full proof details and experiment files were not audited. Some full content requires subscription access. No claim of a formal guarantee for GridNinja follows from the citation.
- **Primary record:** [Automatica article](https://www.sciencedirect.com/science/article/pii/S0005109821001175). Present as a research foundation for the development direction, not as data-center field evidence or certification.

## Publication contract and unresolved work

- The companion TypeScript file is a documentation example only. It is not imported by the site and does not change the claim registry. Future publication maps each external research sentence to the appropriate stable research-catalog ID and keeps the cited setting and limitation visible. Only actual GridNinja product or outcome claims use the existing GridNinja PublicClaim registry; external results must not be encoded as GridNinja maturity, environment or outcome evidence. Human editorial review must cover the surrounding copy.
- Preserve complete citations in the server-rendered `/evidence#research` section, clearly separate from GridNinja publication evidence, with descriptive outbound links. The matrix's additional placements are contextual crosslinks, not substitutes for this accessible full list. Use plain-text journal/year labels, not badges, fabricated quotations, research logos or partner marks. Each source has a stable ID; citation numbering is presentation, not identity.
- Contextual placements apply only to already public destinations. The currently gated `/insights/safe-data-center-grid-flexibility` route is excluded from this handoff's links; promotion of any gated page requires separate review and authorization. Research citations must not change resource visibility, expose withheld material or create a broken link. `/evidence#research` is the canonical full-list destination.
- Recheck links, corrections/retractions, current version metadata and access before public release. This session did not conduct a dedicated correction/retraction database audit or inspect every supplement. Do not infer “no corrections” from a normal DOI response.
- Exact iScience online date awaits primary confirmation; Automatica online day remains unverified. These gaps do not prevent accurate year/volume citations and are represented as unknown values.
- No source establishes GridNinja customer outcomes, community consent, water savings, household-bill reductions, heating service, accepted/delivered capacity, safe autonomous deployment or commercial value. Heat reuse remains a possible ecosystem pathway. Community citizenship is a proposed commitment to measurable local obligations, not an outcome already earned.
- Reports, company announcements, working papers and arXiv manuscripts may provide separately labeled context, but must not inherit the peer-reviewed label from this catalog. No paper figures, raw data or publisher PDFs have been added to the repository or `public/`.
