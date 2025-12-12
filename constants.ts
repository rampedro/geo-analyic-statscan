import { MetricType } from "./types";

// CartoDB Dark Matter (No API key needed for demo)
export const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Centered on Southern Western Ontario (London/Kitchener area) to showcase the specific dataset
export const INITIAL_VIEW_STATE = {
  longitude: -81.0, 
  latitude: 43.5,
  zoom: 8.0, // Zoomed in a bit more for 2D
  pitch: 0,  // FORCE 2D
  bearing: 0,
};

export const METRIC_COLORS = {
  [MetricType.RealEstate]: [234, 179, 8], // Yellow
  [MetricType.Crime]: [244, 63, 94], // Rose/Red
  [MetricType.Social]: [6, 182, 212], // Cyan
};

export const METRIC_LABELS = {
  [MetricType.RealEstate]: "Real Estate Value",
  [MetricType.Crime]: "Crime Severity Index",
  [MetricType.Social]: "Social Well-being",
};