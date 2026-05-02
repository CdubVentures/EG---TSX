/**
 * navbar-editor.ts — Pure mutation functions for the Navbar panel.
 *
 * Each function takes (panel, changes) and returns [updatedPanel, updatedChanges].
 * No side effects, no IO, no React imports.
 */

import type {
  NavbarBrandChange,
  NavbarBrandItem,
  NavbarGameItem,
  NavbarGuideItem,
  NavbarGuideSection,
  NavbarLocalChanges,
  NavbarPanelPayload,
  NavbarSectionOrder,
} from './desktop-model';

type Result = [NavbarPanelPayload, NavbarLocalChanges];

// ── Guides ──────────────────────────────────────────────────────────────

export function moveGuideToSection(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
  slug: string,
  category: string,
  toSection: string,
): Result {
  const categorySections = panel.guideSections[category];
  if (!categorySections) {
    return [panel, changes];
  }

  // Find and remove the guide from its current section
  let movedItem: NavbarGuideItem | null = null;
  const withoutItem = categorySections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.slug === slug) {
        movedItem = item;
        return false;
      }
      return true;
    }),
  }));

  if (!movedItem) {
    return [panel, changes];
  }

  // Place in target section
  const targetName = toSection || 'Unassigned';
  const updatedItem: NavbarGuideItem = {
    ...movedItem,
    section: toSection,
  };

  const finalSections = withoutItem.map((section) =>
    section.name === targetName
      ? { ...section, items: [...section.items, updatedItem] }
      : section,
  );

  const navbar = toSection ? [toSection] : [];
  return [
    {
      ...panel,
      guideSections: { ...panel.guideSections, [category]: finalSections },
    },
    {
      ...changes,
      guideChanges: {
        ...changes.guideChanges,
        [slug]: { slug, category, navbar },
      },
      sectionOrder: changes.sectionOrder ?? { ...panel.sectionOrder },
    },
  ];
}

export function addSection(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
  category: string,
  name: string,
): Result {
  const trimmed = name.trim();
  if (!trimmed) {
    return [panel, changes];
  }

  const categorySections = panel.guideSections[category] ?? [];
  if (categorySections.some((s) => s.name === trimmed)) {
    return [panel, changes];
  }

  // Insert before Unassigned
  const unassignedIndex = categorySections.findIndex((s) => s.name === 'Unassigned');
  const insertAt = unassignedIndex >= 0 ? unassignedIndex : categorySections.length;
  const newSection: NavbarGuideSection = { name: trimmed, items: [] };
  const updated = [
    ...categorySections.slice(0, insertAt),
    newSection,
    ...categorySections.slice(insertAt),
  ];

  const baseSectionOrder = changes.sectionOrder ?? { ...panel.sectionOrder };
  const catOrder = [...(baseSectionOrder[category] ?? [])];
  if (!catOrder.includes(trimmed)) {
    catOrder.push(trimmed);
  }

  return [
    {
      ...panel,
      guideSections: { ...panel.guideSections, [category]: updated },
    },
    {
      ...changes,
      sectionOrder: { ...baseSectionOrder, [category]: catOrder },
    },
  ];
}

export function deleteSection(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
  category: string,
  name: string,
): Result {
  if (name === 'Unassigned') {
    return [panel, changes];
  }

  const categorySections = panel.guideSections[category] ?? [];
  const sectionToDelete = categorySections.find((s) => s.name === name);
  if (!sectionToDelete) {
    return [panel, changes];
  }

  // Move items to Unassigned
  const orphanedItems = sectionToDelete.items.map((item) => ({
    ...item,
    section: '',
  }));

  let nextChanges = { ...changes, guideChanges: { ...changes.guideChanges } };
  for (const item of orphanedItems) {
    nextChanges.guideChanges[item.slug] = {
      slug: item.slug,
      category: item.category,
      navbar: [],
    };
  }

  const updated = categorySections
    .filter((s) => s.name !== name)
    .map((s) =>
      s.name === 'Unassigned'
        ? { ...s, items: [...s.items, ...orphanedItems] }
        : s,
    );

  const baseSectionOrder = nextChanges.sectionOrder ?? { ...panel.sectionOrder };
  const catOrder = (baseSectionOrder[category] ?? []).filter((s) => s !== name);

  return [
    {
      ...panel,
      guideSections: { ...panel.guideSections, [category]: updated },
    },
    {
      ...nextChanges,
      sectionOrder: { ...baseSectionOrder, [category]: catOrder },
    },
  ];
}

