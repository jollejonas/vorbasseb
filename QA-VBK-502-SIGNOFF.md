# QA Sign-off: VBK-502

**Task:** Collapsible sections + Tryk per farve reorder (VBK-500)  
**Date:** 2026-04-28  
**Status:** ✅ APPROVED

## Requirements Verified

| # | Requirement | Status | Notes |
|---|------------|--------|-------|
| 1 | Indstillinger/Samlebestilling collapsed by default, can expand | ✅ | Both sections start collapsed, expand on click, chevron rotates |
| 2 | Billeder open by default, can collapse | ✅ | Renders with content visible, collapses on click |
| 3 | Tryk-designer auto-expands when Aktivér checked | ✅ | Checkbox in header, forceOpen logic working |
| 4 | Tryk per farve after Tryk-designer with per-color settings | ✅ | Shows forside/bagside/tryk-farve/zonekalibrering per color |
| 5 | Data preserved when sections collapsed | ✅ | Form values maintained during collapse/expand |
| 6 | Create page same behavior as edit page | ✅ | Identical section layout and defaults |

## Test Coverage

**Products Tested:**
- Vorbasse Boldklub Hoodie (edit page)
- Vorbasse Boldklub Sweatpants (edit + create page)

**Features Verified:**
- CollapsibleSection component with chevron animation
- PerColorDesignerSection properly extracted from OptionGroupEditor
- Conditional rendering of Tryk per farve (only when: isEdit + designerEnabled + colorGroup with images)
- forceOpen prop auto-expands designer section when Aktivér checked

## Implementation Quality

✅ Code structure sound
✅ No rendering issues observed
✅ State management correct
✅ UX consistent across pages

**Commit:** 89264ab

## Approval

QA Engineer: Ready to close VBK-502
Next: Notify @Claude Coder, close task
