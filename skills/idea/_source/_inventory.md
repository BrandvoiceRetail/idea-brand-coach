# BOOK SECTION INVENTORY — canonical resume map

Source: `book.txt` (full pdftotext extract, 4959 lines, 11 chapters + front/back matter).
Table-preserving copy: `book_layout.txt` (use for tables, the Brand Canvas, and the system-prompt block).
Conventions in `book.txt`: standalone numeric lines = printed page numbers; Title-Case standalone lines = section headers; bullets render as odd glyphs.

This file is the authoritative section map built by a 12-agent full-read pass (one agent per chapter). Future loop iterations read THIS instead of re-scanning. Per-chapter sections list: title · book.txt line range · printed pages · key atomic units · verbatim assets (line numbers) that MUST be preserved word-for-word.

Chapter body line ranges:
- Front matter + TOC + Who-Should-Read + What-You'll-Learn: 1–281
- INTRODUCTION: 282–450
- CH1 Evolving Ecommerce Landscape: 451–845
- CH2 IDEA Framework for Building Trust: 846–1907
- CH3 Avatar 2.0 Tool: 1908–2289
- CH4 Authentically Human & IDEA: 2290–2565
- CH5 IDEA Brand Canvas: 2566–3114
- CH6 Authentic Brand Voice: 3115–3284
- CH7 Training a Custom GPT: 3285–3712
- CH8 The Customer Journey: 3713–4234
- CH9 Customer-Centric Product Development: 4235–4524
- CH10 Building Your Personal Brand: 4525–4740
- CH11 Research Guide Overview + back matter: 4741–4959

Recurring NON-CONTENT block to EXCLUDE everywhere (logged, not skilled): the "Do You Need Help To Unlock Your Brand's Emotional Sales Potential? / Book A FREE Consultation Meeting / https://bit.ly/brand_strategy_meeting" CTA appears at the end of most chapters (e.g. 840–843, 1902–1905, 2284–2288, 2560–2563, 3109–3112, 3279–3284, 3707–3711, 4229–4232, 4519–4523, 4735–4738). Also EXCLUDE: About-the-Author bio (12–77, marketing/credibility, no teachable tactic) and the Fair-Use/Copyright disclaimer (4938–4956) — both logged in _coverage.md exclusions.

---

## FRONT MATTER + INTRODUCTION (lines 1–450) — pp. 2–18
- **About the Author** · 12–77 · pp.2–5 · author credibility, Titan Network (700 brands/$100M). → EXCLUDED (bio, no tactic).
- **Contents & chapter summaries (TOC)** · 80–228 · TOC blurbs = summaries, do not mine. IDEA acronym expansion at 123–124.
- **Who Should Read This Book?** · 231–264 · pp.9–10 · struggling-seller profile; 5 symptoms (238–242); audience segments (251–264). → covered by intro skill `03-who-this-is-for-and-the-trust-gap`.
- **What You'll Learn** · 266–278 · pp.10–11 · 5 outcomes (267–272). → folded into `03-who-this-is-for`.
- **INTRODUCTION: Harness the Power of Behavioral Science** · 280–448 · pp.12–18 · thesis; emotions; 95% subconscious; Authentically Human Branding; trust-as-deciding-factor; hearts-then-minds; the 4 customer questions; hesitation. Verbatim: thesis 298–303; emotions list 301–302; 95% 321–322; hearts-and-minds 325–327; "we'll uncover" 339–346; how-this-book-helps 397–402; 4 questions 414–417; without-trust list 422–424; My-Promise list 436–444.
  → SKILLS (DONE): `00-introduction/00-core-thesis/{00-what-captures-the-heart, 01-buying-is-emotional-95-percent-subconscious, 02-capture-hearts-and-minds-in-that-order}`; `01-trust-foundations/{00-trust-is-the-deciding-factor, 01-the-four-customer-questions, 02-hesitation-the-silent-killer}`; `02-authentically-human-branding`; `03-who-this-is-for-and-the-trust-gap`.

---

