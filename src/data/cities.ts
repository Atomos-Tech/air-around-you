import type { PlaceSelection } from "./air-quality";

type City = [
  id: string,
  name: string,
  country: string,
  latitude: number,
  longitude: number,
  countryCode: string,
];

const cities: City[] = [
  ["new-delhi", "New Delhi", "India", 28.6139, 77.209, "IN"],
  ["tokyo", "Tokyo", "Japan", 35.6812, 139.767, "JP"],
  ["nairobi", "Nairobi", "Kenya", -1.2921, 36.8219, "KE"],
  ["new-york", "New York", "United States", 40.7128, -74.006, "US"],
  ["sao-paulo", "São Paulo", "Brazil", -23.5505, -46.6333, "BR"],
  ["london", "London", "United Kingdom", 51.5074, -0.1278, "GB"],
  ["mumbai", "Mumbai", "India", 19.076, 72.8777, "IN"],
  ["bengaluru", "Bengaluru", "India", 12.9716, 77.5946, "IN"],
  ["kolkata", "Kolkata", "India", 22.5726, 88.3639, "IN"],
  ["chennai", "Chennai", "India", 13.0827, 80.2707, "IN"],
  ["hyderabad", "Hyderabad", "India", 17.385, 78.4867, "IN"],
  ["pune", "Pune", "India", 18.5204, 73.8567, "IN"],
  ["ahmedabad", "Ahmedabad", "India", 23.0225, 72.5714, "IN"],
  ["lucknow", "Lucknow", "India", 26.8467, 80.9462, "IN"],
  ["kathmandu", "Kathmandu", "Nepal", 27.7172, 85.324, "NP"],
  ["dhaka", "Dhaka", "Bangladesh", 23.8103, 90.4125, "BD"],
  ["lahore", "Lahore", "Pakistan", 31.5204, 74.3587, "PK"],
  ["karachi", "Karachi", "Pakistan", 24.8607, 67.0011, "PK"],
  ["beijing", "Beijing", "China", 39.9042, 116.4074, "CN"],
  ["shanghai", "Shanghai", "China", 31.2304, 121.4737, "CN"],
  ["osaka", "Osaka", "Japan", 34.6937, 135.5023, "JP"],
  ["seoul", "Seoul", "South Korea", 37.5665, 126.978, "KR"],
  ["singapore", "Singapore", "Singapore", 1.3521, 103.8198, "SG"],
  ["bangkok", "Bangkok", "Thailand", 13.7563, 100.5018, "TH"],
  ["hanoi", "Hanoi", "Vietnam", 21.0285, 105.8542, "VN"],
  ["manila", "Manila", "Philippines", 14.5995, 120.9842, "PH"],
  ["jakarta", "Jakarta", "Indonesia", -6.2088, 106.8456, "ID"],
  ["dubai", "Dubai", "United Arab Emirates", 25.2048, 55.2708, "AE"],
  ["riyadh", "Riyadh", "Saudi Arabia", 24.7136, 46.6753, "SA"],
  ["istanbul", "Istanbul", "Türkiye", 41.0082, 28.9784, "TR"],
  ["cairo", "Cairo", "Egypt", 30.0444, 31.2357, "EG"],
  ["lagos", "Lagos", "Nigeria", 6.5244, 3.3792, "NG"],
  ["addis-ababa", "Addis Ababa", "Ethiopia", 9.03, 38.74, "ET"],
  ["casablanca", "Casablanca", "Morocco", 33.5731, -7.5898, "MA"],
  ["johannesburg", "Johannesburg", "South Africa", -26.2041, 28.0473, "ZA"],
  ["cape-town", "Cape Town", "South Africa", -33.9249, 18.4241, "ZA"],
  ["paris", "Paris", "France", 48.8566, 2.3522, "FR"],
  ["amsterdam", "Amsterdam", "Netherlands", 52.3676, 4.9041, "NL"],
  ["berlin", "Berlin", "Germany", 52.52, 13.405, "DE"],
  ["madrid", "Madrid", "Spain", 40.4168, -3.7038, "ES"],
  ["rome", "Rome", "Italy", 41.9028, 12.4964, "IT"],
  ["stockholm", "Stockholm", "Sweden", 59.3293, 18.0686, "SE"],
  ["warsaw", "Warsaw", "Poland", 52.2297, 21.0122, "PL"],
  ["toronto", "Toronto", "Canada", 43.6532, -79.3832, "CA"],
  ["vancouver", "Vancouver", "Canada", 49.2827, -123.1207, "CA"],
  ["chicago", "Chicago", "United States", 41.8781, -87.6298, "US"],
  ["san-francisco", "San Francisco", "United States", 37.7749, -122.4194, "US"],
  ["los-angeles", "Los Angeles", "United States", 34.0522, -118.2437, "US"],
  ["mexico-city", "Mexico City", "Mexico", 19.4326, -99.1332, "MX"],
  ["bogota", "Bogotá", "Colombia", 4.711, -74.0721, "CO"],
  ["lima", "Lima", "Peru", -12.0464, -77.0428, "PE"],
  ["santiago", "Santiago", "Chile", -33.4489, -70.6693, "CL"],
  ["buenos-aires", "Buenos Aires", "Argentina", -34.6037, -58.3816, "AR"],
  ["sydney", "Sydney", "Australia", -33.8688, 151.2093, "AU"],
  ["melbourne", "Melbourne", "Australia", -37.8136, 144.9631, "AU"],
  ["auckland", "Auckland", "New Zealand", -36.8485, 174.7633, "NZ"],
];

export const WORLD_CITIES: readonly PlaceSelection[] = cities.map(
  ([id, name, region, latitude, longitude, countryCode]) => ({
    id,
    name,
    region,
    latitude,
    longitude,
    countryCode,
  }),
);

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function findLocalCities(query: string) {
  const term = normalize(query.trim());
  return WORLD_CITIES.filter(({ name, region }) => normalize(`${name}, ${region}`).includes(term));
}
