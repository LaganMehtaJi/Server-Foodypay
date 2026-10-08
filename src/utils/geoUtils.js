// Utility functions for geospatial calculations

/**
 * Calculates the great-circle distance between two points in kilometers using the Haversine formula.
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number} Distance in kilometers
 */
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return Infinity;
  }
  
  const p1 = Number(lat1);
  const p2 = Number(lon1);
  const p3 = Number(lat2);
  const p4 = Number(lon2);

  if (isNaN(p1) || isNaN(p2) || isNaN(p3) || isNaN(p4)) {
    return Infinity;
  }

  const R = 6371; // Earth's radius in KM
  const dLat = ((p3 - p1) * Math.PI) / 180;
  const dLon = ((p4 - p2) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1 * Math.PI) / 180) *
      Math.cos((p3 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // Round to 2 decimals
};
