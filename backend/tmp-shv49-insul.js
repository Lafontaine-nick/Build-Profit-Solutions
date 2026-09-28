const fs = require('fs');
const t = require('./src/services/planPdfTextTakeoff.js');
const m = require('./src/services/estimatePlanToMeasurements.js');

const PDF = '/Users/nicholas/Library/Mobile Documents/com~apple~CloudDocs/Downloads/SHV Lot 49 Architectural Plans.pdf';

(async () => {
  const buf = fs.readFileSync(PDF);
  const pdf = await t.extractPlanTakeoffFromPdfBuffers([buf]);
  const planFacts = pdf.planFacts || {};
  const buildingAreas = pdf.buildingAreas || {};

  console.log('=== WHAT THE PLAN GAVE US ===');
  console.log('buildingAreas     ', buildingAreas);
  console.log('plateHeightFt     ', planFacts.plateHeightFt);
  console.log('wallHeightFt      ', planFacts.wallHeightFt);
  console.log('storyCount        ', planFacts.storyCount);
  console.log('exteriorPerimeterLf ', planFacts.exteriorPerimeterLf);
  console.log('foundationPerimeterLf', planFacts.foundationPerimeterLf);
  console.log('ceilingBoundary   ', planFacts.ceilingBoundary);
  console.log('elevationFaces    ', planFacts.elevationFaces);

  // Can any perimeter be parsed from the sheets at all?
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(PDF)), useSystemFonts: true, disableFontFace: true }).promise;
  console.log('\n=== PERIMETER PARSE ATTEMPTS PER PAGE ===');
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const items = tc.items.map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, height: it.height, transform: it.transform }));
    const txt = t.clusterPhrases(items).map(p => p.str).join(' ');
    const ext = t.parseLabeledPerimeter(txt, 'exterior');
    const fnd = t.parseLabeledPerimeter(txt, 'foundation');
    const env = t.parseOverallEnvelopePerimeter ? t.parseOverallEnvelopePerimeter(txt) : 'n/a';
    if (ext || fnd || (env && env !== 'n/a')) {
      console.log(`page ${i}: exterior=${JSON.stringify(ext)} foundation=${JSON.stringify(fnd)} envelope=${JSON.stringify(env)}`);
    } else {
      console.log(`page ${i}: no perimeter parsed`);
    }
  }

  // Run the real insulation derivation
  const res = m.deriveInsulationMeasurementsFromPlanFacts({}, planFacts, {
    buildingAreas,
    rawPlanFacts: planFacts,
  });
  console.log('\n=== DERIVED INSULATION MEASUREMENTS ===');
  console.log(JSON.stringify(res.measurements, null, 2));
  console.log('derivedKeys:', res.derivedKeys);
  console.log('\n=== ASSUMPTIONS ===');
  (res.assumptions || []).forEach(a => console.log(' - ' + a));

  console.log('\n=== WHAT A CORRECT TAKEOFF NEEDS ===');
  const living = buildingAreas.totalLivingSqft;
  const h = planFacts.plateHeightFt;
  console.log('ceiling / attic target  ~', living, 'sf (conditioned ceiling, single story)');
  console.log('plate height            ', h, 'ft');
  for (const p of [220, 240, 260, 280]) {
    const gross = p * h;
    console.log(`  if perimeter = ${p} LF -> gross wall ${Math.round(gross)} sf, net @15% openings ${Math.round(gross * 0.85)} sf`);
  }
})().catch(e => { console.error('ERR', e); process.exit(1); });
