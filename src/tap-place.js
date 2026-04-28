import {
  GPS_CALIBRATION_ACCURACY_THRESHOLD,
  GPS_TRIGGER_ACCURACY_THRESHOLD,
  SINGLE_ROUTE_TEST_ID,
  createIndoorAnchors,
  createIndoorRoutes,
  createTriggerRoutes,
} from './tap-place-config'
import {tapPlaceGeoMethods} from './tap-place-geo-methods'
import {tapPlaceIndoorMethods} from './tap-place-indoor-methods'
import {tapPlaceRenderMethods} from './tap-place-render-methods'
import {tapPlaceStorageMethods} from './tap-place-storage-methods'

export const tapPlaceComponent = {
  schema: {
    arrivalThreshold: {default: 0.8},
  },
  init() {
    this.ground = document.getElementById('ground')
    this.camera = document.getElementById('camera')
    this.prompt = document.getElementById('promptText')
    this.statusText = document.getElementById('statusText')
    this.debugModeText = document.getElementById('debugModeText')
    this.debugStartAnchorText = document.getElementById('debugStartAnchorText')
    this.debugTriggerText = document.getElementById('debugTriggerText')
    this.debugArmedText = document.getElementById('debugArmedText')
    this.debugRouteText = document.getElementById('debugRouteText')
    this.debugGpsText = document.getElementById('debugGpsText')
    this.debugCalibrationText = document.getElementById('debugCalibrationText')
    this.debugDiagText = document.getElementById('debugDiagText')
    this.debugPanel = document.getElementById('debugPanel')
    this.toggleDebugPanelButton = document.getElementById('toggleDebugPanelBtn')
    this.startAnchorSelect = document.getElementById('startAnchorSelect')
    this.destinationSelect = document.getElementById('destinationSelect')
    this.applyStartAnchorButton = document.getElementById('applyStartAnchorBtn')
    this.calibrateButton = document.getElementById('calibrateBtn')
    this.clearCalibrationButton = document.getElementById('clearCalibrationBtn')
    this.resetTriggerButton = document.getElementById('resetTriggerBtn')
    this.startButton = document.getElementById('startNavBtn')
    this.undoButton = document.getElementById('undoPointBtn')
    this.clearButton = document.getElementById('clearRouteBtn')
    this.recenterButton = document.getElementById('recenterBtn')

    this.routePoints = []
    this.markerEntities = []
    this.routeEntities = []
    this.triggerEntities = []
    this.anchorEntities = []
    this.billboardEntities = []
    this.navigationActive = false
    this.currentTargetIndex = 1
    this.indoorAnchors = createIndoorAnchors()
    this.indoorRoutes = createIndoorRoutes()
    this.selectedStartAnchorId = null
    this.selectedIndoorRouteId = null
    this.triggerRoutes = createTriggerRoutes()
    this.activeTriggerId = null
    this.triggerLockId = null
    this.firedTriggers = new Set()
    this.triggerCooldownMs = 1500
    this.lastTriggerAt = 0
    this.triggerArmed = true
    this.nearestTriggerId = null
    this.nearestTriggerDistance = null
    this.currentGpsPosition = null
    this.gpsAccuracy = null
    this.gpsUpdatedAt = null
    this.gpsReady = false
    this.gpsError = null
    this.gpsSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator
    this.gpsWatchId = null
    this.gpsAnchor = null
    this.calibrationAnchor = null
    this.debugPanelCollapsed = false
    this.lastDiagnostic = 'init'
    this.tempCam = new AFRAME.THREE.Vector3()
    this.tempTarget = new AFRAME.THREE.Vector3()
    this.tempForward = new AFRAME.THREE.Vector3()

    this.onGroundClick = this.onGroundClick.bind(this)
    this.onApplyStartAnchor = this.onApplyStartAnchor.bind(this)
    this.onDestinationChange = this.onDestinationChange.bind(this)
    this.onToggleDebugPanel = this.onToggleDebugPanel.bind(this)
    this.onCalibrate = this.onCalibrate.bind(this)
    this.onClearCalibration = this.onClearCalibration.bind(this)
    this.onResetTrigger = this.onResetTrigger.bind(this)
    this.onStartNavigation = this.onStartNavigation.bind(this)
    this.onUndoLastPoint = this.onUndoLastPoint.bind(this)
    this.onClearRoute = this.onClearRoute.bind(this)
    this.onRecenter = this.onRecenter.bind(this)

    this.ground.addEventListener('click', this.onGroundClick)
    this.applyStartAnchorButton.addEventListener('click', this.onApplyStartAnchor)
    this.destinationSelect?.addEventListener('change', this.onDestinationChange)
    this.toggleDebugPanelButton?.addEventListener('click', this.onToggleDebugPanel)
    this.calibrateButton.addEventListener('click', this.onCalibrate)
    this.clearCalibrationButton.addEventListener('click', this.onClearCalibration)
    this.resetTriggerButton.addEventListener('click', this.onResetTrigger)
    this.startButton.addEventListener('click', this.onStartNavigation)
    this.undoButton.addEventListener('click', this.onUndoLastPoint)
    this.clearButton.addEventListener('click', this.onClearRoute)
    this.recenterButton.addEventListener('click', this.onRecenter)

    this.populateIndoorAnchorOptions()
    this.restoreSelectedStartAnchor()
    this.populateDestinationOptions(this.selectedStartAnchorId)
    this.restoreSelectedIndoorRoute()
    this.restoreCalibrationAnchor()
    this.restoreDebugPanelCollapsed()
    this.applyDebugPanelCollapsedState()
    this.renderTriggerMarkers()
    this.renderIndoorAnchorMarkers()
    this.startGeolocationWatch()
    this.updateDebugPanel()
    this.updateStatus('单路线重复实测模式：等待 gps-test-route 触发')
  },
  remove() {
    this.ground.removeEventListener('click', this.onGroundClick)
    this.applyStartAnchorButton.removeEventListener('click', this.onApplyStartAnchor)
    this.destinationSelect?.removeEventListener('change', this.onDestinationChange)
    this.toggleDebugPanelButton?.removeEventListener('click', this.onToggleDebugPanel)
    this.calibrateButton.removeEventListener('click', this.onCalibrate)
    this.clearCalibrationButton.removeEventListener('click', this.onClearCalibration)
    this.resetTriggerButton.removeEventListener('click', this.onResetTrigger)
    this.startButton.removeEventListener('click', this.onStartNavigation)
    this.undoButton.removeEventListener('click', this.onUndoLastPoint)
    this.clearButton.removeEventListener('click', this.onClearRoute)
    this.recenterButton.removeEventListener('click', this.onRecenter)
    this.triggerEntities.forEach(entity => entity.remove())
    this.anchorEntities.forEach(entity => entity.remove())
    this.stopGeolocationWatch()
  },
  onApplyStartAnchor() {
    const nextAnchorId = this.startAnchorSelect?.value || ''
    const nextAnchor = this.findIndoorAnchorById(nextAnchorId)
    if (!nextAnchor) {
      this.updateStatus('请选择有效的室内起点锚点')
      this.lastDiagnostic = 'start-anchor-invalid'
      this.updateDebugPanel()
      return
    }

    this.selectedStartAnchorId = nextAnchor.id
    this.persistSelectedStartAnchor()
    this.populateDestinationOptions(nextAnchor.id)
    this.renderIndoorAnchorMarkers()
    this.lastDiagnostic = `start-anchor-applied ${nextAnchor.id}`
    this.updateDebugPanel()
    this.updateStatus(`已应用室内起点：${nextAnchor.name}`)
  },
  onDestinationChange() {
    const nextRouteId = this.destinationSelect?.value || ''
    const nextRoute = this.findIndoorRouteById(nextRouteId)
    if (!nextRoute) {
      this.selectedIndoorRouteId = null
      this.clearPersistedSelectedIndoorRoute()
      this.lastDiagnostic = 'indoor-route-unselected'
      this.updateDebugPanel()
      return
    }

    this.selectedIndoorRouteId = nextRoute.id
    this.persistSelectedIndoorRoute()
    this.lastDiagnostic = `indoor-route-selected ${nextRoute.id}`
    this.updateDebugPanel()
  },
  onToggleDebugPanel() {
    this.debugPanelCollapsed = !this.debugPanelCollapsed
    this.persistDebugPanelCollapsed()
    this.applyDebugPanelCollapsedState()
  },
  onCalibrate() {
    const selectedAnchor = this.findIndoorAnchorById(this.selectedStartAnchorId)
    if (!selectedAnchor) {
      this.updateStatus('请先选择室内起点锚点，再执行校准')
      this.lastDiagnostic = 'calibrate-failed start-anchor-missing'
      this.updateDebugPanel()
      return
    }

    if (!this.camera || !this.camera.object3D) {
      this.updateStatus('相机未就绪，暂时无法校准')
      this.lastDiagnostic = 'calibrate-failed camera-not-ready'
      this.updateDebugPanel()
      return
    }

    this.camera.object3D.getWorldPosition(this.tempCam)
    this.camera.object3D.getWorldDirection(this.tempForward)

    const horizontalLength = Math.sqrt(
      this.tempForward.x * this.tempForward.x + this.tempForward.z * this.tempForward.z
    )

    const sceneForwardAngle = horizontalLength > 0.001
      ? Math.atan2(this.tempForward.z / horizontalLength, this.tempForward.x / horizontalLength)
      : 0

    this.calibrationAnchor = {
      type: 'indoor-anchor',
      anchorId: selectedAnchor.id,
      anchorName: selectedAnchor.name,
      scene: {
        x: this.tempCam.x,
        y: 0.05,
        z: this.tempCam.z,
      },
      sceneForwardAngle,
      updatedAt: Date.now(),
    }

    this.persistCalibrationAnchor()
    this.lastDiagnostic = `calibrated ${selectedAnchor.id} @ ${this.tempCam.x.toFixed(1)},${this.tempCam.z.toFixed(1)}`
    this.updateDebugPanel()
    this.updateStatus(`室内锚点校准成功：${selectedAnchor.name}`)
  },
  onClearCalibration() {
    this.calibrationAnchor = null
    this.gpsAnchor = null
    this.clearPersistedCalibrationAnchor()
    this.lastDiagnostic = 'calibration-cleared'
    this.updateDebugPanel()
    this.updateStatus('已清除校准锚点')
  },
  onResetTrigger() {
    this.navigationActive = false
    this.activeTriggerId = null
    this.triggerLockId = null
    this.triggerArmed = true
    this.lastTriggerAt = 0
    this.nearestTriggerId = null
    this.nearestTriggerDistance = null
    this.currentTargetIndex = 1
    this.gpsAnchor = null
    this.clearRouteEntities()
    this.renderTriggerMarkers()
    this.renderIndoorAnchorMarkers()
    this.lastDiagnostic = 'trigger-reset'

    if (this.prompt) {
      this.prompt.textContent = '单路线重复实测模式：等待 gps-test-route 触发'
    }

    this.updateDebugPanel()
    this.updateStatus('已重置触发状态，可再次进行 gps-test-route 实测')
  },
  onGroundClick(event) {
    if (!event.detail || !event.detail.intersection || !event.detail.intersection.point) {
      return
    }

    const touchPoint = event.detail.intersection.point
    const point = {
      x: touchPoint.x,
      y: touchPoint.y + 0.05,
      z: touchPoint.z,
    }

    this.routePoints.push(point)
    this.addMarker(point)
    this.renderRoute()
    this.activeTriggerId = null
    this.triggerLockId = null
    this.triggerArmed = true
    this.nearestTriggerId = null
    this.nearestTriggerDistance = null
    this.navigationActive = false
    this.currentTargetIndex = 1
    this.updateDebugPanel()

    if (this.prompt) {
      this.prompt.textContent = `已添加导航点: ${this.routePoints.length}（至少2个）`
    }

    if (this.routePoints.length === 1) {
      this.updateStatus('已设置起点，请继续点击设置终点')
      return
    }

    this.updateStatus(`路线已更新，共 ${this.routePoints.length} 个点`)
  },
  onUndoLastPoint() {
    if (this.routePoints.length === 0) {
      this.updateStatus('当前没有可撤销的点')
      return
    }

    this.navigationActive = false
    this.currentTargetIndex = 1
    this.routePoints.pop()

    const marker = this.markerEntities.pop()
    if (marker) {
      marker.remove()
    }

    this.renderRoute()
    this.updateMarkerColors()

    if (this.prompt) {
      if (this.routePoints.length === 0) {
        this.prompt.textContent = '点击地面设置起点和终点'
      } else {
        this.prompt.textContent = `已添加导航点: ${this.routePoints.length}（至少2个）`
      }
    }

    this.updateStatus(`已撤销，剩余 ${this.routePoints.length} 个点`)
  },
  onStartNavigation() {
    const selectedAnchor = this.findIndoorAnchorById(this.selectedStartAnchorId)
    if (selectedAnchor) {
      const indoorRoute = this.findIndoorRouteById(this.selectedIndoorRouteId)
      if (!indoorRoute) {
        this.updateStatus(`请先为起点 ${selectedAnchor.name} 选择目的地`)
        this.lastDiagnostic = `indoor-route-unselected ${selectedAnchor.id}`
        this.updateDebugPanel()
        return
      }

      if (indoorRoute.startAnchorId !== selectedAnchor.id) {
        this.updateStatus(`当前目的地不属于起点 ${selectedAnchor.name}，请重新选择`)
        this.lastDiagnostic = `indoor-route-anchor-mismatch ${indoorRoute.id}`
        this.updateDebugPanel()
        return
      }

      this.loadIndoorRoute(indoorRoute)
      return
    }

    if (this.routePoints.length < 2) {
      this.updateStatus('至少需要2个点才能开始导航')
      return
    }

    this.navigationActive = true
    this.currentTargetIndex = 1
    this.updateMarkerColors()
    this.updateStatus(`导航开始，前往第 ${this.currentTargetIndex + 1}/${this.routePoints.length} 个点`)
  },
  onClearRoute() {
    this.navigationActive = false
    this.activeTriggerId = null
    this.triggerLockId = null
    this.triggerArmed = true
    this.nearestTriggerId = null
    this.nearestTriggerDistance = null
    this.currentTargetIndex = 1
    this.clearRouteEntities()
    this.renderIndoorAnchorMarkers()

    if (this.prompt) {
      this.prompt.textContent = '点击地面设置起点和终点'
    }
    this.updateDebugPanel()
    this.updateStatus('路线已清空')
  },
  onRecenter() {
    if (window.XR8 && window.XR8.XrController && typeof window.XR8.XrController.recenter === 'function') {
      window.XR8.XrController.recenter()
      this.updateStatus('已重定位，请继续导航')
      return
    }

    this.updateStatus('当前环境不支持重定位')
  },
  getTriggerEnterRadius(trigger) {
    return trigger.enterRadius ?? trigger.triggerRadius ?? 1.5
  },
  getTriggerExitRadius(trigger) {
    const enterRadius = this.getTriggerEnterRadius(trigger)
    return trigger.exitRadius ?? Math.max(enterRadius + 0.7, enterRadius * 1.35)
  },
  getRoutePositionMode(route) {
    return route.positionMode ?? 'scene'
  },
  shouldUseSceneFallback(route) {
    return this.getRoutePositionMode(route) === 'gps'
      && (!this.gpsReady || !this.hasGpsTrigger(route))
      && !!route.triggerPoint
  },
  shouldRenderTriggerMarker(route) {
    if (!route.triggerPoint) {
      return false
    }

    if (route.id === SINGLE_ROUTE_TEST_ID) {
      return true
    }

    const routeMode = this.getRoutePositionMode(route)
    return routeMode === 'scene' || this.shouldUseSceneFallback(route)
  },
  getDistanceToTrigger(trigger, cameraPosition) {
    if (this.getRoutePositionMode(trigger) === 'gps') {
      if (
        this.gpsReady
        && this.currentGpsPosition
        && this.hasGpsTrigger(trigger)
        && this.isGpsAccurateEnoughForTrigger()
      ) {
        return this.getGpsDistanceMeters(this.currentGpsPosition, trigger.triggerGps)
      }

      if (!this.shouldUseSceneFallback(trigger)) {
        return null
      }
    }

    if (!trigger.triggerPoint || !cameraPosition) {
      return null
    }

    this.tempTarget.set(trigger.triggerPoint.x, trigger.triggerPoint.y, trigger.triggerPoint.z)
    return this.getHorizontalDistance(cameraPosition, this.tempTarget)
  },
  findTriggerById(triggerId) {
    return this.triggerRoutes.find(trigger => trigger.id === triggerId) || null
  },
  updateTriggerArming() {
    if ((!this.camera || !this.camera.object3D) && !this.gpsReady) {
      return
    }

    if (this.triggerArmed || !this.triggerLockId) {
      return
    }

    const lockedTrigger = this.findTriggerById(this.triggerLockId)
    if (!lockedTrigger) {
      this.triggerArmed = true
      this.triggerLockId = null
      return
    }

    const routeMode = this.getRoutePositionMode(lockedTrigger)
    let distance = null

    if (routeMode === 'gps' && this.gpsReady && this.currentGpsPosition && this.hasGpsTrigger(lockedTrigger)) {
      distance = this.getDistanceToTrigger(lockedTrigger, null)
    } else {
      if (!this.camera || !this.camera.object3D) {
        return
      }

      this.camera.object3D.getWorldPosition(this.tempCam)
      distance = this.getDistanceToTrigger(lockedTrigger, this.tempCam)
    }

    if (distance == null) {
      return
    }

    if (distance >= this.getTriggerExitRadius(lockedTrigger)) {
      this.triggerArmed = true
      this.triggerLockId = null
      this.updateDebugPanel()
    }
  },
  updateNearestTrigger(cameraPosition) {
    let nearestTrigger = null
    let nearestDistance = Number.POSITIVE_INFINITY

    this.triggerRoutes.forEach((trigger) => {
      if (trigger.once && this.firedTriggers.has(trigger.id)) {
        return
      }

      const distance = this.getDistanceToTrigger(trigger, cameraPosition)
      if (distance == null) {
        return
      }

      if (distance < nearestDistance) {
        nearestTrigger = trigger
        nearestDistance = distance
      }
    })

    this.nearestTriggerId = nearestTrigger ? nearestTrigger.id : null
    this.nearestTriggerDistance = nearestTrigger ? nearestDistance : null
  },
  updateDebugPanel() {
    if (this.debugModeText) {
      const activeRoute = this.activeTriggerId ? this.findTriggerById(this.activeTriggerId) : null
      const mode = activeRoute ? this.getRoutePositionMode(activeRoute) : 'scene'
      const calibrated = this.calibrationAnchor ? 'yes' : 'no'
      const gpsGate = this.isGpsAccurateEnoughForTrigger() ? 'ok' : 'poor'
      this.debugModeText.textContent = `Mode: ${mode} | GPS ready: ${this.gpsReady ? 'yes' : 'no'} | GPS gate: ${gpsGate} | Calibrated: ${calibrated}`
    }

    if (this.debugStartAnchorText) {
      const selectedAnchor = this.findIndoorAnchorById(this.selectedStartAnchorId)
      const selectedRoute = this.findIndoorRouteById(this.selectedIndoorRouteId)
      this.debugStartAnchorText.textContent = selectedAnchor
        ? `StartAnchor: ${selectedAnchor.name} (${selectedAnchor.id}) | Destination: ${selectedRoute ? selectedRoute.destinationName : '-'}`
        : 'StartAnchor: -'
    }

    if (this.debugTriggerText) {
      const nearestLabel = this.nearestTriggerId
        ? `${this.nearestTriggerId} (${this.nearestTriggerDistance.toFixed(2)}m)`
        : '-'
      this.debugTriggerText.textContent = `Trigger: ${nearestLabel}`
    }

    if (this.debugArmedText) {
      const lockLabel = this.triggerLockId || '-'
      this.debugArmedText.textContent = `Armed: ${this.triggerArmed ? 'yes' : 'no'} | Lock: ${lockLabel}`
    }

    if (this.debugRouteText) {
      const activeRoute = this.activeTriggerId || 'manual'
      const firedSummary = this.firedTriggers.size > 0 ? [...this.firedTriggers].join(', ') : '-'
      const anchorSummary = this.gpsAnchor
        ? ` | Anchor: ${this.gpsAnchor.routeId} @ ${this.gpsAnchor.scene.x.toFixed(1)},${this.gpsAnchor.scene.z.toFixed(1)}${this.gpsAnchor.calibrated ? ' calibrated' : ''}`
        : ''
      const indoorRoute = this.findIndoorRouteById(this.selectedIndoorRouteId)
      const indoorSummary = indoorRoute ? ` | IndoorRoute: ${indoorRoute.id} -> ${indoorRoute.destinationName}` : ''
      this.debugRouteText.textContent = `Route: ${activeRoute} | TestOnly: ${SINGLE_ROUTE_TEST_ID}${indoorSummary} | Fired: ${firedSummary}${anchorSummary}`
    }

    if (this.debugGpsText) {
      const accuracyLabel = this.gpsAccuracy != null ? `${this.gpsAccuracy.toFixed(1)}m` : '-'
      const updatedLabel = this.gpsUpdatedAt ? new Date(this.gpsUpdatedAt).toLocaleTimeString() : '-'
      const errorLabel = this.gpsError ? ` | Error: ${this.gpsError}` : ''
      const thresholdLabel = ` | Gate(cal/trigger): ${GPS_CALIBRATION_ACCURACY_THRESHOLD}m/${GPS_TRIGGER_ACCURACY_THRESHOLD}m`
      this.debugGpsText.textContent = `GPS: ${this.formatGpsPosition()} | Acc: ${accuracyLabel} | Updated: ${updatedLabel}${thresholdLabel}${errorLabel}`
    }

    if (this.debugCalibrationText) {
      if (!this.calibrationAnchor) {
        this.debugCalibrationText.textContent = 'Calibration: -'
      } else if (this.calibrationAnchor.type === 'indoor-anchor') {
        const calibrationTime = this.calibrationAnchor.updatedAt
          ? new Date(this.calibrationAnchor.updatedAt).toLocaleTimeString()
          : '-'
        this.debugCalibrationText.textContent =
          `Calibration: ${this.calibrationAnchor.anchorName || this.calibrationAnchor.anchorId}`
          + ` | Scene: ${this.calibrationAnchor.scene.x.toFixed(1)}, ${this.calibrationAnchor.scene.z.toFixed(1)}`
          + ` | Angle: ${this.calibrationAnchor.sceneForwardAngle.toFixed(2)}`
          + ` | Saved: ${calibrationTime}`
      } else {
        const calibrationTime = this.calibrationAnchor.updatedAt
          ? new Date(this.calibrationAnchor.updatedAt).toLocaleTimeString()
          : '-'
        this.debugCalibrationText.textContent =
          `Calibration: ${this.calibrationAnchor.gps.lat.toFixed(6)}, ${this.calibrationAnchor.gps.lng.toFixed(6)}`
          + ` | Scene: ${this.calibrationAnchor.scene.x.toFixed(1)}, ${this.calibrationAnchor.scene.z.toFixed(1)}`
          + ` | Angle: ${this.calibrationAnchor.sceneForwardAngle.toFixed(2)}`
          + ` | Saved: ${calibrationTime}`
      }
    }

    if (this.debugDiagText) {
      this.debugDiagText.textContent = `Diag: ${this.lastDiagnostic}`
    }
  },
  checkTriggerRoutes() {
    const hasSceneCamera = this.camera && this.camera.object3D
    if (!hasSceneCamera && !this.gpsReady) {
      return
    }

    if (hasSceneCamera) {
      this.camera.object3D.getWorldPosition(this.tempCam)
    }

    this.updateNearestTrigger(hasSceneCamera ? this.tempCam : null)
    this.updateTriggerArming()

    if (!this.triggerArmed) {
      this.updateDebugPanel()
      return
    }

    const now = Date.now()
    if (now - this.lastTriggerAt < this.triggerCooldownMs) {
      return
    }

    let matchedGpsTrigger = null
    let matchedGpsDistance = Number.POSITIVE_INFINITY
    let matchedSceneTrigger = null
    let matchedSceneDistance = Number.POSITIVE_INFINITY

    for (const trigger of this.triggerRoutes) {
      if (trigger.once && this.firedTriggers.has(trigger.id)) {
        continue
      }

      const routeMode = this.getRoutePositionMode(trigger)
      if (routeMode === 'scene' && !hasSceneCamera) {
        continue
      }

      if (routeMode === 'gps' && this.gpsReady && !this.isGpsAccurateEnoughForTrigger()) {
        this.lastDiagnostic = `gps-blocked accuracy=${this.gpsAccuracy.toFixed(1)} trigger-threshold=${GPS_TRIGGER_ACCURACY_THRESHOLD}`
        continue
      }

      if (routeMode === 'gps' && !this.gpsReady && !this.shouldUseSceneFallback(trigger)) {
        continue
      }

      const distance = this.getDistanceToTrigger(trigger, hasSceneCamera ? this.tempCam : null)
      if (distance == null) {
        continue
      }

      if (distance > this.getTriggerEnterRadius(trigger)) {
        continue
      }

      if (routeMode === 'gps') {
        if (distance < matchedGpsDistance) {
          matchedGpsTrigger = trigger
          matchedGpsDistance = distance
        }
      } else if (distance < matchedSceneDistance) {
        matchedSceneTrigger = trigger
        matchedSceneDistance = distance
      }
    }

    const matchedTrigger = matchedGpsTrigger || matchedSceneTrigger
    if (matchedTrigger) {
      this.lastTriggerAt = now
      const matchedDistance = matchedGpsTrigger ? matchedGpsDistance : matchedSceneDistance
      this.lastDiagnostic = `match ${matchedTrigger.id} dist=${matchedDistance.toFixed(2)} mode=${this.getRoutePositionMode(matchedTrigger)}`
      this.activatePresetRoute(matchedTrigger)
      return
    }

    this.lastDiagnostic = `no-match nearest=${this.nearestTriggerId || '-'} armed=${this.triggerArmed ? 'yes' : 'no'}`
    this.updateDebugPanel()
  },
  tick() {
    this.updateBillboardLabels()
    this.checkTriggerRoutes()

    if (!this.navigationActive || this.routePoints.length < 2 || !this.camera || !this.camera.object3D) {
      return
    }

    const target = this.routePoints[this.currentTargetIndex]
    if (!target) {
      this.navigationActive = false
      this.updateStatus('导航完成')
      this.updateMarkerColors()
      return
    }

    this.camera.object3D.getWorldPosition(this.tempCam)
    this.tempTarget.set(target.x, target.y, target.z)
    const distToTarget = this.getHorizontalDistance(this.tempCam, this.tempTarget)

    if (distToTarget <= this.data.arrivalThreshold) {
      this.currentTargetIndex += 1

      if (this.currentTargetIndex >= this.routePoints.length) {
        this.navigationActive = false
        this.updateStatus('已到达终点')
      } else {
        this.updateStatus(`到达检查点，前往第 ${this.currentTargetIndex + 1}/${this.routePoints.length} 个点`)
      }

      this.updateMarkerColors()
      return
    }

    const remaining = this.getDistanceToDestination()
    this.updateStatus(`导航中：下一点 ${distToTarget.toFixed(1)}cm，剩余 ${remaining.toFixed(1)}cm`)
  },
  getDistanceToDestination() {
    if (!this.camera || !this.camera.object3D || this.routePoints.length === 0) {
      return 0
    }

    const destination = this.routePoints[this.routePoints.length - 1]
    this.camera.object3D.getWorldPosition(this.tempCam)
    this.tempTarget.set(destination.x, destination.y, destination.z)
    return this.getHorizontalDistance(this.tempCam, this.tempTarget)
  },
  getHorizontalDistance(from, to) {
    const dx = to.x - from.x
    const dz = to.z - from.z
    return Math.sqrt(dx * dx + dz * dz)
  },
  updateStatus(message) {
    if (this.statusText) {
      this.statusText.textContent = message
    }
  },
  ...tapPlaceStorageMethods,
  ...tapPlaceIndoorMethods,
  ...tapPlaceRenderMethods,
  ...tapPlaceGeoMethods,
}
