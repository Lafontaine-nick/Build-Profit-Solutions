const express = require('express');
const axios = require('axios');
const router = express.Router();

/**
 * Yelp Fusion API Integration
 * 
 * Endpoints:
 * - GET /api/yelp/search - Search for businesses (contractors, suppliers)
 * - GET /api/yelp/business/:id - Get business details
 * - GET /api/yelp/reviews/:id - Get business reviews
 * - GET /api/yelp/test-key - Test API key status
 */

const YELP_API_BASE = 'https://api.yelp.com/v3';

/**
 * GET /api/yelp/search
 * Search for businesses by category and location
 * 
 * Query params:
 * - term: Search term (e.g., "contractors", "lumber", "electrician")
 * - location: Location (address, neighborhood, city, state, or ZIP code)
 * - categories: Yelp category aliases (e.g., "contractors", "buildingsupplies")
 * - latitude: Latitude (alternative to location)
 * - longitude: Longitude (alternative to location)
 * - radius: Search radius in meters (max 40000)
 * - limit: Number of results (default 20, max 50)
 * - sort_by: best_match (default), rating, review_count, distance
 * - open_now: true/false - only show open businesses
 * 
 * Returns: Array of businesses with basic info
 */
router.get('/search', async (req, res) => {
  const {
    term = '',
    location = '',
    categories = '',
    latitude,
    longitude,
    radius = 16000, // ~10 miles in meters
    limit = 20,
    sort_by = 'best_match',
    open_now = false
  } = req.query;

  // Validate inputs
  if (!location && (!latitude || !longitude)) {
    return res.status(400).json({
      error: 'Either location or latitude/longitude is required'
    });
  }

  try {
    console.log(`🔍 Yelp Search: "${term}" in ${location || `${latitude},${longitude}`}`);

    // Check if API key is configured
    const apiKey = process.env.YELP_API_KEY;
    if (!apiKey || apiKey === 'YOUR_YELP_API_KEY_HERE') {
      console.warn('⚠️ No Yelp API key configured, returning mock data');
      return res.json({
        businesses: generateMockBusinesses(term, location),
        total: 5,
        metadata: {
          isMockData: true,
          message: '⚠️ Using mock data. Configure YELP_API_KEY for real results.',
          dataSource: 'mock'
        }
      });
    }

    // Build search parameters
    const params = {
      limit: Math.min(parseInt(limit), 50),
      sort_by
    };

    // Add location parameters
    if (location) {
      params.location = location;
    } else {
      params.latitude = parseFloat(latitude);
      params.longitude = parseFloat(longitude);
    }

    // Add optional parameters
    if (term) params.term = term;
    if (categories) params.categories = categories;
    if (radius) params.radius = Math.min(parseInt(radius), 40000);
    if (open_now === 'true' || open_now === true) params.open_now = true;

    console.log('📡 Yelp API Request:', params);

    // Make API request
    const response = await axios.get(`${YELP_API_BASE}/businesses/search`, {
      params,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    console.log(`✅ Yelp returned ${response.data.businesses?.length || 0} businesses`);

    // Format response
    const businesses = response.data.businesses.map(formatBusiness);

    res.json({
      businesses,
      total: response.data.total,
      metadata: {
        isMockData: false,
        message: '✅ Real Yelp data',
        dataSource: 'yelp'
      }
    });

  } catch (error) {
    console.error('Yelp search error:', error.response?.data || error.message);
    
    // Return mock data on error with detailed error info
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Invalid Yelp API key',
        details: 'Check your YELP_API_KEY in .env file'
      });
    }

    res.status(500).json({
      error: error.message,
      businesses: generateMockBusinesses(term, location),
      metadata: {
        isMockData: true,
        message: '⚠️ API error, using mock data',
        dataSource: 'mock'
      }
    });
  }
});

/**
 * GET /api/yelp/business/:id
 * Get detailed information about a specific business
 * 
 * Path params:
 * - id: Yelp business ID
 * 
 * Returns: Detailed business information
 */
