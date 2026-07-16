const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

// Haversine distance between two lat/lng points, in meters
function distanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function isWithinOfficeRadius(lat, lng) {
  const officeLat = Number(process.env.OFFICE_LAT);
  const officeLng = Number(process.env.OFFICE_LNG);
  const maxDistance = Number(process.env.MAX_DISTANCE_METERS || 150);

  if (Number.isNaN(officeLat) || Number.isNaN(officeLng)) {
    throw new Error('OFFICE_LAT/OFFICE_LNG are not configured');
  }

  const distance = distanceMeters(lat, lng, officeLat, officeLng);
  return { withinRadius: distance <= maxDistance, distance, maxDistance };
}

module.exports = { distanceMeters, isWithinOfficeRadius };