## CHAPTER 1 — THE EVOLVING ECOMMERCE LANDSCAPE (451–845) — pp.20–32
- **Chapter intro / trust erosion** · 456–462 · authenticity as cornerstone; consumers crave trust/empathy/connection; drivers of skepticism.
- **Mistrust as the Default State** · 464–498 · p.20 · cynicism default; institutional trust plummeted; Cambridge Analytica/Meta Community Notes (470–485); Twitter-X/YouTube/TikTok/genAI misinformation (488–498).
- **The Shift in Consumer Trust** · 500–509 · p.21 · trust = most valuable asset; outsourcing trust to influencers; rented trust is fragile (501–506).
- **The Rise of Borrowed Trust** · 511–526 · p.21 · influencer marketing solved ad-averse reach; authenticity→transactionality; walking-billboards examples (522–526).
- **Why Borrowed Trust Is a Risky Strategy** · 528–608 · pp.22–24 · Trust Can't Be Transferred; Lack of Control; Short-Term Gains/Long-Term Dependence (531–538, 588–599). Sub: **Shift Influencer→UGC** 547–561 (EnTribe 86/12/81/90 stat block 553–557); **Why UGC Is Winning** 563–572 (82% stat 569–572); **Industry Shift: Authentic Connections** 576–587 ("authenticity is the new currency" 585–587).
- **The TikTok Dilemma: Building on Borrowed Ground** · 610–682 · pp.25–27 · overnight virality; borrowed real estate; 90-day US ban; Amazon platform-dependence trap; Cycle of Dependency list (603–606); 4 moves: Be Authentically Human (633–639), Own Your Story (641–650), Build Direct Relationships (651–661), Multi-Channel Strategy (663–669). Sub: **The Bottom Line: Don't Rent Trust—Own It** 671–682.
- **Amazon — Far from an Even Playing Field** · 686–748 · pp.28–29 · Amazon trust-dominance; 85–95% Shein/AliExpress/Temu fail EU legislation (696–701); Trusted Expert Network (TEN); Compliance Central; safety-initiatives list (712–729: Manage Your Compliance Dashboard, A-to-Z Guarantee, Product Safety Pledges, Proactive Monitoring & AI, Collaboration w/ Regulators); Chinese factory sellers >50% (733–742); US-seller double standard; reciprocal-fairness argument.
- **Navigating Amazon in the Age of AI** · 751–759 · p.30 · Rufus + Cosmo reshape discovery; keyword-stuffing→intent. Sub: **Understanding Rufus and Cosmo** 761–774 (Rufus deep-analysis; Cosmo behavioral; "comfortable shoes" example; AI goal = trust via relevance); **How Sellers Must Adapt** 776–807 (Contextualized Descriptions, Enhanced Imagery, Q&A/Reviews, Intent-Based Optimization, Behavioral Triggers — emotional vs logical 804–807; examples 785–787, 794–796, 798–800); **Optimizing for AI: A Strategic Shift** 809–821 (water-bottle feature list 816–819); **Final Thoughts: AI Is Only as Good as the Data** 823–836 (SEO→AI Model Training 828–829; semantic-SEO list 834–836).
- **CTA** 840–843 → EXCLUDED.

---

## CHAPTER 2 — IDEA: A FRAMEWORK FOR BUILDING TRUST (846–1907) — pp.35–64 [LARGEST]
- **Chapter intro / IDEA overview** · 846–878 · p.35 · IDEA acronym; Authentically Human brand; numbered pillar list 01–04 (860–877).
- **The IDEA Strategic Brand Framework (quadrant grid)** · 879–910 · p.35 · 2x2 grid: Insight-Driven, Distinctive/Different, Emotionally Intelligent, Authoritative & Authentic around central TRUST. Verbatim grid: book.txt 879–910 / layout 1024–1047.
- **Your Unfair Advantage** · 913–927 · p.36 · trust/understanding = hard-to-replicate edge vs factory sellers; whole journey.
- **Why Competing on Price and AI Alone Is a Losing Strategy** · 929–947 · pp.36–37 · race to the bottom; AI leveled optimization; trust = scalable advantage.
- **Trust: The Ultimate Competitive Advantage** · 949–997 · pp.37–38 · trust as moat; 5 reasons list (955–996): Cultural Understanding; Trust = Ultimate Currency; Emotional Resonance Beats Transactional; Language & Messaging Matter; We Build Brands Not Just Products.
- **Leveraging the Power of Behavioral Science** · 1000–1011 · p.38 · the "why" vs "what".
- **The 4 Principles of the IDEA Framework** · 1013–1047 · p.39 · one-para each: Insight-Driven; Distinctive; Empathetic; Authentic (1014–1047).
- **A Practical & Systematic Approach to Building Trust** · 1049–1080 · p.40 · brand as relationship; "offering a piece of yourself"; framework not a degree.
- **The Foundations: What Drives Customer Decision Making** · 1082–1099 · p.41 · Freud subconscious; Zaltman 95% (How Customers Think 2003) citation 1093–1097; post-hoc rationalization.
- **The Role of Emotions in Buying** · 1101–1135 · p.42 · buy outcomes not products; Levitt "sell the drill/buy the hole" (Marketing Myopia 1960) 1121–1123; Drucker quote 1124–1126; Accenture 87%/8,000 1127–1131.
- **The Emotional Foundation of Branding** · 1137–1166 · pp.43–44 · sell feelings/identity/lifestyle; luxury (LV/Rolex); Clorox/Domestos; single-idea: Volvo/Tesla/BMW (1157–1162).
- **The Psychology Behind Branding** · 1168–1194 · pp.44–45 · brain processes via feeling; Coca-Cola happiness; "Share a Coke" personalization.
- **How Emotion in Branding Drives Customer Loyalty** · 1196–1219 · pp.45–46 · emotion→loyalty; belonging/community; Harley-Davidson; brand advocates.
- **Examples of Brands Using Emotional Connections** · 1221–1266 · pp.46–47 · Nike "Just Do It"; Dove Real Beauty (2004); Lego creativity/nostalgia (1225–1266).
- **EMOTIONAL TRIGGERS TABLE (untitled)** · 1270–1460 · pp.47–50 · 3-column table (Emotional Trigger | Expanded Psychological Effect | Example Messages), 15 rows: Survival & Fear of Loss; Pain Avoidance; Social Belonging; Status/Prestige/Aspiration; Trust & Credibility; Instant Gratification; Hope & Transformation; Curiosity & Intrigue; Reciprocity & Guilt; Nostalgia; Surprise & Delight; Empowerment & Control; Fun & Entertainment (+others). VERBATIM whole table: book.txt 1270–1460 / layout 1488–1577. → ONE skill (the table).
- **Emotional Triggers in Brand Messaging** · 1461–1543 · pp.50–52 · 5 deep-dive triggers w/ brand: FOMO (Supreme), Belonging/Community (CrossFit), Empathy/Compassion (Always "Like a Girl"), Nostalgia (Nintendo), Achievement/Status (Hermès Birkin). List 1469–1539.
- **The Balance Between Logic and Emotion** · 1545–1557 · p.53 · emotion sparks/logic sustains; Apple.
- **Further Thoughts** · 1561–1576 · p.53 · emotional connection→lifelong relationships; tell the RIGHT story.
- **Deep Dive into the IDEA Framework** · 1578–1588 · p.54 · transition; IDEA as holistic strategy.
- **Insight: The Foundation of Strategic Planning** · 1591–1598 · p.54 · Insight pillar; psychographic vs demographic.
  - **Step 1: Understand Your Customer Avatar** · 1600–1611 · p.55 · Avatar 2.0 tool; skincare/Millennials example.
  - **Step 2: Leverage Behavioral and Emotional Data** · 1613–1618 · p.55 · qual+quant; behavioral vs emotional data.
  - **Step 3: Anticipate Customer Needs** · 1621–1629 · pp.55–56 · proactive; track behavior/culture/tech.
  - **Examples of Brands That Anticipated Needs** · 1631–1670 · pp.56–57 · Apple/Netflix/Tesla/Amazon/Spotify/Nike (6-brand list 1633–1670).