export function renameSection(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
  category: string,
  oldName: string,
  newName: string,
): Result {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName || oldName === 'Unassigned') {
    return [panel, changes];
  }

  const categorySections = panel.guideSections[category] ?? [];
  if (categorySections.some((s) => s.name === trimmed)) {
    return [panel, changes];
  }

  let nextChanges = { ...changes, guideChanges: { ...changes.guideChanges } };

  const updated = categorySections.map((section) => {
    if (section.name !== oldName) {
      return section;
    }
    const renamedItems = section.items.map((item) => ({
      ...item,
      section: trimmed,
    }));
    // Record each guide's new navbar value
    for (const item of renamedItems) {
      nextChanges.guideChanges[item.slug] = {
        slug: item.slug,
        category: item.category,
        navbar: [trimmed],
      };
    }
    return { name: trimmed, items: renamedItems };
  });

  const baseSectionOrder = nextChanges.sectionOrder ?? { ...panel.sectionOrder };
  const catOrder = (baseSectionOrder[category] ?? []).map((s) =>
    s === oldName ? trimmed : s,
  );

  return [
    {
      ...panel,
      guideSections: { ...panel.guideSections, [category]: updated },
    },
    {
      ...nextChanges,
      sectionOrder: { ...baseSectionOrder, [category]: catOrder },
    },
  ];
}

export function reorderSection(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
  category: string,
  index: number,
  direction: -1 | 1,
): Result {
  const baseSectionOrder = changes.sectionOrder ?? { ...panel.sectionOrder };
  const catOrder = [...(baseSectionOrder[category] ?? [])];
  const newIndex = index + direction;

  if (index < 0 || index >= catOrder.length || newIndex < 0 || newIndex >= catOrder.length) {
    return [panel, changes];
  }

  const [moved] = catOrder.splice(index, 1);
  catOrder.splice(newIndex, 0, moved);

  // Reorder the panel's guideSections to match
  const categorySections = panel.guideSections[category] ?? [];
  const sectionByName = new Map(categorySections.map((s) => [s.name, s]));
  const ordered: NavbarGuideSection[] = [];
  for (const name of catOrder) {
    const section = sectionByName.get(name);
    if (section) {
      ordered.push(section);
    }
  }
  // Append Unassigned at end
  const unassigned = sectionByName.get('Unassigned');
  if (unassigned) {
    ordered.push(unassigned);
  }

  return [
    {
      ...panel,
      guideSections: { ...panel.guideSections, [category]: ordered },
    },
    {
      ...changes,
      sectionOrder: { ...baseSectionOrder, [category]: catOrder },
    },
  ];
}

export function renameGuide(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
  slug: string,
  newName: string,
): Result {
  const trimmed = newName.trim();
  if (!trimmed) {
    return [panel, changes];
  }

  const updatedSections: Record<string, NavbarGuideSection[]> = {};
  for (const [cat, sections] of Object.entries(panel.guideSections)) {
    updatedSections[cat] = sections.map((section) => ({
      ...section,
      items: section.items.map((item) =>
        item.slug === slug ? { ...item, guide: trimmed, title: trimmed } : item,
      ),
    }));
  }

  return [
    { ...panel, guideSections: updatedSections },
    {
      ...changes,
      renames: [
        ...changes.renames,
        { slug, collection: 'guides' as const, field: 'guide', value: trimmed },
      ],
    },
  ];
}

// ── Brands ──────────────────────────────────────────────────────────────

