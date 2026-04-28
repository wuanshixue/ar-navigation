import {
  CALIBRATION_STORAGE_KEY,
  DEBUG_PANEL_COLLAPSED_KEY,
  INDOOR_ROUTE_STORAGE_KEY,
  START_ANCHOR_STORAGE_KEY,
} from './tap-place-config'

export const tapPlaceStorageMethods = {
  persistSelectedStartAnchor() {
    if (!this.selectedStartAnchorId || typeof window === 'undefined' || !window.localStorage) {
      return
    }

    window.localStorage.setItem(START_ANCHOR_STORAGE_KEY, this.selectedStartAnchorId)
  },
  persistSelectedIndoorRoute() {
    if (!this.selectedIndoorRouteId || typeof window === 'undefined' || !window.localStorage) {
      return
    }

    window.localStorage.setItem(INDOOR_ROUTE_STORAGE_KEY, this.selectedIndoorRouteId)
  },
  restoreSelectedStartAnchor() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    const storedAnchorId = window.localStorage.getItem(START_ANCHOR_STORAGE_KEY)
    if (!storedAnchorId || !this.findIndoorAnchorById(storedAnchorId)) {
      return
    }

    this.selectedStartAnchorId = storedAnchorId
    if (this.startAnchorSelect) {
      this.startAnchorSelect.value = storedAnchorId
    }
    this.lastDiagnostic = `start-anchor-restored ${storedAnchorId}`
  },
  restoreSelectedIndoorRoute() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    const storedRouteId = window.localStorage.getItem(INDOOR_ROUTE_STORAGE_KEY)
    if (!storedRouteId) {
      return
    }

    const storedRoute = this.findIndoorRouteById(storedRouteId)
    if (!storedRoute || storedRoute.startAnchorId !== this.selectedStartAnchorId) {
      return
    }

    this.selectedIndoorRouteId = storedRouteId
    if (this.destinationSelect) {
      this.destinationSelect.value = storedRouteId
    }
    this.lastDiagnostic = `indoor-route-restored ${storedRouteId}`
  },
  clearPersistedSelectedIndoorRoute() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    window.localStorage.removeItem(INDOOR_ROUTE_STORAGE_KEY)
  },
  persistDebugPanelCollapsed() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    window.localStorage.setItem(DEBUG_PANEL_COLLAPSED_KEY, this.debugPanelCollapsed ? '1' : '0')
  },
  restoreDebugPanelCollapsed() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    this.debugPanelCollapsed = window.localStorage.getItem(DEBUG_PANEL_COLLAPSED_KEY) === '1'
  },
  applyDebugPanelCollapsedState() {
    if (this.debugPanel) {
      this.debugPanel.classList.toggle('collapsed', this.debugPanelCollapsed)
    }

    if (this.toggleDebugPanelButton) {
      this.toggleDebugPanelButton.textContent = this.debugPanelCollapsed ? '展开' : '折叠'
    }
  },
  persistCalibrationAnchor() {
    if (!this.calibrationAnchor || typeof window === 'undefined' || !window.localStorage) {
      return
    }

    window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(this.calibrationAnchor))
  },
  clearPersistedCalibrationAnchor() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    window.localStorage.removeItem(CALIBRATION_STORAGE_KEY)
  },
  restoreCalibrationAnchor() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    const rawAnchor = window.localStorage.getItem(CALIBRATION_STORAGE_KEY)
    if (!rawAnchor) {
      return
    }

    try {
      const parsedAnchor = JSON.parse(rawAnchor)
      if (
        parsedAnchor
        && parsedAnchor.scene
        && typeof parsedAnchor.scene.x === 'number'
        && typeof parsedAnchor.scene.z === 'number'
        && typeof parsedAnchor.sceneForwardAngle === 'number'
      ) {
        this.calibrationAnchor = parsedAnchor
        if (parsedAnchor.type === 'indoor-anchor' && parsedAnchor.anchorId) {
          this.lastDiagnostic = `calibration-restored ${parsedAnchor.anchorId}`
        } else if (
          parsedAnchor.gps
          && typeof parsedAnchor.gps.lat === 'number'
          && typeof parsedAnchor.gps.lng === 'number'
        ) {
          this.lastDiagnostic = `calibration-restored ${parsedAnchor.gps.lat.toFixed(6)},${parsedAnchor.gps.lng.toFixed(6)}`
        }
      }
    } catch (error) {
      this.clearPersistedCalibrationAnchor()
      this.lastDiagnostic = 'calibration-restore-failed'
    }
  },
}