- **Step 2: Distinctiveness** · 1674–1685 · pp.57–58 · Distinctiveness pillar; salience; Ries & Trout *Positioning*; USP.
  - **Difference vs. Distinctiveness** · 1687–1691 · p.58 · separate complementary concepts.
  - **Difference: What Makes Your Product Unique** · 1693–1717 · pp.58–59 · tangible/functional; Tesla/Dyson/Lush; When-to-focus list (1709–1713); Dollar Shave Club; Challenges list (1715–1717).
  - **Distinctiveness: Memorable & Recognizable** · 1719–1752 · pp.59–60 · branding elements/mental availability; Coca-Cola/Apple/Old Spice; When-to-focus (1739–1742); Key Elements (1744–1752: Logo & Symbols, Slogans & Taglines, Packaging/Product Design, Advertising Style & Personality).
  - **Why It Matters** · 1756–1776 · pp.60–61 · combine both; salience def; "say less, more often"; DBA def; KFC DBAs (1761–1773).
  - **Identify Your Differentiators** · 1778–1789 · p.61 · product/experience/values; Patagonia.
  - **Communicate One Clear Message** · 1791–1798 · p.61 · one simple message; Volvo "safety".
  - **Reinforce Distinction at Every Touchpoint** · 1800–1804 · p.61 · consistency across journey.
- **Step 3: Empathy: Building Emotional Connections** · 1806–1815 · p.62 · Empathy/EI pillar; security/belonging/validation/self-expression.
  - **How to Apply Empathy** · 1818–1855 · pp.62–63 · Step1 Focus on Emotional Triggers (Airbnb "Belong Anywhere"); Step2 Personalize (Spotify Wrapped); Step3 Listen & Respond (Zappos). Steps 1819–1850.
