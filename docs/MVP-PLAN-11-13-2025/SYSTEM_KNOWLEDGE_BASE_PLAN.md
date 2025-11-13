# System Knowledge Base Plan - IDEA Brand Coach
## Shared Expert Knowledge (Trevor's Book + Marketing Frameworks)

**Version:** 2.0
**Last Updated:** 2025-11-13
**Status:** Planning Phase

---

## Executive Summary

This document outlines the strategy for building the **System Knowledge Base** - the shared expert knowledge that powers the IDEA Brand Coach RAG system. This is ONE of TWO knowledge bases:

**1. System Knowledge Base (This Document) - SHARED**
- Trevor's proprietary book + marketing framework syntheses
- Shared across ALL users
- OpenAI Vector Stores (5 domain-specific stores)

**2. User Knowledge Base (Separate) - PER-USER ISOLATED**
- User's diagnostic results + uploaded documents
- Strictly isolated by user_id
- PostgreSQL with RLS (see SYSTEM_USER_KNOWLEDGE_BASE_SEPARATION_GUIDE.md)

**Key Principles:**
- ✅ **Full Rights**: Trevor's book (PDF upload with full IP rights)
- ✅ **Curated Insights**: Key concepts from marketing classics (synthesized, not copied)
- ✅ **Legal Compliance**: No direct PDF copying of copyrighted materials
- ✅ **Structured Organization**: 5 domain-specific vector stores matching prompt architecture
- ✅ **Shared Resource**: All users access same expert knowledge (no duplication)

---

## System Knowledge Base Architecture

### Integration with Dual-KB Design

The System KB provides expert guidance (Trevor + marketing frameworks) that is retrieved alongside User KB (personalized context) at runtime.

**System KB: 5 Domain-Specific Vector Stores (SHARED)**

```
System Vector Store Architecture:
├─ vs_system_diagnostic (10,000 docs, 5GB) [SHARED]
│  ├─ Trevor's book chapters on assessment
│  ├─ SWOT framework syntheses
│  └─ Brand audit methodologies
├─ vs_system_avatar (8,000 docs, 4GB) [SHARED]
│  ├─ Trevor's customer profiling methods
│  ├─ Persona development frameworks
│  └─ Market segmentation insights
├─ vs_system_canvas (7,000 docs, 3.5GB) [SHARED]
│  ├─ Business model frameworks (Osterwalder synthesis)
│  ├─ Trevor's business strategy guidance
│  └─ Revenue model patterns
├─ vs_system_capture (12,000 docs, 6GB) [SHARED]
│  ├─ Trevor's content strategy chapters
│  ├─ Marketing framework syntheses
│  └─ Campaign planning methodologies
└─ vs_system_core (5,000 docs, 2.5GB) [SHARED]
   ├─ Trevor's brand foundation philosophy
   ├─ Mission/vision development frameworks
   └─ Brand storytelling principles
```

**Note**: This is the SYSTEM knowledge base only. User-specific context (diagnostic results, uploaded documents) is stored separately in the User Knowledge Base. See [SYSTEM_USER_KNOWLEDGE_BASE_SEPARATION_GUIDE.md](./SYSTEM_USER_KNOWLEDGE_BASE_SEPARATION_GUIDE.md) for complete architecture.

---

## Source Materials Strategy

### Tier 1: Trevor's Book (Full IP Rights)

**Status:** Primary authoritative source with full reproduction rights

**Upload Process:**

1. **PDF Preparation:**
   - File format: Trevor's book in PDF format
   - Size limit: Up to 512MB per file (OpenAI limit)
   - Recommendation: Split into chapters if total > 512MB

2. **Upload Instructions:**

   ```bash
   # Option A: Via OpenAI Python SDK
   from openai import OpenAI
   client = OpenAI()

   # Upload Trevor's book
   file = client.files.create(
       file=open("trevors_book.pdf", "rb"),
       purpose="assistants"
   )

   print(f"File uploaded: {file.id}")
   ```

   ```bash
   # Option B: Via OpenAI Dashboard (Recommended for first upload)
   1. Log into platform.openai.com
   2. Navigate to "Storage" → "Files"
   3. Click "Upload file"
   4. Select Trevor's book PDF
   5. Set purpose: "assistants"
   6. Note the returned file_id
   ```

