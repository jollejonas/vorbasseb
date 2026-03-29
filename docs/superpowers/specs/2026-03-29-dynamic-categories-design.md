# Dynamic Categories & Subcategories — Design Spec

**Issue:** #25
**Date:** 2026-03-29
**Status:** Approved

---

## Context

The shop currently has a flat list of 4 hardcoded-ish categories (Spillertøj, Træningstøj, Fritidstøj, Tilbehør) stored in the database. There is no admin UI to manage them — categories can only be changed via direct DB manipulation. Issue #25 requests the ability to add subcategories (e.g. Fritidstøj → Børn) and to manage all categories dynamically from the admin panel.

---

## Goals

- Allow admins to create, rename, reorder, and delete top-level categories and subcategories
- Support 2-level nesting only (category → subcategory)
- Products can be assigned to either a top-level category or a subcategory
- The shop filter sidebar shows subcategories indented under their parent (always expanded)
- Filtering by a top-level category includes all products in its subcategories

---

## Data Model

### Schema change — `prisma/schema.prisma`

Add `parentId`, `parent`, and `children` to the existing `Category` model:

```prisma
model Category {
  id       String     @id @default(cuid())
  name     String
  slug     String     @unique
  position Int
  products Product[]

  parentId String?
  parent   Category?  @relation("SubCategories", fields: [parentId], references: [id])
  children Category[] @relation("SubCategories")

  @@index([position])
}
```

No changes to `Product` — `categoryId` stays as-is and can point to either level.

Run `npx prisma db push` then `npx prisma generate` after this change.

---

## API

### Existing — updated

**`GET /api/categories`** (`app/api/categories/route.ts`)
- Add `where: { parentId: null }` to return only top-level categories
- Add `include: { children: { orderBy: { position: 'asc' } } }` to nest subcategories
- Result: top-level categories ordered by position, each with their `children` array

### New — admin-only (require ADMIN role)

**`POST /api/admin/categories`** (`app/api/admin/categories/route.ts`)
- Body: `{ name, parentId? }`
- Auto-generates slug from name (e.g. "Fritidstøj" → `fritidstoj`)
- Slug must be globally unique — if slug already exists, append a numeric suffix (`born-2`, `born-3`, etc.)
- Sets position to max existing + 1 (within same parent scope: top-level positions independent from subcategory positions)
- Enforces 2-level limit: reject with 400 if the specified parent already has a parent

**`PUT /api/admin/categories/[id]`** (`app/api/admin/categories/[id]/route.ts`)
- Body: `{ name?, position? }` — rename and/or reorder
- If name changes: regenerate slug with same collision-avoidance suffix logic
- If position changes: swap positions with the adjacent sibling at the same level (same `parentId`)
- ↑/↓ buttons in the UI are disabled/hidden when the item is already first or last at its level

**`DELETE /api/admin/categories/[id]`** (`app/api/admin/categories/[id]/route.ts`)
- Explicit order of operations to avoid FK constraint violations:
  1. Find all subcategories of this category (children where `parentId = id`)
  2. Set `categoryId = null` on all products assigned to this category or any of its subcategories
  3. Delete all subcategories
  4. Delete the category itself
- Note: no Prisma `onDelete` cascade is used — everything handled explicitly in the handler
- Returns `{ affectedProducts: number }` so the client can show a warning in the confirmation modal

---

## Admin UI

### New page: `/admin/kategorier`

**Files:**
- `app/(admin)/admin/kategorier/page.tsx`
- `components/admin/CategoryManager.tsx`

**Layout:**

```
Spillertøj                          [↑] [↓] [Omdøb] [Slet]
  + Tilføj underkategori

Fritidstøj                          [↑] [↓] [Omdøb] [Slet]
  ↳ Børn                            [↑] [↓] [Omdøb] [Slet]
  ↳ Voksne                          [↑] [↓] [Omdøb] [Slet]
  + Tilføj underkategori

+ Tilføj kategori
```

**Interactions:**
- **Create**: Click "+ Tilføj kategori / underkategori" → inline input appears, submit adds to DB
- **Rename**: Click "Omdøb" → inline edit field replaces the name, saves on Enter/blur
- **Reorder**: ↑/↓ buttons swap position within the same level (top-level with top-level, subcategory with siblings)
- **Delete**: Confirmation modal. If products are affected: "X produkter bruger denne kategori. De vil miste deres kategoritildeling." Requires explicit confirmation before proceeding.

### Admin navigation

Add "Kategorier" link to the admin dashboard (`app/(admin)/admin/page.tsx`) alongside Produkter, Ordrer, etc.

---

## Shop Filter Sidebar

**File:** `components/shop/FilterContent.tsx`

Render subcategories indented under their parent, always expanded:

```
Alle produkter
Spillertøj
Træningstøj
Fritidstøj
  ↳ Børn
  ↳ Voksne
Tilbehør
```

- Clicking a top-level category with subcategories: filters to all products in that category OR any of its subcategories (query: `categoryId IN [parentId, ...childIds]`)
- Clicking a subcategory: filters to just that subcategory
- URL pattern unchanged: `/butik?kategori=<slug>`

**File:** `app/(shop)/butik/page.tsx`
- Fetch categories with `include: { children: true }` (or reuse the categories already fetched for the sidebar)
- When the `kategori` slug matches a top-level category that has children, collect `categoryIds = [parent.id, ...parent.children.map(c => c.id)]`; otherwise `categoryIds = [matched.id]`
- Update the products `where` clause to use `categoryId: { in: categoryIds }`
- Update the sizes availability query with the same `categoryId: { in: categoryIds }` scope
- For the active filter pill label: search both top-level categories and their children (flatten `categories` + `categories.flatMap(c => c.children)`) to find the matching category by slug

---

## Product Form — Category Picker

**File:** `components/admin/ProductForm.tsx`

Replace the flat `<select>` with a grouped picker using `<optgroup>`:

```
-- Ingen kategori --
Spillertøj
Træningstøj
Fritidstøj
  ↳ Børn
  ↳ Voksne
Tilbehør
```

- Top-level categories without subcategories: regular `<option>`
- Top-level categories with subcategories: `<optgroup label="Fritidstøj">` containing `<option>` for each child, plus a "Fritidstøj (generel)" option for assigning to the parent directly

---

## Breadcrumb (Product Detail Page)

**File:** `app/(shop)/butik/[slug]/page.tsx`

Currently: `Butik / Spillertøj / Product Name`

With subcategory: `Butik / Fritidstøj / Børn / Product Name`

Update the breadcrumb logic to walk up the parent chain (max 1 level).

---

## Verification

1. Run `npx prisma db push` — confirm schema applies cleanly
2. Visit `/admin/kategorier` — create a top-level category, add two subcategories, rename one, use ↑/↓ to reorder
3. Verify ↑ is disabled on the first item and ↓ is disabled on the last item at each level
4. Create two categories with the same name — verify the second gets a `-2` slug suffix
5. Assign a product to a subcategory in the product form; verify the `<optgroup>` renders correctly
6. Visit `/butik` — verify filter sidebar shows subcategories indented under their parent
7. Click a top-level category with subcategories — verify products from all subcategories appear, and the filter pill shows the correct category name
8. Click a subcategory — verify only that subcategory's products appear
9. Visit a product detail page assigned to a subcategory — verify breadcrumb shows `Butik / Fritidstøj / Børn / Product`
10. Delete a top-level category that has subcategories with assigned products — verify: warning modal shows correct count, subcategories are deleted, all affected products have `categoryId = null` after deletion