- **Step 4: Authenticity — Stay True to Core Values** · 1856–1873 · p.64 · Authenticity pillar; transparency+consistency; walk the walk.
  - **How to Be Authentic** · 1877–1900 · p.64 · Step1 Define Core Values (Ben & Jerry's); Step2 Align Actions (supply chain); Step3 Be Transparent (admit mistakes). 1878–1900.
- **CTA** 1902–1905 → EXCLUDED.

---

## CHAPTER 3 — THE AVATAR 2.0 TOOL (1908–2289) — pp.67–80
- **Chapter title + Role of Avatar 2.0 in IDEA** · 1908–1934 · Avatar 2.0↔IDEA; 5 fields diagram (1917–1934): Buyer Intent (Search), Motivations (tasks to achieve), Emotional Triggers, Shopper Type 1–4, Relevant Demographics; "gather & record all data".
- **From Guessing to Knowing** · 1936–1946 · p.68 · forensic behavioral shift; 5 core aspects.
- **Buyer Intent: Foundation of Precision Targeting** · 1948–1961 · pp.68–69 · the "why" behind search; infer from behavioral/contextual; ergonomic-chair example; Cosmo AI; competitor audits.
- **Buyer Motivation: the "Why" Behind Decisions** · 1963–1977 · p.69 · subconscious reasons; Kahneman *Thinking Fast and Slow*; status/convenience/expression/prestige; luxury watch; Zaltman metaphor elicitation.
- **Emotional Triggers: The Key to Connection** · 1979–1997 · pp.69–70 · stimuli > logic; Lindstrom *Buyology*; Zaltman 95%; storytelling/framing; loss aversion; scarcity; Cialdini reciprocity & social proof.
- **The Seven Emotional Triggers** (one section each): **Hope** 1999–2009 (p.70); **Belonging** 2011–2020 (social identity); **Validation** 2021–2029 (p.71); **Trust** 2030–2040 (transparency reduces buyer's remorse); **Relief** 2041–2050; **Aspiration** 2050–2060 (p.72); **Empowerment** 2060–2071 (control/confidence, brand-as-partner). → one skill listing all seven (or grouped); each = atomic trigger.
- **The Bigger Picture** · 2072–2089 · triggers rooted in psych/sociology/neuroscience; transactions→relationships; 7 triggers work together.
- **The Evolutionary Roots of Emotional Triggers** · 2090–2097 · p.73 · emotions as evolved adaptive mechanisms.
- **The Shopper's High (brain chemistry)** · 2099–2110 · shopping = cognitive + biochemical; create anticipation.
- **The Power of Emotional Triggers and Brain Chemistry** · 2111–2156 · pp.74–75 · Dopamine (desire/reward), Oxytocin (trust/connection), Cortisol (stress reduction/relief), Serotonin (positivity) — "What It Does"/"In Shopping" 2118–2154. → one skill (neurochemical table).
- **Biochemistry's Impact on Decision-Making** · 2158–2171 · p.75 · System 1 vs System 2 (Kahneman); 3 trigger→chemical examples (2164–2170).
- **The Subconscious Search for Emotional Comfort** · 2172–2179 · feel good/safe/connected.
- **Shopify Shopper Types: Behavioral Segmentation** · 2180–2213 · pp.76–77 · Shopify 2024 State of Commerce (7,628 EU); Cost Sensitive 50%, Quality Focused 39%, Conscious 9%, Connected 2% (2188–2197); tailor journeys by type. → one skill (the 4 types).
- **Relevant Demographics: Context, Not Stereotypes** · 2214–2225 · p.78 · demographics as context; Millennials purpose-driven; Gen Z authenticity/inclusivity.
- **Avatar 2.0 and Authentically Human Branding** · 2227–2240 · align intent/motivation/triggers; authenticity in distrust culture; Zaltman 95%.
- **Integrating Avatar 2.0, IDEA, and AI** · 2241–2252 · p.79 · forensic precision; static→dynamic.
- **How Avatar 2.0 Bridges the Gap** · 2254–2281 · pp.79–80 · Hyper-Personalized Messaging (fear vs pleasure skincare); Empathy as a Strategy (AI chatbot sustainability); Trust Through Transparency & Values (DTC ethical sourcing).
- **CTA** 2284–2288 → EXCLUDED.

---

## CHAPTER 4 — AUTHENTICALLY HUMAN & THE IDEA FRAMEWORK (2290–2565) — pp.83–91
- **Chapter opener / integration principle** · 2290–2299 · power = integrating the 4 components.
- **Step-by-Step Process to Integrate IDEA** · 2301–2333 · pp.83–84 · Begin with Insight; Define Your Distinction (simplify to one idea); Create Empathetic Experiences; default consumer distrust; Authentically Human as antidote. 4-bullet process 2304–2333.
- **Why Authentically Human Branding Is Vital Today** · 2335–2341 · beyond transactional; understand emotionally/psychologically.
- **Authentically Human Branding (definition)** · 2343–2351 · output of IDEA; genuine connection/empathy/human-values; brand as "human" entity; lead-in to 4 strategies.
- **4 Trust Strategies** (one each): **Transparency and Accountability** 2353–2364 (Everlane); **Engagement on a Human Level** 2366–2375 (Glossier); **Values-Driven Communication** 2377–2386 (TOMS one-for-one); **Personalized, Empathetic Experiences** 2388–2397 (Netflix).
- **Authentically Human Branding Is the Key to Winning Trust** · 2399–2406 · trust transcends price/features; "Trust is an investment the customer makes in us. Make it personal."
- **TRINNY LONDON CASE STUDY**: intro 2408–2422 (p.86; trinnylondon.com); **Personalization at the Heart** 2426–2431; **The Match2Me Tool** 2433–2439 (skin/hair/eye → bespoke recs); **Match2Me → 4 IDEA elements** 2441–2463 (Insight/Distinctive/Empathetic/Authentic mapping); **Building Trust through Tailored Recommendations** 2465–2483 (brand as trusted advisor; at-home consultation); **UGC and Real People** 2485–2497 (diverse real women, social proof); **Empathy and Empowerment** 2499–2503; **Empowering Confidence** 2505–2516 (demystify buying); **Connecting on an Emotional Level** 2518–2524 (makeup as identity); **Transparency & Authenticity in Product Development** 2527–2537 (ingredients; founder Trinny Woodall); **Conclusion: Power of Personalization** 2539–2556 (personalization = necessity not luxury).
- **CTA** 2560–2563 → EXCLUDED.

---

## CHAPTER 5 — THE IDEA BRAND CANVAS (2566–3114) — pp.94–108 [WORKSHEET — use book_layout.txt]
- **Chapter intro / rationale** · 2573–2591 · the Worksheet; symptoms of failing brand; "make a copy first"; editable link https://bit.ly/4ldQSWb (2602 / layout 2938).
- **Instructions** · 2593–2599 · Step1 capture Avatar 2.0 + IDEA outputs; Step2 write brand statements w/ AI (layout 2933–2939).
- **CANVAS TABLE 1: IDEA Customer Avatar 2.0** · 2604–2635 · 7 rows, each "question → Record here": buyer intent/function; motivation/what to achieve; emotional triggers/drivers; emotional state pre-purchase; emotional state post-purchase; Shopper Type; relevant demographics. (layout 2944–2963). → one skill (the avatar canvas table).
- **CANVAS TABLE 2: IDEA Framework Brand Canvas** · 2637–2661 · "Framework Pillar | Insights": Insight-Driven; Distinctive; Empathetic; Authentic — each w/ fill-in prompt (layout 2965–2980). → one skill (the framework canvas table).
- **CANVAS TABLE 3: Brand Statements** · 2663–2867 · 4-col "Brand Statements | Description | Example | Your Statement", 5 rows: brand purpose, vision, mission, values, target audience — each w/ IDEA-rooted description + sustainable/eco worked example + fill-in (layout 2982–3087). → one skill (the brand-statements canvas table, verbatim incl. worked examples).
- **Bridge note + sequencing rule** · 2870–2878 · complete Avatar 2.0 + IDEA BEFORE Brand Statements (NOTE 2874–2878).
- **9 ELEMENT BREAKDOWNS** (each: definition + 4 Key IDEA Principles + AI prompt + sample output): **Brand Purpose** 2880–2901; **Brand Vision** 2903–2923; **Brand Mission** 2927–2956; **Brand Values** 2960–2980; **Target Audience** 2984–3002; **Positioning Statement** 3006–3023 (prose-only, not in front tables); **Value Proposition** 3027–3042; **Brand Personality** 3046–3063; **Brand Voice** 3067–3084. Verbatim Key-IDEA-Principles + AI prompts at the cited lines.
- **How IDEA & Avatar 2.0 Bring Your Brand to Life** · 3088–3105 · p.108 · unified single doc; canvas = core doc to train AI / BrandGPT (forward link Ch7).
- **CTA** 3109–3112 → EXCLUDED.
- NOTE: Target Audience + 4 pillars appear in BOTH front canvas tables and prose breakdowns — dedupe at authoring (canvas-table skill cites the fill-in; element skill cites the definition+principles+prompt).

---

## CHAPTER 6 — CREATING YOUR AUTHENTIC BRAND VOICE (3115–3284) — pp.111–116
- **Chapter intro** · 3115–3140 · voice > words; multisensory; differentiator; voice inspires loyalty.
- **Insight-Driven: Speaking the Customer's Language** · 3142–3157 · p.111 · reflect how customers want to be spoken to; mirror language; validate emotions; research how audience communicates.
- **Distinctive: Standing Out with a Unique Voice** · 3159–3172 · pp.111–112 · instantly recognizable; tone/language/visual; voice archetypes; infuse UVP; competitor gap analysis.
- **Empathetic: Building Emotional Connection** · 3174–3190 · p.112 · human voice; acknowledge pain points before solutions; validation modes; empathy across every touchpoint.
- **Authentic: Staying True to Brand Values** · 3192–3205 · pp.112–113 · consistency/transparency/values; customers detect inauthenticity; align voice with mission.
- **Crafting a Cohesive Brand Voice (4 elements)** · 3209–3214 · p.113 · tone + language + design + imagery = consistent personality.
- **Tone of Voice: The Emotional Signature** · 3216–3220 · pp.113–114 · how a brand speaks; Rolex/Red Bull/Innocent examples (3218–3220).
- **Case Study: TAG Heuer (tone)** · 3222–3230 · p.114 · bold/assertive; precision/performance/prestige; F1 Red Bull partnership.
- **Language: The Brand's Distinctive Expression** · 3234–3243 · p.114 · taglines/aspirational copy; "Don't Crack Under Pressure" (3239).
- **Design: A Visual Language** · 3245–3262 · pp.114–115 · color psychology (red/green/black-white 3249–3252); TAG Heuer palette; typography; minimal layouts; cross-touchpoint consistency.
- **Aligning Brand Voice with Emotional Triggers** · 3266–3275 · pp.115–116 · alignment = intuitive experience; voice as emotional journey; brand as aspiration/identity/belonging.
- **CTA** 3279–3284 → EXCLUDED.

---

## CHAPTER 7 — TRAINING A CUSTOM GPT USING IDEA (3285–3712) — pp.119–134
Two parallel "Step 1–7" tracks — keep separate.
TRACK A (strategic / prompt-engineering):
- **Chapter opener** · 3285–3294 · custom GPT vs standard ChatGPT.
- **Benefits of Creating a Custom GPT** · 3296–3318 · p.119 · Multiple Custom GPTs; Upload Knowledge Sources; Share.
- **Step 1: Prepare Your IDEA Brand Canvas Worksheet** · 3320–3371 · pp.119–121 · worksheet as master AI-training doc; 4 AI-response guarantees (3329–3333); input checklist (3342–3367: Positioning & Differentiation [UVP/Competitive Analysis/Brand Promise], Customer Insights via Avatar 2.0, Brand Voice & Messaging, Additional Brand Statements).
- **Step 2: Upload the Worksheet to AI** · 3373–3382 · p.121 · 3-step upload (3378–3381).
- **Step 3: System Instructions** · 3383–3519 · pp.121–126 · FULL "MyBrand Supplements GPT" system-prompt template — VERBATIM HIGH VALUE: Role & Purpose 3387–3396; Guiding Principles 3399–3407; Brand Positioning 3409–3420; Target Audience 3424–3428; Core Product Benefits 3430–3438; System Behavior 3440–3448; Example Interaction 3451–3456; Brand Voice & tagline 3458–3466; Compliance & Ethical + NOT-to-say 3468–3482; Additional Features 3484–3494; How to Handle Queries (3 scenarios) 3496–3510; Final Instructions 3512–3518. → its own skill (the reusable system-prompt scaffold).
- **Step 4: Test & Refine AI Outputs** · 3520–3529 · pp.126–127.
- **Step 5: Fine-Tune for Accuracy** · 3531–3541 · p.127 · Reinforce Vocabulary; Control Tone; Prevent Generic; Ensure Ethics (3533–3540).
- **Step 6: Continuously Monitor & Update** · 3542–3552 · p.128.
- **Step 7: Deploy Across Brand Touchpoints** · 3554–3564 · p.128 · Content Marketing; Customer Service/Chatbots; Advertising & Sales; Brand Strategy.
- **Why the Worksheet Is the Key to AI Success** · 3565–3589 · pp.128–129 · Next Steps recap (3580–3585).
TRACK B (OpenAI GPT-Builder UI walkthrough):
- **Building a Custom GPT: Step-by-Step Guide** · 3590–3598 · pp.129–130 · no-code.
- **Step 1: Log in & Access GPT Builder** · 3599–3605 · p.130.
- **Step 2: Define Purpose & Behavior** · 3607–3618 · p.130 · Create vs Preview panel.
- **Step 3: Configure Advanced Settings** · 3620–3635 · pp.130–131 · profile pic / fine-tune instructions / conversation starters.
- **Step 4: Upload Knowledge Sources** · 3636–3648 · p.131.
- **Step 5: Enable Additional Features** · 3650–3659 · pp.131–132 · web browsing / code interpreter / API actions (Zapier).
- **Step 6: Save & Publish** · 3661–3670 · p.132 · share settings (Invite Only / Link / Public store).
- **Step 7: Test & Refine** · 3672–3682 · pp.132–133.
- **How to Modify or Delete a Custom GPT** · 3684–3695 · p.133.
- **Final Thoughts: Why Create a Custom GPT?** · 3696–3705 · pp.133–134.
- **CTA** 3707–3711 → EXCLUDED.

---

## CHAPTER 8 — THE CUSTOMER JOURNEY (3713–4234) — pp.137–155 [per-stage detail = core value]
- **Chapter intro** · 3713–3732 · journey non-linear / "signposts"; conscious vs subconscious; emotional touchpoints; brand voice at every stage.
- **Identifying Pain Points** · 3733–3739 · p.137 · pain = value opportunity; functional task vs emotional struggle.
- **Don't Look for New Products—Look for Problems** · 3741–3753 · pp.137–138 · problem-first discovery; pain raises perceived value; Dyson.
- **Creating Value in the Customer's Mind** · 3755–3766 · p.138 · emotional value > features; Apple AirPods.
- **The Customer Journey: A Path Toward Emotional Fulfillment** · 3768–3814 · pp.138–139 · 5-stage funnel (Awareness→Consideration→Decision→Retention→Advocacy, defs 3773–3780); heuristics; social proof / authority / loss aversion biases (3791–3799); one clear message; framing effect (95/5); context cues; belonging/social identity.
- **Signposts on the Customer Journey** · 3816–3855 · pp.139–141 · "Signposts" = emotional triggers per stage. Per-stage emotion + move (3820–3852): Awareness (curiosity/frustration; skincare), Consideration (hope/anticipation; fitness-app imagery), Decision (trust/relief + Shopper High; testimonials+refund policy), Retention (satisfaction/validation; thank-you email+tips), Advocacy (pride/belonging; reviews/unboxing). → one skill (the 5-stage signpost map, verbatim).
- **The Role of Your Brand Voice in the Customer Journey** · 3859–3865 · p.142 · voice taps journey emotions.
- **Tone of Voice: Reflecting Empathy** · 3867–3874 · p.142 · tone shifts by stage; financial-services example.
- **Language Style: Simple, Emotional, Relatable** · 3876–3882 · p.142 · Airbnb "Live like a local".
- **Conclusion: Crafting a Seamless Emotional Journey** · 3886–3893 · p.142.
- **Overcoming Barriers: Anxieties & Frictions** · 3895–3926 · pp.143–144 · anxiety = top adoption barrier; "habit of the present" (Bob Moesta / Jobs-To-Be-Done); frame familiar+better; reduce friction; Apple iPhone; Slack.
- **Risk Removal: Overcoming Purchase Resistance** · 3928–3979 · pp.144–145 · 6-category risk-removal list (3937–3977): Free Trials (Amazon Wardrobe, Casper 100-night); Money-Back/Returns (Zappos 365, Nordstrom); Performance Guarantees (Domino's 30-min, Headspace 30-day); Risk-Free Subscriptions (Netflix/Spotify, Dollar Shave, Adobe 7-day); Satisfaction-or-Money-Back (Chewy, Bose 90-day); Real-World Testing (IKEA 90-day, Bonobos Guideshops). → one skill (verbatim brand list).
- **Context Matters** · 3981–3989 · p.146 · decisions context-dependent; tailor message/design/timing; "sensitive timing is everything".
- **Examples of Timing-Related Messages** · 3991–4031 · pp.146–147 · 10 timing examples (3992–4029): tax (TurboTax/H&R), January (Peloton/MyFitnessPal), back-to-school (Apple/Staples/Target), busy (HelloFresh/Blue Apron), seasonal+FOMO (Airbnb/Expedia/Skyscanner), limited events (Amazon/BestBuy/Walmart), business-cycle (Salesforce/HubSpot/Monday), seasonal habit (Netflix/Disney+/HBO), natural-reset (Progressive/Geico/Lemonade), seasonal-risk (Norton/McAfee/1Password). → one skill (verbatim).
- **The Internal Debate: Push and Pull of Change** · 4033–4051 · p.148 · push/pull; familiarity comfort; smooth transition; Microsoft Win7→10.
- **Addressing Friction Points** · 4053–4110 · pp.149–150 · 10 Friction→Solution examples (4061–4108): one-click (Amazon), free trial+cancel (Netflix), autofill+Apple Pay, 24/7 chat+returns (Zappos), tutorials+preloaded (Slack), mobile checkout (Apple), transparent pricing (Airbnb), cashier-less (Amazon Fresh), DTC fixed price (Tesla), order tracker (Domino's). → one skill (verbatim).
- **Anticipating Barriers** · 4112–4116 · p.150 · see journey through customer's eyes.
- **Examples of Anticipating Barriers** · 4118–4152 · pp.150–152 · 8 Barrier→Solution examples (4119–4152): home try-on (Warby Parker), white-glove (Peloton), 7-day return (Carvana), free tier (Spotify), first-order discount (Instacart), free CRM+webinars (HubSpot), AR try-on (Gucci). → one skill (verbatim).
- **Risk Mitigation** · 4154–4159 · p.152 · reassurance lowers perceived risk.
- **Customizing the Sales Process** · 4161–4180 · p.153 · match sales to stage; design thinking; Passive / Active / Deciding customers (defs 4169–4177).
- **Framing the Alternatives** · 4182–4187 · pp.153–154 · real alternatives beyond direct competitors.
- **Understanding the Real Competitive Set** · 4189–4202 · p.154 · problem-lens competitors; Airbnb broad competition.
- **Addressing Trade-Offs** · 4206–4218 · p.154 · price/convenience/features/reputation; Dropbox.
- **Conclusion: Guiding the Customer's Journey** · 4220–4225 · p.155 · IDEA-lens = functional+emotional+contextual.
- **CTA** 4229–4232 → EXCLUDED.

---

## CHAPTER 9 — CUSTOMER-CENTRIC PRODUCT DEVELOPMENT (4235–4524) — pp.158–166
- **Chapter intro** · 4235–4260 · IDEA + Avatar 2.0 for product dev; customer-centric principle; behavioral science + data inputs.
- **Insight-Driven Product Development** · 4262–4267 · p.158 · decisions grounded in audience understanding.
  - **How Avatar 2.0 Enhances Product Insights** · 4269–4293 · pp.158–159 · holistic picture; design for emotional needs; Peloton community evolution (4283–4293).
  - **Turning Insights into Action (3-step process)** · 4295–4331 · pp.159–160 · Identify Emotional Triggers; Translate Insights→Features (Blue Apron/HelloFresh); Solve Emotional Needs (sustainability avatar; Dyson pride). people buy on feeling not function.
- **Distinctive Product Design** · 4335–4362 · p.161 · salience > uniqueness; positioning as means; DBAs (def 4354–4357); say less more often.
  - **Applying Distinctiveness (3 tactics)** · 4365–4393 · pp.161–162 · UVP (Tefal Thermo-Spot); Design with Distinctiveness (Apple); Emotional Distinctiveness (Lululemon).
- **Empathy in Product Development** · 4396–4402 · p.162 · empathy as journey-wide design lens.
  - **Designing Empathetic Products (4 tactics)** · 4404–4442 · pp.162–163 · Solve Real Problems (Slack); Personalize (Starbucks app); Accessibility (OXO Good Grips); Map the Journey (Warby Parker).
- **Authenticity in Product Development** · 4444–4453 · p.164 · trust amid skepticism; consistency+transparency+genuine (def 4452–4453).
  - **Staying Authentic (4 tactics)** · 4456–4500 · pp.164–165 · Align with Mission (Aesop); Be Transparent (Everlane); Customer Involvement (Lego Ideas); Consistency Across Touchpoints (IKEA).
- **Conclusion: Customer-Centric Dev as Competitive Advantage** · 4502–4515 · p.166.
- **CTA** 4519–4523 → EXCLUDED.

---

## CHAPTER 10 — BUILDING YOUR PERSONAL BRAND (4525–4740) — pp.169–176
- **Chapter opener / personal brand definition** · 4525–4544 · perception/reputation/message/emotional connection; people buy/follow/trust relatable people; authenticity-vs-resonance; IDEA acronym for persons (4541–4544).
- **Why Your Personal Brand Matters** · 4546–4565 · p.169 · Trust & Connection; Differentiation; Authority & Influence; Loyalty (4548–4565).
- **Applying the IDEA Framework to Your Personal Brand** · 4567–4570 · p.169 · transition.
- **Insight-Driven: Understand Your Audience and Yourself** · 4572–4574 · pp.169–170.
  - **Step 1: Understand Your Audience** · 4576–4594 · p.170 · Identify Needs; Segment; Avatar 2.0; Listen & Observe; Empathy Map (Thinks/Feels/Says/Does 4591–4594).
  - **Step 2: Reflect on Yourself** · 4596–4609 · pp.170–171 · self-reflection 3 Qs (4599–4601); mission-statement 3 Qs (4605–4607); audience-self intersection.
- **Distinctive: Stand Out in a Crowded Space** · 4613–4616 · p.171.
  - **Step 1: Identify Your UVP** · 4618–4629 · p.171 · personal UVP; avoid generic; fill-in formula "I help [audience] achieve [outcome] by [approach]" + example (4626–4629).
  - **Step 2: Develop Your Signature Style** · 4631–4645 · pp.171–172 · visual identity; voice; Canva/Adobe Express; 3 tone adjectives (4640–4643).
- **Empathetic: Build Genuine Connections** · 4647–4649 · p.172.
  - **Step 1: Speak Their Language** · 4651–4659 · p.172 · mirror speech; avoid jargon; polls/Q&A/surveys (4656–4659).
  - **Step 2: Share Relatable Stories** · 4661–4674 · pp.172–173 · 3-element story: challenge/steps/outcome (4670–4672).
- **Authentic: Be True to Yourself** · 4676–4678 · p.173.
  - **Step 1: Define Non-Negotiable Values** · 4680–4688 · p.173 · top-3 values; align content/partnerships (4685–4688).
  - **Step 2: Show Vulnerability** · 4690–4699 · pp.173–174 · honest failure post (4696–4697).
- **Developing a Personal Brand Strategy (5 steps)** · 4701–4721 · pp.174–175 · Start with Reflection (1-sentence statement); Identify Key Platforms; Build a Content Plan (90-day calendar); Engage Consistently; Monitor and Adapt (4704–4721).
- **Why It's Worth the Effort** · 4723–4731 · pp.175–176.
- **CTA** 4735–4738 → EXCLUDED.

---

## CHAPTER 11 — RESEARCH GUIDE OVERVIEW + BACK MATTER (4741–4959) — pp.179–186
- **Chapter opener** · 4741–4756 · research over assumptions; uncover psychological/emotional drivers.
- **How to Use This Guide** · 4757–4761 · p.179 · "think like a detective" (4758–4760).
- **Core Customer Research Methods (Reviews & Feedback)** · 4762–4781 · p.179 · where-to-find list (Amazon/Google/Yelp/Facebook/Reddit/TikTok; surveys; competitor reviews) 4767–4773; recurring-pain extraction; AI sentiment tools MonkeyLearn/Lexalytics (4780–4781); IDEA map Insight+Empathetic.
- **Amazon-Specific Research (4 sources)** · 4783–4837 · pp.180–182 · Customer Reviews (ReviewMeta 4795–4796); Q&A Section ("People Also Ask"); BSR & Competitor Tracking (Helium 10 Black Box 4825–4826); Search Term Reports (ChatGPT clustering 4836–4837); functional vs emotional keywords.
- **Social Media Listening & UGC** · 4838–4857 · pp.182–183 · sources (Twitter/Instagram/TikTok/Reddit/Facebook Groups; influencer/customer video) 4847–4849; customer-own-words; Sprout Social/Brandwatch (4856–4857); IDEA map Authentic+Empathetic.
- **AI-Powered Research & Automation** · 4859–4880 · p.183 · tools list (4864–4873): Google Trends/Exploding Topics; ChatGPT/Claude personas; Lexalytics/IBM Watson; Hotjar/Crazy Egg; IDEA map Insight+Distinctive.
- **Final Thoughts: Turning Research into Action** · 4882–4891 · p.184 · Find Patterns; Adapt Messaging; Refine Targeting (4883–4888).
- **SUGGESTED FURTHER READING** · 4895–4935 · pp.185–186 · 26 cited works (Barden, Berger ×2, Breuning, Cialdini *Influence*, Kahneman, Kane, Kim & Mauborgne, Krug, Lindstrom, Miller, Ogilvy, Pulizzi, Sutherland *Alchemy*, Ries & Trout, Ellis & Brown, Pricken, Schwartz, Shotton, Eyal, Holiday, Zaltman, Heath & Heath, Shopify UK State of Commerce 2024, Harhut, Vaynerchuk). → one reference skill (the reading list, verbatim).
- **FAIR USE & COPYRIGHT DISCLAIMER** · 4938–4956 · p.187 · → EXCLUDED (legal back-matter; logged).

---

## CROSS-CUTTING BEHAVIORAL SCIENCE (woven through book; collect in 04-science-and-research/)
Grounded ONLY in the book's actual citations (cite the in-book passage, not the external book):
- **Zaltman — 95% subconscious / metaphor elicitation** — How Customers Think (cited 1093–1097, 1979–1997, 2227–2240).
- **Kahneman — System 1 vs System 2 / Thinking Fast and Slow** — (cited 1963–1977, 2158–2171).
- **Lindstrom — emotion beats logic / Buyology** — (cited 1979–1997).
- **Cialdini — reciprocity, social proof, authority, scarcity / Influence** — (cited 1979–1997, 3791–3799).
- **Freud — the subconscious drives behavior** — (cited 1082–1099).
- **Levitt — sell the drill / buy the hole (Marketing Myopia)** — (cited 1121–1123).
- **Drucker — customer rarely buys what business thinks it sells** — (cited 1124–1126).
- **Ries & Trout — Positioning: The Battle for Your Mind** — (cited 1674–1685).
- **Bob Moesta / Jobs-To-Be-Done — "habit of the present"** — (cited 3895–3926).
- **Neurochemistry — dopamine/oxytocin/cortisol/serotonin** — (cited 2111–2156; lives in Ch3 customer skills, referenced from science).
- **Loss aversion / framing effect / heuristics** — (cited 3768–3814).
NOTE: Sutherland (*Alchemy*) appears ONLY in Further Reading (no in-text teaching) → reference-only. Behavioral-science authors NOT cited by the book are out of scope (see old-19 audit in _coverage.md).
