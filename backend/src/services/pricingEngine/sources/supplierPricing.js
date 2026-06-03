/**
 * Supplier / SKU pricing — extend when catalog APIs are wired.
 */
function lookupSupplierPricing(_scopeItem, _context) {
  return {
    available: false,
    rates: [],
    message: 'Supplier pricing not connected for this item',
  };
}

module.exports = { lookupSupplierPricing };
