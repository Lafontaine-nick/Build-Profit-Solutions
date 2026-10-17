/**
 * A note that names more than one trade is one bid.
 * The checklist is the named lines. Unnamed trades stay off.
 */
import {
  dedicatedDrywallConfirmScopeItems,
  notesDescribeDedicatedDrywallJob,
  notesDescribeDedicatedDrywallPatchJob,
  notesDescribeNoteRatedDrywallJob,
  notesDescribeSheetrockFinishJob,
  notesNameDrywallBesideFlooring,
  notesNameDrywallFlooringPatchOnly,
} from '@/utils/drywallNoteScope';

type ExplicitScopeItem = {
  id: string;
  inputType: 'yes_no';
  label: string;
  helperText: string;
  category: string;
  state: 'included';
  noteBacked: true;
};

/** Drywall plus flooring in the same note. */
export function notesDescribeDrywallAndFlooringJob(
  notes: string | null | undefined
): boolean {
  return notesNameDrywallBesideFlooring(notes);
}

/** National hang rate: a drywall-only hang, sheetrock finish, or hang beside flooring. */
export function notesPriceNationalDrywallHang(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (notesDescribeNoteRatedDrywallJob(text)) return false;
  if (notesDescribeDedicatedDrywallPatchJob(text)) return false;
  return (
    notesDescribeDedicatedDrywallJob(text) ||
    notesDescribeSheetrockFinishJob(text) ||
    notesDescribeDrywallAndFlooringJob(text)
  );
}

export function explicitCrossTradeScopeItems(
  notes: string | null | undefined
): ExplicitScopeItem[] | null {
  const text = String(notes || '');
  if (!notesDescribeDrywallAndFlooringJob(text)) return null;
  const drywallItems = notesNameDrywallFlooringPatchOnly(text)
    ? [
        {
          id: 'patch_repair',
          inputType: 'yes_no' as const,
          label: 'Drywall patch / repair',
          helperText: 'Patch the drywall area named in the notes.',
          category: 'Drywall',
          state: 'included' as const,
          noteBacked: true as const,
        },
      ]
    : dedicatedDrywallConfirmScopeItems(text).filter(
        item =>
          item.id === 'drywall' ||
          item.id === 'demo_removal' ||
          item.id === 'patch_repair'
      );
  const flooringPricedInNotes = /\$\s*\d/.test(text);
  return [
    ...drywallItems,
    {
      id: 'flooring',
      inputType: 'yes_no',
      label: 'Flooring',
      helperText: flooringPricedInNotes
        ? 'Install the flooring area at the rates in the notes.'
        : 'Install the flooring area named in the notes.',
      category: 'Flooring',
      state: 'included',
      noteBacked: true,
    },
  ];
}
