// Shared trade taxonomy and normalization

export const TRADE_ALIASES: Record<string, string> = {
  // Electrical
  electrician: 'electrical',
  electrical: 'electrical',
  
  // Plumbing
  plumber: 'plumbing',
  plumbing: 'plumbing',
  
  // HVAC
  'hvac technician': 'hvac',
  hvac: 'hvac',
  heating: 'hvac',
  'heating and cooling': 'hvac',
  'air conditioning': 'hvac',
  ac: 'hvac',
  
  // Painting
  painter: 'painting',
  painting: 'painting',
  
  // Flooring
  'flooring installer': 'flooring',
  flooring: 'flooring',
  floor: 'flooring',
  'floor installer': 'flooring',
  
  // Roofing
  roofer: 'roofing',
  roofing: 'roofing',
  roof: 'roofing',
  
  // Carpentry
  carpenter: 'carpentry',
  carpentry: 'carpentry',
  'carpenter/ framer': 'carpentry',
  framer: 'carpentry',
  framing: 'carpentry',
  
  // Landscaping
  landscaper: 'landscaping',
  landscaping: 'landscaping',
  landscape: 'landscaping',
  
  // Drywall
  'drywall installer': 'drywall',
  drywall: 'drywall',
  'drywaller': 'drywall',
  'sheetrock': 'drywall',
  sheetrock: 'drywall',
  
  // Tile
  'tile setter': 'tile',
  tile: 'tile',
  tiling: 'tile',
  'tile installer': 'tile',
  
  // Concrete
  'concrete worker': 'concrete',
  concrete: 'concrete',
  'concrete contractor': 'concrete',
  'concrete finisher': 'concrete',
  
  // Fence
  'fence installer': 'fence',
  fence: 'fence',
  fencing: 'fence',
  'fence builder': 'fence',
  
  // Window
  'window installer': 'window',
  window: 'window',
  windows: 'window',
  
  // Insulation
  'insulation installer': 'insulation',
  insulation: 'insulation',
  insulator: 'insulation',
  
  // Siding
  'siding installer': 'siding',
  siding: 'siding',
  
  // Gutter
  'gutter installer': 'gutter',
  gutter: 'gutter',
  gutters: 'gutter',
  
  // Cabinet
  'cabinet installer': 'cabinet',
  cabinet: 'cabinet',
  cabinets: 'cabinet',
  'cabinet maker': 'cabinet',
  'cabinet builder': 'cabinet',
  
  // Countertop
  'countertop installer': 'countertop',
  countertop: 'countertop',
  countertops: 'countertop',
  
  // Appliance
  'appliance installer': 'appliance',
  appliance: 'appliance',
  appliances: 'appliance',
  
  // Security
  'security system installer': 'security',
  security: 'security',
  'security installer': 'security',
  
  // Solar
  'solar installer': 'solar',
  solar: 'solar',
  'solar panel': 'solar',
  'solar panels': 'solar',
  
  // Pool
  'pool installer': 'pool',
  pool: 'pool',
  pools: 'pool',
  'pool builder': 'pool',
  
  // Deck
  'deck builder': 'deck',
  deck: 'deck',
  decks: 'deck',
  'decking': 'deck',
  
  // Patio
  'patio installer': 'patio',
  patio: 'patio',
  patios: 'patio',
  
  // Driveway
  'driveway installer': 'driveway',
  driveway: 'driveway',
  driveways: 'driveway',
  
  // Foundation
  'foundation specialist': 'foundation',
  foundation: 'foundation',
  foundations: 'foundation',
  
  // Structural
  'structural engineer': 'structural',
  structural: 'structural',
  
  // Architect
  architect: 'architect',
  architecture: 'architect',
  
  // Interior Design
  'interior designer': 'interior design',
  'interior design': 'interior design',
  interior: 'interior design',
  
  // General Contractor
  'general contractor': 'general contracting',
  'general contracting': 'general contracting',
  gc: 'general contracting',
  
  // Project Manager
  'project manager': 'project management',
  'project management': 'project management',
  pm: 'project management',
};

export function normalizeTrade(input: string | undefined | null): string {
  if (!input) return '';
  const lower = input.trim().toLowerCase();
  if (TRADE_ALIASES[lower]) return TRADE_ALIASES[lower];
  // fallback: strip punctuation/plurals
  return lower.replace(/\s+/g, ' ').trim();
}

export function tradesMatch(a: string | undefined, b: string | undefined): boolean {
  const na = normalizeTrade(a);
  const nb = normalizeTrade(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // partial containment as a safety net
  return na.includes(nb) || nb.includes(na);
}