3. **Chunking Strategy:**
   - Let OpenAI handle automatic chunking (800 tokens, 400 overlap)
   - Preserve chapter boundaries where possible
   - Maintain section headings for context

4. **Metadata Tagging:**
   ```json
   {
     "source": "trevors_book",
     "author": "Trevor [Last Name]",
     "chapter": "1-15",
     "topic": "diagnostic|avatar|canvas|capture|core",
     "authority": "primary",
     "copyright": "owned"
   }
   ```

5. **Distribution Across Vector Stores:**
   - Analyze each chapter's topic
   - Assign to relevant vector store(s)
   - Some chapters may be duplicated across stores if applicable

**Chapter Mapping Example:**
```
Trevor's Book Structure → Vector Store Assignment:
├─ Chapter 1-3: Brand Foundations → Core KB
├─ Chapter 4-6: Customer Understanding → Avatar KB
├─ Chapter 7-9: Brand Assessment → Diagnostic KB
├─ Chapter 10-12: Business Models → Canvas KB
└─ Chapter 13-15: Marketing Execution → CAPTURE KB
```

### Tier 2: Classic Marketing Books (Curated Insights)

**Status:** Copyright-protected - extract key concepts only, NO direct PDF copying

**Approach:** Web research + synthesis + attribution

**Target Books:**

1. **Positioning: The Battle for Your Mind** (Ries & Trout)
   - Key concepts to extract: positioning statement, competitive positioning, differentiation
   - Method: Web search, summaries, and original synthesis
   - Attribution: "Positioning principles (Ries & Trout)"

2. **Building a StoryBrand** (Donald Miller)
   - Key concepts: StoryBrand framework, hero's journey in branding, clear messaging
   - Method: Web-available summaries, framework diagrams, concept explanations
   - Attribution: "StoryBrand methodology (Miller)"

3. **Blue Ocean Strategy** (Kim & Mauborgne)
   - Key concepts: value innovation, red vs blue oceans, strategy canvas
   - Method: Published case studies, framework summaries
   - Attribution: "Blue Ocean principles (Kim & Mauborgne)"

4. **The 22 Immutable Laws of Marketing** (Ries & Trout)
   - Key concepts: 22 laws synthesized from public sources
   - Method: Each law explained with examples
   - Attribution: "Marketing Laws (Ries & Trout)"

5. **Contagious: Why Things Catch On** (Jonah Berger)
   - Key concepts: STEPPS framework, virality principles
   - Method: Framework summaries from public domain
   - Attribution: "Contagious principles (Berger)"

6. **Made to Stick** (Chip & Dan Heath)
   - Key concepts: SUCCESs framework, memorable messaging
   - Method: Public framework explanations
   - Attribution: "Made to Stick framework (Heath & Heath)"

**Legal Framework for Synthesis:**

✅ **ALLOWED:**
- Extracting key concepts and frameworks
- Explaining methodologies in your own words
- Using publicly available summaries and reviews
- Referencing ideas with proper attribution
- Creating original examples based on concepts

❌ **NOT ALLOWED:**
- Uploading copyrighted PDF files
- Copying text verbatim without permission
- Reproducing proprietary worksheets/templates
- Using large excerpts without fair use justification

**Synthesis Process:**

```
For each book:
1. Web Research Phase
   ├─ Search: "[Book Name] key concepts summary"
   ├─ Search: "[Book Name] framework explanation"
   ├─ Search: "[Book Name] main ideas"
   └─ Collect 5-10 authoritative summaries

2. Concept Extraction
   ├─ Identify 10-15 core concepts
   ├─ Extract framework structures
   └─ Note key terminology

3. Original Synthesis
   ├─ Rewrite concepts in original language
   ├─ Create new examples
   ├─ Structure for IDEA framework context
   └─ Add proper attribution

4. Document Creation
   ├─ Title: "[Concept Name] - Marketing Framework Synthesis"
   ├─ Attribution: Source author and book
   ├─ Content: Original explanation with examples
   └─ Integration: How it applies to IDEA coaching
```

