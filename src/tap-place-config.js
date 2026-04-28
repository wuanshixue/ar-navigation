import indoorAnchorsData from './indoor-anchors.json'
import indoorRoutesData from './indoor-routes.json'
import triggerRoutesData from './trigger-routes.json'

export const CALIBRATION_STORAGE_KEY = 'ar-nav-calibration-anchor'
export const START_ANCHOR_STORAGE_KEY = 'ar-nav-start-anchor'
export const INDOOR_ROUTE_STORAGE_KEY = 'ar-nav-indoor-route'
export const DEBUG_PANEL_COLLAPSED_KEY = 'ar-nav-debug-panel-collapsed'
export const GPS_CALIBRATION_ACCURACY_THRESHOLD = 15
export const GPS_TRIGGER_ACCURACY_THRESHOLD = 25
export const SINGLE_ROUTE_TEST_ID = 'gps-test-route'

export const createIndoorAnchors = () => indoorAnchorsData.map(anchor => ({
  ...anchor,
  anchorType: anchor.anchorType ?? 'manual',
  floorId: anchor.floorId ?? 'f1',
}))

export const createIndoorRoutes = () => indoorRoutesData.map(route => ({
  ...route,
  floorId: route.floorId ?? 'f1',
  autoStart: route.autoStart ?? true,
}))

export const createTriggerRoutes = () => triggerRoutesData
  .map(route => ({
    ...route,
    positionMode: route.positionMode ?? 'scene',
    triggerGps: route.triggerGps ?? null,
    pointsGps: route.pointsGps ?? [],
  }))
  .filter(route => route.id === SINGLE_ROUTE_TEST_ID)
