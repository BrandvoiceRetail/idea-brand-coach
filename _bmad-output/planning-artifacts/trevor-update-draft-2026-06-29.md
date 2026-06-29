# Trevor update — draft (2026-06-29)

**Target:** #brand-coach-user-feedback (C0B9YT9TQ6T) or DM to Trevor.
**Status:** DRAFT — not sent (Slack MCP was disconnected when created). Push to Slack Drafts when reconnected.
**Voice:** UK English, no em dashes (Skill 02 red-lines).

---

Hi Trevor, a big round shipped to prod on the IDEA Brand Coach today. Everything below is live on ideabrandcoach.icodemybusiness.com and verified on the test account.

**The entry experience (your brief)**
- The ask no longer lands before value. The free diagnostic and the first fix come first; the membership ask now sits after the fix. It is reframed the way you wanted: a free trial gives the owner one funnel piece to iterate on, and membership puts their whole funnel on the Brand Defence loop with ongoing monitoring. Earn the ask, then ask.
- Results now lead with the plain-language finding (what it means for their brand), with the score underneath. Finding before number, per the brief.
- One diagnostic, one journey. The old duplicate diagnostic engine is retired so every door lands in the same flow, and the "no account first" wording that was not actually true has been removed.
- A returning owner who has already diagnosed, including via the Claude connector, is taken straight to their fix instead of starting over.

**The funnel (Fix)**
- Funnel pieces are now scoped to the brand and evaluated per customer avatar. Switch the customer and the same pieces re-judge for that customer, rather than vanishing. That was a real data model fix underneath.
- Fixed a conversion rate bug: CVR was reading about 0.1% when it was really about 5% (a formatting error). It now reads correctly.
- The funnel piece page was restyled to the dark brand shell, and an owner can now upload a screenshot of a piece and have it re-audited on the spot for their current customer.

**Reliability**
- Fixed a caching problem that was stopping updates from reaching people's browsers. Deploys now land immediately.

One thing is designed but not yet built: enforcing the free-trial limit (one piece). The placement and framing are in; the gate that actually holds people to one piece until they upgrade is the next piece of work.

Happy to walk you through any of it.