**Example Synthesis Document:**

```markdown
# Positioning Statement Framework - Marketing Synthesis
**Source:** Positioning: The Battle for Your Mind (Ries & Trout)
**Category:** Diagnostic / Core
**Application:** Brand positioning assessment and strategy

## Core Concept
Positioning is the process of establishing a unique place in the
customer's mind relative to competitors. A strong positioning
statement answers: What category are you in? Who is your target
customer? What is your unique benefit?

## Positioning Statement Structure
For [target customer]
Who [statement of need or opportunity]
Our [product/service/brand] is [category]
That [key benefit/unique differentiator]
Unlike [competitive alternative]
We [primary differentiation]

## Example Application in IDEA Framework
When coaching a brand on Distinctive (IDEA), positioning principles
help identify competitive differentiation...

[Continue with original synthesis and examples]
```

### Tier 3: Web-Based Marketing Resources

**Status:** Curated public domain and openly licensed content

**Sources:**
- Marketing blogs (HubSpot, Neil Patel, Seth Godin)
- Academic papers (publicly available research)
- Case studies (with proper attribution)
- Framework explanations from authoritative sources

**Collection Strategy:**

1. **Automated Web Scraping** (legal, public content):
   ```python
   # Collect marketing insights from approved sources
   sources = [
       "https://blog.hubspot.com/marketing",
       "https://seths.blog",
       "https://www.marketing-interactive.com"
   ]
   # Scrape with robots.txt compliance
   # Convert to markdown
   # Tag with metadata
   ```

2. **Manual Curation:**
   - Identify high-quality articles
   - Extract key insights
   - Rewrite in consistent voice
   - Add IDEA framework context

3. **Academic Research:**
   - Search Google Scholar for marketing research
   - Focus on publicly available papers
   - Synthesize research findings
   - Cite properly

---

## Document Preparation Pipeline

### Phase 1: Trevor's Book Processing

**Timeline:** Week 1

**Steps:**

1. **Receive PDF from Trevor**
   - Confirm file quality (searchable text, not scanned images)
   - Validate chapter structure
   - Check file size (< 512MB or plan split)

2. **Metadata Preparation**
   - Create chapter mapping to vector stores
   - Define tagging schema
   - Prepare upload script

3. **Upload to OpenAI**
   - Upload full PDF or chapter splits
   - Store file IDs
   - Verify successful processing

4. **Add to Vector Stores**
   ```python
   # Create vector stores for each domain
   diagnostic_store = client.vector_stores.create(
       name="IDEA Diagnostic Knowledge Base",
       file_ids=[trevors_book_file_id]  # Will be chunked automatically
   )

   # Repeat for avatar, canvas, capture, core stores
   ```

5. **Validation**
   - Test semantic search queries
   - Verify chunk quality
   - Check retrieval accuracy

### Phase 2: Marketing Classics Synthesis

**Timeline:** Weeks 2-4

**Steps:**

1. **Web Research** (Week 2)
   - For each target book, collect 10+ summaries
   - Document key concepts
   - Note frameworks and methodologies

2. **Synthesis Writing** (Week 3)
   - Write original documents for each concept
   - Structure for RAG retrieval
   - Add IDEA framework integration
   - Include proper attribution

3. **Document Formatting** (Week 3)
   ```markdown
   # [Concept Name] - Marketing Framework
   **Original Source:** [Author, Book Title]
   **Category:** [Diagnostic/Avatar/Canvas/CAPTURE/Core]

   ## Key Concept
   [Original synthesis in 2-3 paragraphs]

   ## Framework Structure
   [Bullet points or diagrams]

   ## Application to IDEA Coaching
   [How coaches use this concept]

   ## Example Scenarios
   [2-3 practical examples]
   ```

4. **Upload to Vector Stores** (Week 4)
   - Convert markdown to PDF (for consistent formatting)
   - Upload to appropriate vector stores
   - Tag with metadata