export function addBrandToCategory(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
  slug: string,
  category: string,
): Result {
  const brand = panel.brands.find((b) => b.slug === slug);
  if (!brand) {
    return [panel, changes];
  }

  const nextCategories = brand.categories.includes(category)
    ? brand.categories
    : [...brand.categories, category];
  const nextNavbar = brand.navbar.includes(category)
    ? brand.navbar
    : [...brand.navbar, category];

  const updatedBrands = panel.brands.map((b) =>
    b.slug === slug
      ? { ...b, categories: nextCategories, navbar: nextNavbar }
      : b,
  );

  return [
    { ...panel, brands: updatedBrands },
    {
      ...changes,
      brandChanges: {
        ...changes.brandChanges,
        [slug]: { slug, categories: nextCategories, navbar: nextNavbar },
      },
    },
  ];
}

export function removeBrandFromCategory(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
  slug: string,
  category: string,
): Result {
  const brand = panel.brands.find((b) => b.slug === slug);
  if (!brand) {
    return [panel, changes];
  }

  const nextCategories = brand.categories.filter((c) => c !== category);
  const nextNavbar = brand.navbar.filter((c) => c !== category);

  const updatedBrands = panel.brands.map((b) =>
    b.slug === slug
      ? { ...b, categories: nextCategories, navbar: nextNavbar }
      : b,
  );

  return [
    { ...panel, brands: updatedBrands },
    {
      ...changes,
      brandChanges: {
        ...changes.brandChanges,
        [slug]: { slug, categories: nextCategories, navbar: nextNavbar },
      },
    },
  ];
}

export function toggleBrandNavbar(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
  slug: string,
  category: string,
): Result {
  const brand = panel.brands.find((b) => b.slug === slug);
  if (!brand) {
    return [panel, changes];
  }

  const isInNavbar = brand.navbar.includes(category);
  const nextNavbar = isInNavbar
    ? brand.navbar.filter((c) => c !== category)
    : [...brand.navbar, category];

  const updatedBrands = panel.brands.map((b) =>
    b.slug === slug ? { ...b, navbar: nextNavbar } : b,
  );

  return [
    { ...panel, brands: updatedBrands },
    {
      ...changes,
      brandChanges: {
        ...changes.brandChanges,
        [slug]: { slug, categories: brand.categories, navbar: nextNavbar },
      },
    },
  ];
}

export function renameBrand(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
  slug: string,
  newName: string,
): Result {
  const trimmed = newName.trim();
  if (!trimmed) {
    return [panel, changes];
  }

  const updatedBrands = panel.brands.map((b) =>
    b.slug === slug ? { ...b, displayName: trimmed } : b,
  );

  return [
    { ...panel, brands: updatedBrands },
    {
      ...changes,
      renames: [
        ...changes.renames,
        { slug, collection: 'brands' as const, field: 'displayName', value: trimmed },
      ],
    },
  ];
}

// ── Games ───────────────────────────────────────────────────────────────

export function toggleGame(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
  slug: string,
  value: boolean,
): Result {
  const updatedGames = panel.games.map((g) =>
    g.slug === slug ? { ...g, navbar: value } : g,
  );

  return [
    { ...panel, games: updatedGames },
    {
      ...changes,
      gameChanges: {
        ...changes.gameChanges,
        [slug]: { slug, navbar: value },
      },
    },
  ];
}

export function toggleAllGames(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
): Result {
  const allActive = panel.games.every((g) => g.navbar);
  const nextValue = !allActive;

  const updatedGames = panel.games.map((g) => ({ ...g, navbar: nextValue }));
  const nextGameChanges = { ...changes.gameChanges };
  for (const game of updatedGames) {
    nextGameChanges[game.slug] = { slug: game.slug, navbar: nextValue };
  }

  return [
    { ...panel, games: updatedGames },
    { ...changes, gameChanges: nextGameChanges },
  ];
}

export function renameGame(
  panel: NavbarPanelPayload,
  changes: NavbarLocalChanges,
  slug: string,
  newName: string,
): Result {
  const trimmed = newName.trim();
  if (!trimmed) {
    return [panel, changes];
  }

  const updatedGames = panel.games.map((g) =>
    g.slug === slug ? { ...g, game: trimmed, title: trimmed } : g,
  );

  return [
    { ...panel, games: updatedGames },
    {
      ...changes,
      renames: [
        ...changes.renames,
        { slug, collection: 'games' as const, field: 'game', value: trimmed },
      ],
    },
  ];
}
