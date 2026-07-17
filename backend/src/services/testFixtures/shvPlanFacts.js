module.exports = [
  {
    lot: 41,
    text:
      "SHEET A0.1 Sand Hollow Village Lot 41 Main Living Area: 1,879 Sq Ft Main Floor Living Area: 1,879 Sq Ft Garages: 994 Sq Ft Covered Patio: 247 Sq Ft ROOF PITCH 5:12 WALL HEIGHT 9'-0\" FOUNDATION PERIMETER 214 LF STONE 20%",
    expected: {
      totalLivingSqft: 1879,
      mainFloorLivingSqft: 1879,
      garageSqft: 994,
      coveredPatioSqft: 247,
      storyCount: 1,
      roofPitch: '5:12',
      wallHeightFt: 9,
      foundationPerimeterLf: 214,
      nonPaintedExteriorPercent: 20,
    },
  },
  {
    lot: 39,
    text:
      "SHEET A0.1 Lot 39 Total Living Area: 3,098 Sq Ft Main Floor Living Area: 1,892 Sq Ft Upper Floor Living Area: 1,209 Sq Ft Garage Area: 972 Sq Ft Covered Patio: 1,281 Sq Ft LOW-SLOPE ROOF PLATE HEIGHT 9'-1\" EXTERIOR PERIMETER 248 LF BRICK 15% STUCCO 30%",
    expected: {
      totalLivingSqft: 3098,
      mainFloorLivingSqft: 1892,
      upstairsLivingSqft: 1209,
      garageSqft: 972,
      coveredPatioSqft: 1281,
      storyCount: 2,
      roofPitch: 'low-slope',
      plateHeightFt: 9.083,
      exteriorPerimeterLf: 248,
      nonPaintedExteriorPercent: 45,
      floorDeltaSqft: 3,
    },
  },
  {
    lot: 49,
    text:
      'SHEET A1.1 Lot 49 Total Living Area: 2,571 Sq Ft Main Floor Living Area: 2,527 Sq Ft Garage Area: 1,427 Sq Ft Covered Patio: 322 Sq Ft PITCH 2:12',
    expected: {
      totalLivingSqft: 2571,
      mainFloorLivingSqft: 2527,
      garageSqft: 1427,
      coveredPatioSqft: 322,
      storyCount: 1,
      roofPitch: '2:12',
      floorDeltaSqft: -44,
    },
  },
  {
    lot: 58,
    text:
      "SHEET A0.2 Lot 58 Total Living Area: 3,660 Sq Ft Main Floor Living Area: 2,047 Sq Ft Upper Floor Living Area: 1,613 Sq Ft Garage Area: 781 Sq Ft Covered Patio: 297 Sq Ft ROOF PITCH 4:12 CEILING HEIGHT 9'-0\"",
    expected: {
      totalLivingSqft: 3660,
      mainFloorLivingSqft: 2047,
      upstairsLivingSqft: 1613,
      garageSqft: 781,
      coveredPatioSqft: 297,
      storyCount: 2,
      roofPitch: '4:12',
      wallHeightFt: 9,
      floorDeltaSqft: 0,
    },
  },
];

