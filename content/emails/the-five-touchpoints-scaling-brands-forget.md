---
subject: 5 touchpoints you forgot when you scaled
preview: Three new SKUs launched, zero welcome series between them
week: 29
send: a
theme: checklist
funnel: welcome_series
tools: list_funnel_inventory, get_funnel_coverage
---

A facial-oil founder launched three new SKUs this quarter. Good quarter, by most measures — new revenue lines, shelf space growing, nothing on fire.

Then she pulled `get_funnel_coverage` across the whole brand and saw the actual coverage picture: two of the three new SKUs had no welcome series and no insert cards at all. Not underperforming ones. Nonexistent. The touchpoints that exist for her original bestseller had simply never been built for the SKUs that shipped after it.

This is the pattern behind most "we scaled and something broke" moments. Launching a SKU means building the product, the listing, and maybe the ad campaign. It rarely means auditing every touchpoint that already exists elsewhere in the funnel and copying the ones that are missing. Nobody decides to skip a welcome_series. It just never makes the launch checklist, because the checklist is about getting the product live, not about parity with everything else you've already built.

`list_funnel_inventory` alone wouldn't have caught it — it lists every touchpoint that exists anywhere in the brand, blended, and would've said "yes, we have a welcome series" and been technically true while two-thirds of her current catalog had none. `get_funnel_coverage` is the one that reports gaps per SKU instead of one blended brand-level view.

Five touchpoints worth auditing the next time you add a SKU, all things `get_funnel_coverage` will actually show you missing:

1. Welcome series — does this SKU's first buyer get onboarded, or only your original bestseller's buyer?
2. Insert cards — printed and in the box, or still on the older product's version?
3. Order confirmation email — generic, or does it mention what they actually bought?
4. Review request flow — timed to this product's use case, or copied wholesale from another SKU?
5. Winback/replenishment — does this product even have a repurchase cycle mapped yet?

Before your next launch, run `get_funnel_coverage` against the SKUs you already shipped this year. The gaps are usually not close calls.

https://ideabrandcoach.com/diagnostic

— The IDEA Brand Coach team
