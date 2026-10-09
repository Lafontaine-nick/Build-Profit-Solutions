const { hydrateProjectsFromDatabase } = require('./leadStorage');
const { hydratePricingMemoryFromDatabase } = require('./contractorPricingMemory/storage');

async function hydrateDurableStores() {
  await hydrateProjectsFromDatabase();
  await hydratePricingMemoryFromDatabase();
  if (
    (process.env.NODE_ENV === 'production' || String(process.env.RENDER || '').toLowerCase() === 'true') &&
    !process.env.DATABASE_URL
  ) {
    console.error(
      'DATABASE_URL is not set. Project backups and saved prices are on local disk and will not survive a restart.'
    );
  }
}

module.exports = { hydrateDurableStores };