### Phase 3: Web Content Curation

**Timeline:** Weeks 5-6 (ongoing)

**Steps:**

1. **Identify Top Sources**
   - Marketing blogs
   - Case study repositories
   - Framework databases
   - Academic papers

2. **Automated Collection**
   - Set up web scrapers (legal, public content)
   - RSS feed monitoring
   - Weekly collection cadence

3. **Manual Curation**
   - Review collected content
   - Select high-quality pieces
   - Rewrite/synthesize if needed
   - Add to vector stores

4. **Continuous Updates**
   - Monthly content reviews
   - Add new marketing insights
   - Update with industry trends

---

## Vector Store Organization

### Store 1: Diagnostic KB (10,000 docs, 5GB)

**Content Mix:**
- 40% Trevor's book (assessment chapters)
- 30% Marketing classics synthesis (SWOT, positioning analysis)
- 20% Case studies (brand audits, competitive analysis)
- 10% Academic research (brand measurement frameworks)

**Key Topics:**
- Brand strength assessment
- SWOT analysis frameworks
- Competitive analysis methodologies
- Market positioning evaluation
- Brand health metrics
- Customer perception studies

**Upload Priority:**
1. Trevor's assessment chapters
2. Positioning synthesis (Ries & Trout)
3. Brand audit case studies
4. SWOT framework documents

### Store 2: Avatar KB (8,000 docs, 4GB)

**Content Mix:**
- 45% Trevor's book (customer profiling chapters)
- 25% StoryBrand synthesis (customer journey, hero positioning)
- 20% Persona development frameworks
- 10% Market segmentation research

**Key Topics:**
- Customer persona development
- Demographic and psychographic profiling
- Customer journey mapping
- Empathy mapping
- Jobs-to-be-Done framework
- Market segmentation strategies

**Upload Priority:**
1. Trevor's customer chapters
2. StoryBrand synthesis (Miller)
3. Persona templates and examples
4. Customer research methodologies

### Store 3: Canvas KB (7,000 docs, 3.5GB)

**Content Mix:**
- 35% Trevor's book (business model chapters)
- 30% Business Model Canvas synthesis (Osterwalder)
- 20% Revenue model patterns
- 15% Strategic planning frameworks

**Key Topics:**
- Business Model Canvas
- Value proposition design
- Revenue stream strategies
- Partnership models
- Resource allocation
- Channel strategies

**Upload Priority:**
1. Trevor's business strategy chapters
2. Blue Ocean Strategy synthesis
3. Business Model Canvas explanations
4. Revenue model case studies

### Store 4: CAPTURE KB (12,000 docs, 6GB)

**Content Mix:**
- 30% Trevor's book (content and marketing chapters)
- 25% Contagious synthesis (Berger STEPPS)
- 20% Made to Stick synthesis (Heath SUCCESs)
- 15% Content marketing frameworks
- 10% Social media strategies

**Key Topics:**
- Content strategy frameworks
- Social media marketing
- Campaign planning
- Engagement tactics
- Viral content principles
- Marketing channels optimization

**Upload Priority:**
1. Trevor's marketing execution chapters
2. Contagious synthesis (virality)
3. Made to Stick synthesis (memorable messaging)
4. Content marketing playbooks

### Store 5: Core KB (5,000 docs, 2.5GB)

**Content Mix:**
- 50% Trevor's book (brand foundations chapters)
- 20% Brand storytelling frameworks
- 15% Mission/vision development guides
- 15% Brand personality and voice

**Key Topics:**
- Brand foundations
- Mission and vision statements
- Core values definition
- Brand story development
- Brand personality frameworks
- Authentic brand voice

**Upload Priority:**
1. Trevor's brand philosophy chapters
2. StoryBrand narrative synthesis
3. Brand story frameworks
4. Values articulation guides

---

## Implementation Workflow

### Week 1: Foundation Setup

**Day 1-2: Trevor's Book Preparation**
- [ ] Receive Trevor's book PDF
- [ ] Validate file quality
- [ ] Map chapters to vector stores
- [ ] Prepare metadata schema