router.get('/business/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Business ID is required' });
  }

  try {
    console.log(`🔍 Fetching Yelp business details: ${id}`);

    const apiKey = process.env.YELP_API_KEY;
    if (!apiKey || apiKey === 'YOUR_YELP_API_KEY_HERE') {
      console.warn('⚠️ No Yelp API key configured, returning mock data');
      return res.json({
        business: generateMockBusinessDetails(id),
        metadata: {
          isMockData: true,
          message: '⚠️ Using mock data. Configure YELP_API_KEY for real results.',
          dataSource: 'mock'
        }
      });
    }

    const response = await axios.get(`${YELP_API_BASE}/businesses/${id}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    console.log(`✅ Retrieved details for: ${response.data.name}`);

    const business = formatBusinessDetails(response.data);

    res.json({
      business,
      metadata: {
        isMockData: false,
        message: '✅ Real Yelp data',
        dataSource: 'yelp'
      }
    });

  } catch (error) {
    console.error('Yelp business details error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.status(500).json({
      error: error.message,
      business: generateMockBusinessDetails(id),
      metadata: {
        isMockData: true,
        dataSource: 'mock'
      }
    });
  }
});

/**
 * GET /api/yelp/reviews/:id
 * Get reviews for a specific business
 * 
 * Path params:
 * - id: Yelp business ID
 * 
 * Query params:
 * - locale: Locale code (e.g., en_US)
 * 
 * Returns: Array of reviews (up to 3 from Yelp API)
 */
router.get('/reviews/:id', async (req, res) => {
  const { id } = req.params;
  const { locale = 'en_US' } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Business ID is required' });
  }

  try {
    console.log(`🔍 Fetching Yelp reviews for: ${id}`);

    const apiKey = process.env.YELP_API_KEY;
    if (!apiKey || apiKey === 'YOUR_YELP_API_KEY_HERE') {
      console.warn('⚠️ No Yelp API key configured, returning mock data');
      return res.json({
        reviews: generateMockReviews(id),
        total: 3,
        metadata: {
          isMockData: true,
          message: '⚠️ Using mock data. Configure YELP_API_KEY for real results.',
          dataSource: 'mock'
        }
      });
    }

    const response = await axios.get(`${YELP_API_BASE}/businesses/${id}/reviews`, {
      params: { locale },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    console.log(`✅ Retrieved ${response.data.reviews?.length || 0} reviews`);

    const reviews = response.data.reviews.map(formatReview);

    res.json({
      reviews,
      total: response.data.total,
      metadata: {
        isMockData: false,
        message: '✅ Real Yelp data',
        dataSource: 'yelp'
      }
    });

  } catch (error) {
    console.error('Yelp reviews error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.status(500).json({
      error: error.message,
      reviews: generateMockReviews(id),
      metadata: {
        isMockData: true,
        dataSource: 'mock'
      }
    });
  }
});

/**
 * GET /api/yelp/test-key
 * Test if Yelp API key is configured and valid
 */
router.get('/test-key', async (req, res) => {
  const apiKey = process.env.YELP_API_KEY;
  
  const status = {
    hasKey: !!(apiKey && apiKey !== 'YOUR_YELP_API_KEY_HERE'),
    keyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : 'Not set',
    isValid: false
  };

  if (status.hasKey) {
    try {
      // Test with a simple search
      await axios.get(`${YELP_API_BASE}/businesses/search`, {
        params: { location: 'Las Vegas', limit: 1 },
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      status.isValid = true;
      status.message = '✅ Yelp API key is valid!';
    } catch (error) {
      status.message = `❌ Yelp API key is invalid: ${error.response?.data?.error?.description || error.message}`;
    }
  } else {
    status.message = '⚠️ No Yelp API key configured';
  }

  res.json(status);
});

/**
 * Helper Functions
 */

// Format business data for consistent response
function formatBusiness(business) {
  return {
    id: business.id,
    name: business.name,
    imageUrl: business.image_url,
    url: business.url,
    rating: business.rating,
    reviewCount: business.review_count,
    categories: business.categories?.map(cat => ({
      alias: cat.alias,
      title: cat.title
    })) || [],
    location: {
      address: business.location.address1,
      city: business.location.city,
      state: business.location.state,
      zipCode: business.location.zip_code,
      country: business.location.country,
      displayAddress: business.location.display_address
    },
    coordinates: business.coordinates,
    phone: business.phone,
    displayPhone: business.display_phone,
    distance: business.distance ? Math.round(business.distance * 0.000621371 * 10) / 10 : null, // meters to miles, rounded
    isClosed: business.is_closed,
    price: business.price
  };
}

// Format detailed business data
function formatBusinessDetails(business) {
  return {
    ...formatBusiness(business),
    hours: business.hours,
    photos: business.photos,
    transactions: business.transactions,
    messaging: business.messaging,
    specialHours: business.special_hours
  };
}

// Format review data
function formatReview(review) {
  return {
    id: review.id,
    rating: review.rating,
    text: review.text,
    timeCreated: review.time_created,
    url: review.url,
    user: {
      id: review.user.id,
      name: review.user.name,
      imageUrl: review.user.image_url
    }
  };
}

// Generate mock business data for testing/fallback
function generateMockBusinesses(term, location) {
  const categories = term.toLowerCase().includes('contractor') 
    ? ['General Contractors', 'Construction', 'Home Builders']
    : term.toLowerCase().includes('lumber') || term.toLowerCase().includes('hardware')
    ? ['Building Supplies', 'Hardware Stores', 'Lumber']
    : ['Home Services', 'Contractors'];

  return Array.from({ length: 5 }, (_, i) => ({
    id: `mock-business-${i + 1}`,
    name: `${categories[0]} ${i + 1}`,
    imageUrl: `https://via.placeholder.com/300x200?text=${encodeURIComponent(categories[0])}`,
    url: `https://www.yelp.com/biz/mock-business-${i + 1}`,
    rating: 4.0 + Math.random(),
    reviewCount: Math.floor(Math.random() * 200) + 20,
    categories: [{ alias: 'contractors', title: categories[0] }],
    location: {
      address: `${1000 + i * 100} Main Street`,
      city: location || 'Las Vegas',
      state: 'NV',
      zipCode: '89101',
      country: 'US',
      displayAddress: [`${1000 + i * 100} Main Street`, `${location || 'Las Vegas'}, NV 89101`]
    },
    coordinates: {
      latitude: 36.1699 + (Math.random() - 0.5) * 0.1,
      longitude: -115.1398 + (Math.random() - 0.5) * 0.1
    },
    phone: `+1702555${String(i).padStart(4, '0')}`,
    displayPhone: `(702) 555-${String(i).padStart(4, '0')}`,
    distance: (i + 1) * 1.5, // miles
    isClosed: false,
    price: '$'.repeat(Math.min(i % 3 + 1, 4))
  }));
}

