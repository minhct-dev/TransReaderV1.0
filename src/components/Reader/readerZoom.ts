/** Zoom limits for the reader page column. Values are percentages. */
export const MIN_ZOOM = 50;
export const MAX_ZOOM = 200;
export const ZOOM_STEP = 10;
export const DEFAULT_ZOOM = 100;

export const clampZoom = (value: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