**Day 3-4: OpenAI Setup**
- [ ] Create OpenAI project
- [ ] Set up API access
- [ ] Create 5 vector stores (empty)
- [ ] Test file upload API

**Day 5: Trevor's Book Upload**
- [ ] Upload Trevor's book to OpenAI
- [ ] Add to all 5 vector stores
- [ ] Verify chunking and search
- [ ] Document file IDs

### Weeks 2-3: Marketing Classics Synthesis

**Week 2: Research Phase**
- [ ] Positioning (Ries & Trout) - 10 concepts
- [ ] StoryBrand (Miller) - 8 concepts
- [ ] Blue Ocean Strategy - 6 concepts
- [ ] 22 Laws of Marketing - 22 concepts
- [ ] Contagious (Berger) - STEPPS framework
- [ ] Made to Stick (Heath) - SUCCESs framework

**Week 3: Writing Phase**
- [ ] Write 20 synthesis documents (4 per day)
- [ ] Format consistently
- [ ] Add IDEA framework integration
- [ ] Include proper attribution

### Week 4: Marketing Classics Upload

- [ ] Convert documents to PDF
- [ ] Upload to vector stores
- [ ] Tag with metadata
- [ ] Test retrieval quality

### Weeks 5-6: Web Content Curation

- [ ] Identify top 20 marketing blogs/resources
- [ ] Set up automated collection (legal, public content)
- [ ] Manually curate 50 high-quality articles
- [ ] Synthesize and upload to vector stores

### Ongoing: Maintenance and Updates

**Monthly Tasks:**
- [ ] Review new marketing content
- [ ] Add 20-30 new documents
- [ ] Update outdated information
- [ ] Monitor retrieval quality

**Quarterly Tasks:**
- [ ] Analyze most-retrieved chunks
- [ ] Identify knowledge gaps
- [ ] Commission new synthesis documents
- [ ] Audit attribution and compliance

---

## Quality Assurance

### Content Quality Checklist

For each document added to vector stores:

- [ ] **Accuracy**: Information is factually correct
- [ ] **Originality**: Synthesis is original, not copied
- [ ] **Attribution**: Proper source citation included
- [ ] **Relevance**: Applies to IDEA brand coaching
- [ ] **Clarity**: Written in clear, accessible language
- [ ] **Structure**: Formatted for RAG retrieval
- [ ] **Metadata**: Properly tagged for search

### Retrieval Quality Testing

**Test Queries for Each Vector Store:**

1. **Diagnostic KB:**
   - "How do I assess my brand strength?"
   - "What is a SWOT analysis?"
   - "How to evaluate competitive positioning?"

2. **Avatar KB:**
   - "How do I define my ideal customer?"
   - "What is a customer persona?"
   - "How to map the customer journey?"

3. **Canvas KB:**
   - "What is the Business Model Canvas?"
   - "How to design a value proposition?"
   - "What revenue models should I consider?"

4. **CAPTURE KB:**
   - "How to create a content strategy?"
   - "What makes content go viral?"
   - "How to plan a marketing campaign?"

5. **Core KB:**
   - "How do I define my brand mission?"
   - "What are brand core values?"
   - "How to develop my brand story?"

**Success Criteria:**
- Retrieval returns relevant chunks (>0.8 similarity)
- Top 5 chunks cover the query topic
- No irrelevant results in top 10
- Attribution visible in metadata

---

## Legal Compliance Framework

### Copyright Checklist

Before adding any content to vector stores:

