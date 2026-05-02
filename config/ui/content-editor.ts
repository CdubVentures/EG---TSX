import { uniqueSorted, type ContentPanelPayload } from './desktop-model';

function sortManualSlots(manualSlots: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(manualSlots).sort(
      ([left], [right]) => Number.parseInt(left, 10) - Number.parseInt(right, 10),
    ),
  );
}

function nextOpenSlot(panel: ContentPanelPayload): number | null {
  const slotNumbers = new Set(
    Object.keys(panel.manualSlots).map((slot) => Number.parseInt(slot, 10)),
  );

  for (let slotNumber = 1; slotNumber <= panel.summary.slotCount; slotNumber += 1) {
    if (!slotNumbers.has(slotNumber)) {
      return slotNumber;
    }
  }

  return null;
}

export function assignArticleToSlot(
  panel: ContentPanelPayload,
  articleKey: string,
  slotNumber?: number,
): ContentPanelPayload {
  const targetSlot = slotNumber ?? nextOpenSlot(panel);
  if (targetSlot === null) {
    return panel;
  }

  const nextManualSlots = Object.fromEntries(
    Object.entries(panel.manualSlots).filter(
      ([currentSlot, currentKey]) =>
        currentKey !== articleKey && Number.parseInt(currentSlot, 10) !== targetSlot,
    ),
  );
  nextManualSlots[String(targetSlot)] = articleKey;

  return {
    ...panel,
    manualSlots: sortManualSlots(nextManualSlots),
  };
}

export function moveAssignedArticle(
  panel: ContentPanelPayload,
  fromSlot: number,
  toSlot: number,
): ContentPanelPayload {
  if (fromSlot === toSlot) {
    return panel;
  }

  const sourceKey = panel.manualSlots[String(fromSlot)];
  if (!sourceKey) {
    return panel;
  }

  const destinationKey = panel.manualSlots[String(toSlot)];
  const nextManualSlots = { ...panel.manualSlots };

  delete nextManualSlots[String(fromSlot)];
  nextManualSlots[String(toSlot)] = sourceKey;

  if (destinationKey) {
    nextManualSlots[String(fromSlot)] = destinationKey;
  }

  return {
    ...panel,
    manualSlots: sortManualSlots(nextManualSlots),
  };
}

export function removeArticleFromSlot(
  panel: ContentPanelPayload,
  slotNumber: number,
): ContentPanelPayload {
  const slotKey = String(slotNumber);
  if (!(slotKey in panel.manualSlots)) {
    return panel;
  }

  const nextManualSlots = { ...panel.manualSlots };
  delete nextManualSlots[slotKey];

  return {
    ...panel,
    manualSlots: sortManualSlots(nextManualSlots),
  };
}

export function resetManualSlots(panel: ContentPanelPayload): ContentPanelPayload {
  if (Object.keys(panel.manualSlots).length === 0) {
    return panel;
  }

  return {
    ...panel,
    manualSlots: {},
  };
}

export function setArticleExcluded(
  panel: ContentPanelPayload,
  articleKey: string,
  isExcluded: boolean,
): ContentPanelPayload {
  const nextExcluded = isExcluded
    ? uniqueSorted([...panel.excluded, articleKey])
    : panel.excluded.filter((key) => key !== articleKey);

  const nextManualSlots = isExcluded
    ? Object.fromEntries(
        Object.entries(panel.manualSlots).filter(([, currentKey]) => currentKey !== articleKey),
      )
    : panel.manualSlots;

  return {
    ...panel,
    manualSlots: sortManualSlots(nextManualSlots),
    excluded: nextExcluded,
  };
}

export function setArticlePinned(
  panel: ContentPanelPayload,
  articleKey: string,
  isPinned: boolean,
): ContentPanelPayload {
  return {
    ...panel,
    pinned: isPinned
      ? uniqueSorted([...panel.pinned, articleKey])
      : panel.pinned.filter((key) => key !== articleKey),
  };
}

export function setArticleBadge(
  panel: ContentPanelPayload,
  articleKey: string,
  badgeText: string,
): ContentPanelPayload {
  const nextBadge = badgeText.trim();
  const nextBadges = { ...panel.badges };

  if (nextBadge) {
    nextBadges[articleKey] = nextBadge;
  } else {
    delete nextBadges[articleKey];
  }

  return {
    ...panel,
    badges: Object.fromEntries(
      Object.entries(nextBadges).sort(([left], [right]) =>
        left.localeCompare(right, undefined, { sensitivity: 'base' }),
      ),
    ),
  };
}
