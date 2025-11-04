const { v4: uuidv4 } = require('uuid');

// Mock database for contractor profiles
const db = {
  contractors: [
    // Sample contractors for testing
    {
      id: 'contractor-demo',
      name: 'Demo Contractor',
      email: 'demo@contractor.com',
      phone: '555-123-4567',
      trades: ['Framing', 'Concrete'],
      location: {
        city: 'Las Vegas',
        state: 'NV',
        zip: '89123',
        lat: 36.0395,
        lng: -115.1198,
      },
      serviceRadius: 50, // miles
      licensed: true,
      insured: true,
      rating: 4.8,
      completedJobs: 127,
      active: true,
      expoPushToken: null, // For push notifications
    },
    {
      id: 'contractor-002',
      name: 'Smith Construction',
      email: 'john@smithconstruction.com',
      phone: '555-234-5678',
      trades: ['HVAC', 'Plumbing'],
      location: {
        city: 'Henderson',
        state: 'NV',
        zip: '89052',
        lat: 36.0395,
        lng: -114.9817,
      },
      serviceRadius: 30,
      licensed: true,
      insured: true,
      rating: 4.5,
      completedJobs: 83,
      active: true,
      expoPushToken: null,
    },
    {
      id: 'contractor-003',
      name: 'Elite Electrical',
      email: 'contact@eliteelectrical.com',
      phone: '555-345-6789',
      trades: ['Electrical'],
      location: {
        city: 'Las Vegas',
        state: 'NV',
        zip: '89101',
        lat: 36.1699,
        lng: -115.1398,
      },
      serviceRadius: 40,
      licensed: true,
      insured: true,
      rating: 4.9,
      completedJobs: 215,
      active: true,
      expoPushToken: null,
    },
    {
      id: 'contractor-004',
      name: 'Pro Framers LLC',
      email: 'info@proframers.com',
      phone: '555-456-7890',
      trades: ['Framing', 'Drywall'],
      location: {
        city: 'North Las Vegas',
        state: 'NV',
        zip: '89030',
        lat: 36.1989,
        lng: -115.1175,
      },
      serviceRadius: 35,
      licensed: true,
      insured: true,
      rating: 4.7,
      completedJobs: 156,
      active: true,
      expoPushToken: null,
    },
  ],
};

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Radius of Earth in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

// Geocode city/state to lat/lng (mock implementation)
// In production, use Google Maps API, Mapbox, or similar
function geocodeLocation(city, state) {
  // Mock geocoding for common cities
  const cityCoords = {
    'Las Vegas,NV': { lat: 36.1699, lng: -115.1398 },
    'Henderson,NV': { lat: 36.0395, lng: -114.9817 },
    'North Las Vegas,NV': { lat: 36.1989, lng: -115.1175 },
    'Reno,NV': { lat: 39.5296, lng: -119.8138 },
    'Sparks,NV': { lat: 39.5349, lng: -119.7527 },
  };

  const key = `${city},${state}`;
  return cityCoords[key] || { lat: 36.1699, lng: -115.1398 }; // Default to Las Vegas
}

const contractorProfileService = {
  // Get all contractors
  getAllContractors: async () => {
    return db.contractors;
  },

  // Get contractor by ID
  getContractorById: async (contractorId) => {
    return db.contractors.find(c => c.id === contractorId);
  },

  // Find contractors matching a lead
  findMatchingContractors: async (lead) => {
    try {
      const { trade, location, budgetMin, budgetMax } = lead;
      
      // Get coordinates for lead location
      const leadCoords = geocodeLocation(location.city, location.state);
      
      // Filter contractors
      const matchedContractors = db.contractors.filter(contractor => {
        // 1. Must be active
        if (!contractor.active) return false;

        // 2. Must have the required trade
        if (!contractor.trades.includes(trade)) return false;

        // 3. Must be licensed and insured
        if (!contractor.licensed || !contractor.insured) return false;

        // 4. Must be within service radius
        const distance = calculateDistance(
          leadCoords.lat,
          leadCoords.lng,
          contractor.location.lat,
          contractor.location.lng
        );

        if (distance > contractor.serviceRadius) return false;

        // 5. Optional: Filter by rating (only if they have reviews)
        // Allow new contractors with no reviews (rating 0 or undefined)
        if (contractor.rating > 0 && contractor.rating < 3.5) return false;

        return true;
      });

      // Sort by rating (best first) and distance (closest first)
      matchedContractors.sort((a, b) => {
        const distanceA = calculateDistance(leadCoords.lat, leadCoords.lng, a.location.lat, a.location.lng);
        const distanceB = calculateDistance(leadCoords.lat, leadCoords.lng, b.location.lat, b.location.lng);
        
        // Primary sort by rating
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
        
        // Secondary sort by distance
        return distanceA - distanceB;
      });

      console.log(`🎯 Found ${matchedContractors.length} matching contractors for ${trade} in ${location.city}, ${location.state}`);
      
      return matchedContractors.map(c => ({
        ...c,
        distance: calculateDistance(leadCoords.lat, leadCoords.lng, c.location.lat, c.location.lng).toFixed(1),
      }));

    } catch (error) {
      console.error('Error finding matching contractors:', error);
      return [];
    }
  },

  // Update contractor push token
  updatePushToken: async (contractorId, expoPushToken) => {
    const contractor = db.contractors.find(c => c.id === contractorId);
    if (contractor) {
      contractor.expoPushToken = expoPushToken;
      console.log(`✅ Updated push token for contractor ${contractorId}`);
      return contractor;
    }
    return null;
  },

  // Create/Update contractor profile
  upsertContractor: async (contractorData) => {
    const existingIndex = db.contractors.findIndex(c => c.id === contractorData.id);
    
    if (existingIndex > -1) {
      // Update existing
      db.contractors[existingIndex] = {
        ...db.contractors[existingIndex],
        ...contractorData,
      };
      console.log(`✅ Updated contractor profile: ${contractorData.id}`);
      return db.contractors[existingIndex];
    } else {
      // Create new
      const newContractor = {
        id: contractorData.id || `contractor-${uuidv4().substr(0, 8)}`,
        ...contractorData,
      };
      db.contractors.push(newContractor);
      console.log(`✅ Created contractor profile: ${newContractor.id}`);
      return newContractor;
    }
  },
};

module.exports = { contractorProfileService, calculateDistance, geocodeLocation };

