import { normalizeExpenseGroupLabel } from '@/utils/groupCategoryExpenses';

export function expenseSubtitleLines(item: {
  vendor?: string | null;
  material?: string | null;
  description?: string | null;
}): { material?: string; description?: string } {
  const vendorNorm = normalizeExpenseGroupLabel(item.vendor);
  const material = item.material?.trim();
  const description = item.description?.trim();
  const materialNorm = normalizeExpenseGroupLabel(material);
  const descriptionNorm = normalizeExpenseGroupLabel(description);

  const showMaterial = Boolean(material && materialNorm && materialNorm !== vendorNorm);
  const showDescription = Boolean(
    description &&
      descriptionNorm &&
      descriptionNorm !== vendorNorm &&
      descriptionNorm !== materialNorm
  );

  return {
    material: showMaterial ? material : undefined,
    description: showDescription ? description : undefined,
  };
}
