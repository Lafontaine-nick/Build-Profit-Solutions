export function distanceMi(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => d * Math.PI / 180;
  
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  
  const h = Math.sin(dLat / 2) ** 2 + 
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Comprehensive geocoding for US cities - All 50 States
 * Returns coordinates for city/state combinations
 * Includes major cities from all 50 states for nationwide coverage
 */
export function geocodeCity(city: string, state: string): { lat: number; lng: number } | null {
  const normalizedCity = city.trim().replace(/\./g, '').toLowerCase();
  const normalizedState = state.trim().toUpperCase();
  
  // Handle common misspellings and variations
  const cityCorrections: Record<string, string> = {
    'los angelas': 'los angeles',  // Common misspelling
    'los angeles': 'los angeles',
    'san diego': 'san diego',
    'san fransisco': 'san francisco',
    'new york city': 'new york',
    'nyc': 'new york',
    'st louis': 'st louis',
    'saint louis': 'st louis',
    'st. louis': 'st louis',
  };
  
  const correctedCity = cityCorrections[normalizedCity] || normalizedCity;
  const key = `${correctedCity},${normalizedState}`;
  
  // Comprehensive city coordinates database - All 50 States
  const cityCoords: Record<string, { lat: number; lng: number }> = {
    // Alabama
    'birmingham,al': { lat: 33.5207, lng: -86.8025 },
    'montgomery,al': { lat: 32.3668, lng: -86.3000 },
    'mobile,al': { lat: 30.6954, lng: -88.0399 },
    'huntsville,al': { lat: 34.7304, lng: -86.5861 },
    'tuscaloosa,al': { lat: 33.2098, lng: -87.5692 },
    
    // Alaska
    'anchorage,ak': { lat: 61.2181, lng: -149.9003 },
    'fairbanks,ak': { lat: 64.8378, lng: -147.7164 },
    'juneau,ak': { lat: 58.3019, lng: -134.4197 },
    'sitka,ak': { lat: 57.0531, lng: -135.3300 },
    
    // Arizona
    'phoenix,az': { lat: 33.4484, lng: -112.0740 },
    'tucson,az': { lat: 32.2226, lng: -110.9747 },
    'mesa,az': { lat: 33.4152, lng: -111.8315 },
    'chandler,az': { lat: 33.3062, lng: -111.8413 },
    'scottsdale,az': { lat: 33.4942, lng: -111.9261 },
    'glendale,az': { lat: 33.5387, lng: -112.1860 },
    'tempe,az': { lat: 33.4255, lng: -111.9400 },
    'flagstaff,az': { lat: 35.1983, lng: -111.6513 },
    'yuma,az': { lat: 32.6927, lng: -114.6277 },
    
    // Arkansas
    'little rock,ar': { lat: 34.7465, lng: -92.2896 },
    'fort smith,ar': { lat: 35.3859, lng: -94.3985 },
    'fayetteville,ar': { lat: 36.0626, lng: -94.1574 },
    'springdale,ar': { lat: 36.1867, lng: -94.1288 },
    
    // California
    'los angeles,ca': { lat: 34.0522, lng: -118.2437 },
    'san diego,ca': { lat: 32.7157, lng: -117.1611 },
    'san jose,ca': { lat: 37.3382, lng: -121.8863 },
    'san francisco,ca': { lat: 37.7749, lng: -122.4194 },
    'fresno,ca': { lat: 36.7378, lng: -119.7871 },
    'sacramento,ca': { lat: 38.5816, lng: -121.4944 },
    'long beach,ca': { lat: 33.7701, lng: -118.1937 },
    'oakland,ca': { lat: 37.8044, lng: -122.2712 },
    'anaheim,ca': { lat: 33.8366, lng: -117.9143 },
    'santa ana,ca': { lat: 33.7455, lng: -117.8677 },
    'riverside,ca': { lat: 33.9533, lng: -117.3962 },
    'stockton,ca': { lat: 37.9577, lng: -121.2908 },
    'irvine,ca': { lat: 33.6846, lng: -117.8265 },
    'chula vista,ca': { lat: 32.6401, lng: -117.0842 },
    'fremont,ca': { lat: 37.5483, lng: -121.9886 },
    
    // Colorado
    'denver,co': { lat: 39.7392, lng: -104.9903 },
    'colorado springs,co': { lat: 38.8339, lng: -104.8214 },
    'aurora,co': { lat: 39.7294, lng: -104.8319 },
    'fort collins,co': { lat: 40.5853, lng: -105.0844 },
    'lakewood,co': { lat: 39.7047, lng: -105.0814 },
    'thornton,co': { lat: 39.8680, lng: -104.9719 },
    'arvada,co': { lat: 39.8028, lng: -105.0875 },
    'westminster,co': { lat: 39.8367, lng: -105.0372 },
    'pueblo,co': { lat: 38.2544, lng: -104.6091 },
    'grand junction,co': { lat: 39.0639, lng: -108.5506 },
    
    // Connecticut
    'bridgeport,ct': { lat: 41.1865, lng: -73.1952 },
    'new haven,ct': { lat: 41.3083, lng: -72.9279 },
    'hartford,ct': { lat: 41.7658, lng: -72.6734 },
    'stamford,ct': { lat: 41.0534, lng: -73.5387 },
    'waterbury,ct': { lat: 41.5582, lng: -73.0515 },
    
    // Delaware
    'wilmington,de': { lat: 39.7391, lng: -75.5398 },
    'dover,de': { lat: 39.1582, lng: -75.5244 },
    'newark,de': { lat: 39.6837, lng: -75.7497 },
    
    // Florida
    'jacksonville,fl': { lat: 30.3322, lng: -81.6557 },
    'miami,fl': { lat: 25.7617, lng: -80.1918 },
    'tampa,fl': { lat: 27.9506, lng: -82.4572 },
    'orlando,fl': { lat: 28.5383, lng: -81.3792 },
    'st petersburg,fl': { lat: 27.7676, lng: -82.6403 },
    'tallahassee,fl': { lat: 30.4518, lng: -84.2807 },
    'fort lauderdale,fl': { lat: 26.1224, lng: -80.1373 },
    'cape coral,fl': { lat: 26.5629, lng: -81.9495 },
    'port st lucie,fl': { lat: 27.2730, lng: -80.3582 },
    'pembroke pines,fl': { lat: 26.0078, lng: -80.2963 },
    
    // Georgia
    'atlanta,ga': { lat: 33.7490, lng: -84.3880 },
    'augusta,ga': { lat: 33.4735, lng: -82.0105 },
    'columbus,ga': { lat: 32.4610, lng: -84.9877 },
    'savannah,ga': { lat: 32.0809, lng: -81.0912 },
    'athens,ga': { lat: 33.9519, lng: -83.3576 },
    
    // Hawaii
    'honolulu,hi': { lat: 21.3099, lng: -157.8581 },
    'hilo,hi': { lat: 19.7297, lng: -155.0900 },
    'kailua,hi': { lat: 21.4022, lng: -157.7394 },
    'kaneohe,hi': { lat: 21.4189, lng: -157.8036 },
    
    // Idaho
    'boise,id': { lat: 43.6150, lng: -116.2023 },
    'nampa,id': { lat: 43.5407, lng: -116.5635 },
    'meridian,id': { lat: 43.6121, lng: -116.3915 },
    'idaho falls,id': { lat: 43.4917, lng: -112.0338 },
    'pocatello,id': { lat: 42.8713, lng: -112.4455 },
    'coeur d\'alene,id': { lat: 47.6736, lng: -116.7814 },
    
    // Illinois
    'chicago,il': { lat: 41.8781, lng: -87.6298 },
    'aurora,il': { lat: 41.7606, lng: -88.3201 },
    'naperville,il': { lat: 41.7508, lng: -88.1535 },
    'joliet,il': { lat: 41.5250, lng: -88.0817 },
    'rockford,il': { lat: 42.2711, lng: -89.0940 },
    'peoria,il': { lat: 40.6936, lng: -89.5890 },
    'springfield,il': { lat: 39.7817, lng: -89.6501 },
    
    // Indiana
    'indianapolis,in': { lat: 39.7684, lng: -86.1581 },
    'fort wayne,in': { lat: 41.0793, lng: -85.1394 },
    'evansville,in': { lat: 37.9748, lng: -87.5558 },
    'south bend,in': { lat: 41.6764, lng: -86.2520 },
    'carmel,in': { lat: 39.9784, lng: -86.1180 },
    
    // Iowa
    'des moines,ia': { lat: 41.5868, lng: -93.6250 },
    'cedar rapids,ia': { lat: 41.9778, lng: -91.6656 },
    'davenport,ia': { lat: 41.5236, lng: -90.5776 },
    'sioux city,ia': { lat: 42.4997, lng: -96.4094 },
    'iowa city,ia': { lat: 41.6611, lng: -91.5302 },
    
    // Kansas
    'wichita,ks': { lat: 37.6872, lng: -97.3301 },
    'overland park,ks': { lat: 38.9822, lng: -94.6708 },
    'kansas city,ks': { lat: 39.1142, lng: -94.6275 },
    'olathe,ks': { lat: 38.8814, lng: -94.8191 },
    'topeka,ks': { lat: 39.0473, lng: -95.6752 },
    
    // Kentucky
    'louisville,ky': { lat: 38.2527, lng: -85.7585 },
    'lexington,ky': { lat: 38.0406, lng: -84.5037 },
    'bowling green,ky': { lat: 36.9685, lng: -86.4808 },
    'owensboro,ky': { lat: 37.7719, lng: -87.1111 },
    'frankfort,ky': { lat: 38.2009, lng: -84.8733 },
    
    // Louisiana
    'new orleans,la': { lat: 29.9511, lng: -90.0715 },
    'baton rouge,la': { lat: 30.4515, lng: -91.1871 },
    'shreveport,la': { lat: 32.5252, lng: -93.7502 },
    'lafayette,la': { lat: 30.2241, lng: -92.0198 },
    'lake charles,la': { lat: 30.2266, lng: -93.2174 },
    
    // Maine
    'portland,me': { lat: 43.6591, lng: -70.2568 },
    'lewiston,me': { lat: 44.1004, lng: -70.2148 },
    'bangor,me': { lat: 44.8016, lng: -68.7712 },
    'south portland,me': { lat: 43.6415, lng: -70.2409 },
    'augusta,me': { lat: 44.3106, lng: -69.7795 },
    
    // Maryland
    'baltimore,md': { lat: 39.2904, lng: -76.6122 },
    'frederick,md': { lat: 39.4143, lng: -77.4105 },
    'rockville,md': { lat: 39.0840, lng: -77.1528 },
    'gaithersburg,md': { lat: 39.1434, lng: -77.2014 },
    'annapolis,md': { lat: 38.9784, lng: -76.4922 },
    
    // Massachusetts
    'boston,ma': { lat: 42.3601, lng: -71.0589 },
    'worcester,ma': { lat: 42.2626, lng: -71.8023 },
    'springfield,ma': { lat: 42.1015, lng: -72.5898 },
    'lowell,ma': { lat: 42.6334, lng: -71.3162 },
    'cambridge,ma': { lat: 42.3736, lng: -71.1097 },
    
    // Michigan
    'detroit,mi': { lat: 42.3314, lng: -83.0458 },
    'grand rapids,mi': { lat: 42.9634, lng: -85.6681 },
    'warren,mi': { lat: 42.4774, lng: -83.0277 },
    'sterling heights,mi': { lat: 42.5803, lng: -83.0302 },
    'lansing,mi': { lat: 42.7325, lng: -84.5555 },
    'ann arbor,mi': { lat: 42.2808, lng: -83.7430 },
    
    // Minnesota
    'minneapolis,mn': { lat: 44.9778, lng: -93.2650 },
    'st paul,mn': { lat: 44.9537, lng: -93.0900 },
    'rochester,mn': { lat: 44.0216, lng: -92.4699 },
    'duluth,mn': { lat: 46.7867, lng: -92.1005 },
    'bloomington,mn': { lat: 44.8408, lng: -93.2983 },
    
    // Mississippi
    'jackson,ms': { lat: 32.2988, lng: -90.1848 },
    'gulfport,ms': { lat: 30.3674, lng: -89.0928 },
    'southaven,ms': { lat: 34.9910, lng: -90.0006 },
    'hattiesburg,ms': { lat: 31.3271, lng: -89.2903 },
    'biloxi,ms': { lat: 30.3960, lng: -88.8853 },
    
    // Missouri
    'kansas city,mo': { lat: 39.0997, lng: -94.5786 },
    'st louis,mo': { lat: 38.6270, lng: -90.1994 },
    'springfield,mo': { lat: 37.2089, lng: -93.2923 },
    'columbia,mo': { lat: 38.9517, lng: -92.3341 },
    'independence,mo': { lat: 39.0911, lng: -94.4155 },
    
    // Montana
    'billings,mt': { lat: 45.7833, lng: -108.5007 },
    'missoula,mt': { lat: 46.8721, lng: -113.9940 },
    'great falls,mt': { lat: 47.4944, lng: -111.2833 },
    'bozeman,mt': { lat: 45.6770, lng: -111.0429 },
    'helena,mt': { lat: 46.5891, lng: -112.0391 },
    
    // Nebraska
    'omaha,ne': { lat: 41.2565, lng: -95.9345 },
    'lincoln,ne': { lat: 40.8136, lng: -96.7026 },
    'bellevue,ne': { lat: 41.1367, lng: -95.8908 },
    'grand island,ne': { lat: 40.9264, lng: -98.3420 },
    
    // Nevada
    'las vegas,nv': { lat: 36.1699, lng: -115.1398 },
    'henderson,nv': { lat: 36.0395, lng: -114.9817 },
    'reno,nv': { lat: 39.5296, lng: -119.8138 },
    'north las vegas,nv': { lat: 36.1989, lng: -115.1175 },
    'sparks,nv': { lat: 39.5349, lng: -119.7527 },
    'carson city,nv': { lat: 39.1638, lng: -119.7674 },
    'boulder city,nv': { lat: 35.9786, lng: -114.8325 },
    'paradise,nv': { lat: 36.0972, lng: -115.1467 },
    'summerlin,nv': { lat: 36.1617, lng: -115.3242 },
    'green valley,nv': { lat: 36.0429, lng: -115.0764 },
    'mesquite,nv': { lat: 36.8055, lng: -114.0672 },
    
    // New Hampshire
    'manchester,nh': { lat: 42.9956, lng: -71.4548 },
    'nashua,nh': { lat: 42.7654, lng: -71.4676 },
    'concord,nh': { lat: 43.2081, lng: -71.5376 },
    'derry,nh': { lat: 42.8806, lng: -71.3273 },
    
    // New Jersey
    'newark,nj': { lat: 40.7357, lng: -74.1724 },
    'jersey city,nj': { lat: 40.7178, lng: -74.0431 },
    'paterson,nj': { lat: 40.9168, lng: -74.1718 },
    'elizabeth,nj': { lat: 40.6639, lng: -74.2107 },
    'edison,nj': { lat: 40.5187, lng: -74.4121 },
    'trenton,nj': { lat: 40.2206, lng: -74.7597 },
    
    // New Mexico
    'albuquerque,nm': { lat: 35.0844, lng: -106.6504 },
    'las cruces,nm': { lat: 32.3199, lng: -106.7637 },
    'rio rancho,nm': { lat: 35.2328, lng: -106.6630 },
    'santa fe,nm': { lat: 35.6870, lng: -105.9378 },
    'roswell,nm': { lat: 33.3943, lng: -104.5230 },
    
    // New York
    'new york,ny': { lat: 40.7128, lng: -74.0060 },
    'buffalo,ny': { lat: 42.8864, lng: -78.8784 },
    'rochester,ny': { lat: 43.1566, lng: -77.6088 },
    'yonkers,ny': { lat: 40.9312, lng: -73.8988 },
    'syracuse,ny': { lat: 43.0481, lng: -76.1474 },
    'albany,ny': { lat: 42.6526, lng: -73.7562 },
    
    // North Carolina
    'charlotte,nc': { lat: 35.2271, lng: -80.8431 },
    'raleigh,nc': { lat: 35.7796, lng: -78.6382 },
    'greensboro,nc': { lat: 36.0726, lng: -79.7920 },
    'durham,nc': { lat: 35.9940, lng: -78.8986 },
    'winston salem,nc': { lat: 36.0999, lng: -80.2442 },
    'fayetteville,nc': { lat: 35.0527, lng: -78.8784 },
    
    // North Dakota
    'fargo,nd': { lat: 46.8772, lng: -96.7898 },
    'bismarck,nd': { lat: 46.8083, lng: -100.7837 },
    'grand forks,nd': { lat: 47.9253, lng: -97.0329 },
    'minot,nd': { lat: 48.2325, lng: -101.2963 },
    
    // Ohio
    'columbus,oh': { lat: 39.9612, lng: -82.9988 },
    'cleveland,oh': { lat: 41.4993, lng: -81.6944 },
    'cincinnati,oh': { lat: 39.1031, lng: -84.5120 },
    'toledo,oh': { lat: 41.6528, lng: -83.5379 },
    'akron,oh': { lat: 41.0814, lng: -81.5190 },
    'dayton,oh': { lat: 39.7589, lng: -84.1916 },
    
    // Oklahoma
    'oklahoma city,ok': { lat: 35.4676, lng: -97.5164 },
    'tulsa,ok': { lat: 36.1540, lng: -95.9928 },
    'norman,ok': { lat: 35.2226, lng: -97.4395 },
    'broken arrow,ok': { lat: 36.0510, lng: -95.7908 },
    'lawton,ok': { lat: 34.6037, lng: -98.3959 },
    
    // Oregon
    'portland,or': { lat: 45.5152, lng: -122.6784 },
    'eugene,or': { lat: 44.0521, lng: -123.0868 },
    'salem,or': { lat: 44.9429, lng: -123.0351 },
    'gresham,or': { lat: 45.5001, lng: -122.4302 },
    'bend,or': { lat: 44.0582, lng: -121.3153 },
    
    // Pennsylvania
    'philadelphia,pa': { lat: 39.9526, lng: -75.1652 },
    'pittsburgh,pa': { lat: 40.4406, lng: -79.9959 },
    'allentown,pa': { lat: 40.6084, lng: -75.4902 },
    'erie,pa': { lat: 42.1292, lng: -80.0851 },
    'reading,pa': { lat: 40.3356, lng: -75.9269 },
    'harrisburg,pa': { lat: 40.2737, lng: -76.8844 },
    
    // Rhode Island
    'providence,ri': { lat: 41.8240, lng: -71.4128 },
    'warwick,ri': { lat: 41.7001, lng: -71.4162 },
    'cranston,ri': { lat: 41.7798, lng: -71.4373 },
    'pawtucket,ri': { lat: 41.8787, lng: -71.3826 },
    
    // South Carolina
    'charleston,sc': { lat: 32.7765, lng: -79.9311 },
    'columbia,sc': { lat: 34.0007, lng: -81.0348 },
    'north charleston,sc': { lat: 32.8546, lng: -80.0070 },
    'greenville,sc': { lat: 34.8526, lng: -82.3940 },
    'rock hill,sc': { lat: 34.9249, lng: -81.0251 },
    
    // South Dakota
    'sioux falls,sd': { lat: 43.5446, lng: -96.7311 },
    'rapid city,sd': { lat: 43.0755, lng: -103.2021 },
    'aberdeen,sd': { lat: 45.4647, lng: -98.4865 },
    'pierre,sd': { lat: 44.3668, lng: -100.3508 },
    
    // Tennessee
    'nashville,tn': { lat: 36.1627, lng: -86.7816 },
    'memphis,tn': { lat: 35.1495, lng: -90.0490 },
    'knoxville,tn': { lat: 35.9606, lng: -83.9207 },
    'chattanooga,tn': { lat: 35.0456, lng: -85.3097 },
    'clarksville,tn': { lat: 36.5298, lng: -87.3595 },
    'murfreesboro,tn': { lat: 35.8456, lng: -86.3903 },
    
    // Texas
    'houston,tx': { lat: 29.7604, lng: -95.3698 },
    'san antonio,tx': { lat: 29.4241, lng: -98.4936 },
    'dallas,tx': { lat: 32.7767, lng: -96.7970 },
    'austin,tx': { lat: 30.2672, lng: -97.7431 },
    'fort worth,tx': { lat: 32.7555, lng: -97.3308 },
    'el paso,tx': { lat: 31.7619, lng: -106.4850 },
    'arlington,tx': { lat: 32.7357, lng: -97.1081 },
    'corpus christi,tx': { lat: 27.8006, lng: -97.3964 },
    'plano,tx': { lat: 33.0198, lng: -96.6989 },
    'laredo,tx': { lat: 27.5306, lng: -99.4803 },
    
    // Utah
    'salt lake city,ut': { lat: 40.7608, lng: -111.8910 },
    'west valley city,ut': { lat: 40.6916, lng: -112.0011 },
    'provo,ut': { lat: 40.2338, lng: -111.6585 },
    'west jordan,ut': { lat: 40.6097, lng: -111.9391 },
    'ogden,ut': { lat: 41.2230, lng: -111.9738 },
    'st george,ut': { lat: 37.0965, lng: -113.5684 },
    'saint george,ut': { lat: 37.0965, lng: -113.5684 },
    'taylorsville,ut': { lat: 40.6677, lng: -111.9388 },
    'orem,ut': { lat: 40.2972, lng: -111.6946 },
    'sandy,ut': { lat: 40.5649, lng: -111.8389 },
    'layton,ut': { lat: 41.0602, lng: -111.9711 },
    'cedar city,ut': { lat: 37.6774, lng: -113.0619 },
    
    // Vermont
    'burlington,vt': { lat: 44.4759, lng: -73.2121 },
    'essex,vt': { lat: 44.4914, lng: -73.1152 },
    'south burlington,vt': { lat: 44.4670, lng: -73.1710 },
    'montpelier,vt': { lat: 44.2601, lng: -72.5754 },
    
    // Virginia
    'virginia beach,va': { lat: 36.8529, lng: -75.9780 },
    'norfolk,va': { lat: 36.8468, lng: -76.2852 },
    'chesapeake,va': { lat: 36.7682, lng: -76.2875 },
    'richmond,va': { lat: 37.5407, lng: -77.4360 },
    'newport news,va': { lat: 37.0871, lng: -76.4730 },
    'alexandria,va': { lat: 38.8048, lng: -77.0469 },
    
    // Washington
    'seattle,wa': { lat: 47.6062, lng: -122.3321 },
    'spokane,wa': { lat: 47.6588, lng: -117.4260 },
    'tacoma,wa': { lat: 47.2529, lng: -122.4443 },
    'vancouver,wa': { lat: 45.6387, lng: -122.6615 },
    'bellevue,wa': { lat: 47.6101, lng: -122.2015 },
    'everett,wa': { lat: 47.9789, lng: -122.2021 },
    'olympia,wa': { lat: 47.0379, lng: -122.9007 },
    
    // West Virginia
    'charleston,wv': { lat: 38.3498, lng: -81.6326 },
    'huntington,wv': { lat: 38.4192, lng: -82.4452 },
    'morgantown,wv': { lat: 39.6295, lng: -79.9559 },
    'parkersburg,wv': { lat: 39.2667, lng: -81.5615 },
    
    // Wisconsin
    'milwaukee,wi': { lat: 43.0389, lng: -87.9065 },
    'madison,wi': { lat: 43.0731, lng: -89.4012 },
    'green bay,wi': { lat: 44.5192, lng: -88.0198 },
    'kenosha,wi': { lat: 42.5847, lng: -87.8212 },
    'racine,wi': { lat: 42.7261, lng: -87.7829 },
    
    // Wyoming
    'cheyenne,wy': { lat: 41.1400, lng: -104.8197 },
    'casper,wy': { lat: 42.8666, lng: -106.3131 },
    'laramie,wy': { lat: 41.3114, lng: -105.5911 },
    'gillette,wy': { lat: 44.2911, lng: -105.5022 },
  };
  
  // Try exact match first
  if (cityCoords[key]) {
    return cityCoords[key];
  }
  
  // Try case-insensitive match
  const lowerKey = Object.keys(cityCoords).find(k => k.toLowerCase() === key);
  if (lowerKey) {
    return cityCoords[lowerKey];
  }
  
  // Try matching city name variations (handle "St." vs "st" vs "saint", and misspellings)
  const normalizedCityVariations = [
    normalizedCity,
    correctedCity,  // Include the corrected spelling
    normalizedCity.replace(/^st\s+/, 'st '),
    normalizedCity.replace(/^saint\s+/, 'st '),
    normalizedCity.replace(/\./g, ''),
    correctedCity.replace(/\./g, ''),  // Corrected city without periods
  ];
  
  const cityMatch = Object.keys(cityCoords).find(k => {
    const [cityName] = k.split(',');
    const normalizedDbCity = cityName.toLowerCase().trim();
    const normalizedDbState = k.split(',')[1]?.toUpperCase().trim();
    
    // Check if city matches (including variations) and state matches
    const cityMatches = normalizedCityVariations.some(variant => 
      normalizedDbCity === variant || 
      normalizedDbCity.replace(/\./g, '') === variant ||
      normalizedDbCity.replace(/^saint\s+/, 'st ') === variant
    );
    const stateMatches = normalizedDbState === normalizedState;
    
    return cityMatches && stateMatches;
  });
  
  if (cityMatch) {
    return cityCoords[cityMatch];
  }
  
  // No match found - return null to indicate we need coordinates
  return null;
}

/**
 * Estimate coordinates based on state center if city not found
 * Includes geographic centers for all 50 states
 */
export function getStateCenter(state: string): { lat: number; lng: number } {
  const stateCenters: Record<string, { lat: number; lng: number }> = {
    'AL': { lat: 32.806671, lng: -86.791130 }, // Alabama
    'AK': { lat: 61.370716, lng: -152.404419 }, // Alaska
    'AZ': { lat: 33.729759, lng: -111.431221 }, // Arizona
    'AR': { lat: 34.969704, lng: -92.373123 }, // Arkansas
    'CA': { lat: 36.116203, lng: -119.681564 }, // California
    'CO': { lat: 39.059811, lng: -105.311104 }, // Colorado
    'CT': { lat: 41.597782, lng: -72.755371 }, // Connecticut
    'DE': { lat: 39.318523, lng: -75.507141 }, // Delaware
    'FL': { lat: 27.766279, lng: -81.686783 }, // Florida
    'GA': { lat: 33.040619, lng: -83.643074 }, // Georgia
    'HI': { lat: 21.094318, lng: -157.498337 }, // Hawaii
    'ID': { lat: 44.240459, lng: -114.478828 }, // Idaho
    'IL': { lat: 40.349457, lng: -88.986137 }, // Illinois
    'IN': { lat: 39.849426, lng: -86.258278 }, // Indiana
    'IA': { lat: 42.011539, lng: -93.210526 }, // Iowa
    'KS': { lat: 38.526600, lng: -98.784015 }, // Kansas
    'KY': { lat: 37.668140, lng: -84.670067 }, // Kentucky
    'LA': { lat: 31.169546, lng: -91.867805 }, // Louisiana
    'ME': { lat: 44.323535, lng: -69.765261 }, // Maine
    'MD': { lat: 39.063946, lng: -76.802101 }, // Maryland
    'MA': { lat: 42.230171, lng: -71.530106 }, // Massachusetts
    'MI': { lat: 43.326618, lng: -84.536095 }, // Michigan
    'MN': { lat: 45.694454, lng: -93.900192 }, // Minnesota
    'MS': { lat: 32.741646, lng: -89.678696 }, // Mississippi
    'MO': { lat: 38.456085, lng: -92.288368 }, // Missouri
    'MT': { lat: 46.921925, lng: -110.454353 }, // Montana
    'NE': { lat: 41.125370, lng: -98.268082 }, // Nebraska
    'NV': { lat: 38.313515, lng: -117.055374 }, // Nevada
    'NH': { lat: 43.452492, lng: -71.563896 }, // New Hampshire
    'NJ': { lat: 40.298904, lng: -74.521011 }, // New Jersey
    'NM': { lat: 34.840515, lng: -106.248482 }, // New Mexico
    'NY': { lat: 42.165726, lng: -74.948051 }, // New York
    'NC': { lat: 35.630066, lng: -79.806419 }, // North Carolina
    'ND': { lat: 47.528912, lng: -99.784012 }, // North Dakota
    'OH': { lat: 40.388783, lng: -82.764915 }, // Ohio
    'OK': { lat: 35.565342, lng: -96.928917 }, // Oklahoma
    'OR': { lat: 44.572021, lng: -122.070938 }, // Oregon
    'PA': { lat: 40.590752, lng: -77.209755 }, // Pennsylvania
    'RI': { lat: 41.680893, lng: -71.51178 }, // Rhode Island
    'SC': { lat: 33.856892, lng: -80.945007 }, // South Carolina
    'SD': { lat: 44.299782, lng: -99.438828 }, // South Dakota
    'TN': { lat: 35.747845, lng: -86.692345 }, // Tennessee
    'TX': { lat: 31.054487, lng: -97.563461 }, // Texas
    'UT': { lat: 40.150032, lng: -111.862434 }, // Utah
    'VT': { lat: 44.045876, lng: -72.710686 }, // Vermont
    'VA': { lat: 37.769337, lng: -78.169968 }, // Virginia
    'WA': { lat: 47.400902, lng: -121.490494 }, // Washington
    'WV': { lat: 38.491226, lng: -80.954570 }, // West Virginia
    'WI': { lat: 44.268543, lng: -89.616508 }, // Wisconsin
    'WY': { lat: 42.755966, lng: -107.302490 }, // Wyoming
  };
  
  return stateCenters[state.toUpperCase()] || { lat: 39.8283, lng: -98.5795 }; // Default to US geographic center (Kansas)
}