// Generate mock business details
function generateMockBusinessDetails(id) {
  return {
    id,
    name: 'Mock Business Name',
    imageUrl: 'https://via.placeholder.com/300x200?text=Business',
    url: `https://www.yelp.com/biz/${id}`,
    rating: 4.5,
    reviewCount: 127,
    categories: [{ alias: 'contractors', title: 'General Contractors' }],
    location: {
      address: '1234 Main Street',
      city: 'Las Vegas',
      state: 'NV',
      zipCode: '89101',
      country: 'US',
      displayAddress: ['1234 Main Street', 'Las Vegas, NV 89101']
    },
    coordinates: {
      latitude: 36.1699,
      longitude: -115.1398
    },
    phone: '+17025550123',
    displayPhone: '(702) 555-0123',
    distance: 2.5,
    isClosed: false,
    price: '$$',
    hours: [{
      open: [
        { day: 0, start: '0800', end: '1700' },
        { day: 1, start: '0800', end: '1700' },
        { day: 2, start: '0800', end: '1700' },
        { day: 3, start: '0800', end: '1700' },
        { day: 4, start: '0800', end: '1700' },
        { day: 5, start: '0800', end: '1500' }
      ],
      hours_type: 'REGULAR',
      is_open_now: true
    }],
    photos: [
      'https://via.placeholder.com/600x400?text=Photo+1',
      'https://via.placeholder.com/600x400?text=Photo+2',
      'https://via.placeholder.com/600x400?text=Photo+3'
    ],
    transactions: ['pickup', 'delivery']
  };
}

// Generate mock reviews
function generateMockReviews(businessId) {
  return Array.from({ length: 3 }, (_, i) => ({
    id: `mock-review-${businessId}-${i + 1}`,
    rating: 4 + i % 2,
    text: `This is a mock review for testing purposes. The business provided excellent service and quality work. ${i === 0 ? 'Highly recommended!' : i === 1 ? 'Will use again!' : 'Great experience overall!'}`,
    timeCreated: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString(),
    url: `https://www.yelp.com/user_details?userid=mock-user-${i + 1}`,
    user: {
      id: `mock-user-${i + 1}`,
      name: `User ${i + 1}`,
      imageUrl: `https://via.placeholder.com/150?text=User+${i + 1}`
    }
  }));
}

module.exports = router;