- [ ] **Owned Content**: Do we have full IP rights? (Trevor's book = YES)
- [ ] **Fair Use**: Is this transformative synthesis? (Concept extraction = YES)
- [ ] **Attribution**: Is the source properly cited? (Always required)
- [ ] **Public Domain**: Is this freely available? (Web content varies)
- [ ] **License**: Does the license permit this use? (Check CC licenses)

### Attribution Standards

**Required Attribution Format:**

```markdown
**Original Source:** [Author Name], "[Book/Article Title]" ([Year])
**Usage:** Concept synthesis under fair use doctrine
**Copyright Notice:** All rights reserved by original author
```

**Examples:**

- Trevor's book: "From [Book Title] by Trevor [Last Name]. All content used with full permission and IP rights."
- Marketing classics: "Concept synthesis based on 'Positioning' by Al Ries and Jack Trout (1981). Original work copyright by authors."
- Web content: "Adapted from [Article Title] by [Author], originally published at [URL]. Used under fair use for educational purposes."

### Compliance Audit

**Quarterly Review:**
- [ ] Verify all attributions are present
- [ ] Check for any direct copying
- [ ] Confirm synthesis quality
- [ ] Update any outdated attributions

---

## Upload Instructions for Trevor

### How to Provide Your Book

**Option 1: Direct PDF Upload (Recommended)**

1. Save your book as a single PDF file
2. Ensure the PDF is searchable (not scanned images)
3. Send via:
   - Secure file transfer (Dropbox, Google Drive)
   - Direct upload to our system (will provide link)
4. We'll handle the rest!

**Option 2: Chapter-by-Chapter**

If your book is >512MB:
1. Split into chapters or sections
2. Save each as a separate PDF
3. Name clearly: "Chapter_01_Introduction.pdf"
4. We'll upload and merge in the system

**Option 3: Direct OpenAI Upload**

If you have OpenAI API access:
```bash
# We'll provide you with this script
python upload_book.py --file="trevors_book.pdf" --project="idea-brand-coach"
```

**What Happens After Upload:**

1. ✅ Automatic chunking (800 tokens per chunk)
2. ✅ Embedding generation (converts text to vectors)
3. ✅ Distribution to 5 vector stores
4. ✅ Immediate availability for RAG queries
5. ✅ Your IP remains protected (access-controlled)

**Timeline:**
- Upload: 5 minutes
- Processing: 30-60 minutes (depending on size)
- Testing: 1 hour
- **Total: Ready in 2-3 hours**

---

## Success Metrics

### Knowledge Base Quality

**Quantitative Metrics:**
- **Coverage**: 10,000+ documents across 5 stores
- **Size**: ~20GB total vector storage
- **Trevor's Content**: 40-50% of total knowledge base
- **Retrieval Speed**: <500ms per search
- **Accuracy**: >0.8 similarity for relevant queries

**Qualitative Metrics:**
- **Coherence**: Responses cite appropriate sources
- **Authority**: Trevor's expertise is primary reference
- **Completeness**: All IDEA dimensions covered
- **Legal**: 100% compliance with copyright law
- **Freshness**: Monthly content updates

### User Experience Impact

**Before Knowledge Base:**
- Generic coaching responses
- No source attribution
- Limited depth
- Inconsistent quality

**After Knowledge Base:**
- Personalized, expert coaching
- Trevor's methodology applied
- Deep, comprehensive guidance
- Consistent, high-quality responses

---

## Maintenance Plan

### Weekly Tasks
- Monitor vector store performance
- Review retrieval logs for gaps
- Add 5-10 new documents (web curation)

### Monthly Tasks
- Quality audit (random sample of 50 documents)
- Update synthesis documents with new insights
- Add 20-30 high-value documents
- Analyze most-retrieved vs least-retrieved content

### Quarterly Tasks
- Comprehensive knowledge gap analysis
- Major content refresh for outdated information
- Legal compliance audit
- Performance optimization

### Annually
- Full vector store rebuild (if needed)
- Trevor's book updates (new editions)
- Strategic content roadmap
- ROI analysis

---

## Cost Estimate

### OpenAI Vector Storage
- **5 Vector Stores**: ~25GB total
- **Cost**: $0.10/GB/day = $2.50/day = $75/month
- **File Search API**: ~$0.003/query

### Content Creation
- **Initial Synthesis** (50 documents): 40 hours @ consultant rate
- **Ongoing Curation**: 10 hours/month @ consultant rate
- **Legal Review**: As needed (consult IP attorney)

### Total Monthly Cost
- **OpenAI Storage**: ~$75
- **Maintenance**: ~10 hours/month
- **Total**: ~$75 + labor

---

## Next Steps

### Immediate Actions (This Week)

1. **Get Trevor's Book PDF**
   - Request file from Trevor
   - Validate quality
   - Prepare metadata

2. **Set Up OpenAI Project**
   - Create vector stores
   - Configure API access
   - Test upload pipeline

3. **Begin Marketing Synthesis**
   - Start with Positioning (highest priority)
   - Write 5 concept documents
   - Format for upload

### Short-Term Goals (Weeks 1-4)

- [ ] Trevor's book fully uploaded and tested
- [ ] 50 marketing synthesis documents created
- [ ] All 5 vector stores populated with core content
- [ ] Retrieval quality validated

### Long-Term Goals (Months 1-3)

- [ ] 10,000+ documents across all stores
- [ ] Automated web curation pipeline
- [ ] Monthly content update process
- [ ] Comprehensive legal compliance audit

---

## Appendix A: Document Template

### Synthesis Document Template

```markdown
# [Concept Name] - Marketing Framework Synthesis
**Original Source:** [Author], [Book Title] ([Year])
**Category:** [Diagnostic/Avatar/Canvas/CAPTURE/Core]
**Application:** [How this applies to IDEA coaching]
**Attribution:** Original concept by [Author]. This is an educational
synthesis for the IDEA Brand Coach platform.

---

## Overview
[2-3 sentence summary of the concept]

## Core Concept
[Detailed explanation in original language - 3-4 paragraphs]

## Framework Structure
[Bullet points, diagrams, or step-by-step breakdown]

## Application to IDEA Brand Coaching
[How coaches use this concept - specific examples]

### For Insight (I):
[How this concept helps with customer understanding]

### For Distinctive (D):
[How this concept helps with differentiation]

### For Empathetic (E):
[How this concept helps with emotional connection]

### For Authentic (A):
[How this concept helps with brand authenticity]

## Practical Examples
[3 specific examples of this concept in action]

## Coaching Prompts
[Questions a coach might ask using this framework]

## Related Concepts
[Links to other relevant frameworks]

---

**Copyright Notice:** This synthesis is for educational purposes
under fair use doctrine. Original work copyright [Author/Publisher].
All rights reserved.
```

---

## Appendix B: Attribution Examples

### Example 1: Trevor's Book (Full Rights)

```markdown
**Source:** IDEA Brand Framework by Trevor [Last Name]
**Copyright:** © [Year] Trevor [Last Name]. All rights reserved.
**Usage:** Full reproduction rights granted for IDEA Brand Coach platform.
**License:** Proprietary - content exclusively licensed for this application.
```

### Example 2: Marketing Classic (Synthesis)

```markdown
**Source:** Positioning: The Battle for Your Mind by Al Ries and Jack Trout (1981)
**Copyright:** © 1981 McGraw-Hill Companies. All rights reserved.
**Usage:** Educational synthesis under fair use doctrine (17 U.S.C. § 107).
**Attribution:** Key concepts synthesized from publicly available summaries
and framework explanations. No verbatim copying from original work.
**Disclaimer:** This is a transformative synthesis for educational coaching
purposes. Readers should purchase the original book for complete insights.
```

### Example 3: Web Content (Public Domain/CC License)

```markdown
**Source:** "Content Marketing Framework" by [Author]
**Originally Published:** [Website URL] ([Date])
**License:** Creative Commons BY-SA 4.0 (or specify license)
**Usage:** Adapted and synthesized with attribution as required by license.
**Modifications:** Content restructured for IDEA framework integration.
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-13
**Status:** ✅ Ready for Implementation
**Next Review:** 2025-12-13

**Related Documents:**
- [High-Level Design](./IDEA_BRAND_COACH_HIGH_LEVEL_DESIGN.md)
- [Implementation Plan](./IDEA_BRAND_COACH_IMPLEMENTATION_PLAN.md)
- [P0 Implementation Plan](./P0_IMPLEMENTATION_PLAN.md)
