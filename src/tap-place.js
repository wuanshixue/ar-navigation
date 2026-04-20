// Minimal navigation component: tap to place route points, then follow the path.
import triggerRoutes from './trigger-routes.json'

const CALIBRATION_STORAGE_KEY = 'ar-nav-calibration-anchor'
const GPS_CALIBRATION_ACCURACY_THRESHOLD = 15
const GPS_TRIGGER_ACCURACY_THRESHOLD = 25
const SINGLE_ROUTE_TEST_ID = 'gps-test-route'

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
    this.debugTriggerText = document.getElementById('debugTriggerText')
    this.debugArmedText = document.getElementById('debugArmedText')
    this.debugRouteText = document.getElementById('debugRouteText')
    this.debugGpsText = document.getElementById('debugGpsText')
    this.debugCalibrationText = document.getElementById('debugCalibrationText')
    this.debugDiagText = document.getElementById('debugDiagText')
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
    this.navigationActive = false
    this.currentTargetIndex = 1
    this.triggerRoutes = triggerRoutes
      .map(route => ({
        ...route,
        positionMode: route.positionMode ?? 'scene',
        triggerGps: route.triggerGps ?? null,
        pointsGps: route.pointsGps ?? [],
      }))
      .filter(route => route.id === SINGLE_ROUTE_TEST_ID)
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
    this.lastDiagnostic = 'init'
    this.tempCam = new AFRAME.THREE.Vector3()
    this.tempTarget = new AFRAME.THREE.Vector3()
    this.tempForward = new AFRAME.THREE.Vector3()

    this.onGroundClick = this.onGroundClick.bind(this)
    this.onCalibrate = this.onCalibrate.bind(this)
    this.onClearCalibration = this.onClearCalibration.bind(this)
    this.onResetTrigger = this.onResetTrigger.bind(this)
    this.onStartNavigation = this.onStartNavigation.bind(this)
    this.onUndoLastPoint = this.onUndoLastPoint.bind(this)
    this.onClearRoute = this.onClearRoute.bind(this)
    this.onRecenter = this.onRecenter.bind(this)

    this.ground.addEventListener('click', this.onGroundClick)
    this.calibrateButton.addEventListener('click', this.onCalibrate)
    this.clearCalibrationButton.addEventListener('click', this.onClearCalibration)
    this.resetTriggerButton.addEventListener('click', this.onResetTrigger)
    this.startButton.addEventListener('click', this.onStartNavigation)
    this.undoButton.addEventListener('click', this.onUndoLastPoint)
    this.clearButton.addEventListener('click', this.onClearRoute)
    this.recenterButton.addEventListener('click', this.onRecenter)

    this.restoreCalibrationAnchor()
    this.renderTriggerMarkers()
    this.startGeolocationWatch()
    this.updateDebugPanel()
    this.updateStatus('单路线重复实测模式：等待 gps-test-route 触发')
  },
  remove() {
    this.ground.removeEventListener('click', this.onGroundClick)
    this.calibrateButton.removeEventListener('click', this.onCalibrate)
    this.clearCalibrationButton.removeEventListener('click', this.onClearCalibration)
    this.resetTriggerButton.removeEventListener('click', this.onResetTrigger)
    this.startButton.removeEventListener('click', this.onStartNavigation)
    this.undoButton.removeEventListener('click', this.onUndoLastPoint)
    this.clearButton.removeEventListener('click', this.onClearRoute)
    this.recenterButton.removeEventListener('click', this.onRecenter)
    this.triggerEntities.forEach(entity => entity.remove())
    this.stopGeolocationWatch()
  },
  onCalibrate() {
    if (!this.gpsReady || !this.currentGpsPosition) {
      this.updateStatus('定位尚未就绪，暂时无法校准')
      this.lastDiagnostic = 'calibrate-failed gps-not-ready'
      this.updateDebugPanel()
      return
    }

    if (!this.isGpsAccurateEnoughForCalibration()) {
      this.updateStatus(`当前定位精度 ${this.gpsAccuracy.toFixed(1)}m，超过校准阈值 ${GPS_CALIBRATION_ACCURACY_THRESHOLD}m`)
      this.lastDiagnostic = `calibrate-failed accuracy=${this.gpsAccuracy.toFixed(1)}`
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
      gps: {...this.currentGpsPosition},
      scene: {
        x: this.tempCam.x,
        y: 0.05,
        z: this.tempCam.z,
      },
      sceneForwardAngle,
      updatedAt: Date.now(),
    }

    this.persistCalibrationAnchor()
    this.lastDiagnostic = `calibrated ${this.currentGpsPosition.lat.toFixed(6)},${this.currentGpsPosition.lng.toFixed(6)}`
    this.updateDebugPanel()
    this.updateStatus('定位校准成功，后续 GPS 路线将优先使用当前锚点')
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
  addMarker(point) {
    const marker = document.createElement('a-sphere')
    marker.setAttribute('position', `${point.x} ${point.y} ${point.z}`)
    marker.setAttribute('radius', 0.11)
    marker.setAttribute('material', 'color: #5ac8fa; emissive: #1a6f8f; emissiveIntensity: 0.35')
    marker.setAttribute('shadow', 'cast: true; receive: false')
    this.el.sceneEl.appendChild(marker)
    this.markerEntities.push(marker)
    this.updateMarkerColors()
  },
  renderTriggerMarkers() {
    this.triggerEntities.forEach(entity => entity.remove())
    this.triggerEntities = []

    this.triggerRoutes.forEach((trigger) => {
      if (!this.shouldRenderTriggerMarker(trigger)) {
        return
      }

      if (trigger.once && this.firedTriggers.has(trigger.id)) {
        return
      }

      const marker = document.createElement('a-entity')
      marker.setAttribute('position', `${trigger.triggerPoint.x} ${trigger.triggerPoint.y} ${trigger.triggerPoint.z}`)

      const beacon = document.createElement('a-cylinder')
      beacon.setAttribute('position', '0 1.15 0')
      beacon.setAttribute('radius', 0.08)
      beacon.setAttribute('height', 2.3)
      beacon.setAttribute('material', 'color: #4cc9f0; opacity: 0.22; emissive: #4cc9f0; emissiveIntensity: 0.9')

      const baseRing = document.createElement('a-ring')
      baseRing.setAttribute('position', '0 0.03 0')
      baseRing.setAttribute('rotation', '-90 0 0')
      baseRing.setAttribute('radius-inner', Math.max(0.35, this.getTriggerEnterRadius(trigger) * 0.55))
      baseRing.setAttribute('radius-outer', Math.max(0.52, this.getTriggerEnterRadius(trigger) * 0.78))
      baseRing.setAttribute('material', 'color: #4cc9f0; opacity: 0.9; emissive: #155e75; emissiveIntensity: 0.45')

      const pillar = document.createElement('a-cylinder')
      pillar.setAttribute('position', '0 0.48 0')
      pillar.setAttribute('radius', 0.05)
      pillar.setAttribute('height', 0.96)
      pillar.setAttribute('material', 'color: #eaf7ff; metalness: 0.1; roughness: 0.55')

      const banner = document.createElement('a-plane')
      banner.setAttribute('position', '0 1.46 0')
      banner.setAttribute('width', 1.15)
      banner.setAttribute('height', 0.36)
      banner.setAttribute('material', 'color: #0ea5e9; side: double; opacity: 0.95; emissive: #082f49; emissiveIntensity: 0.35')
      banner.setAttribute('rotation', '0 -12 0')

      marker.appendChild(beacon)
      marker.appendChild(baseRing)
      marker.appendChild(pillar)
      marker.appendChild(banner)
      this.el.sceneEl.appendChild(marker)
      this.triggerEntities.push(marker)
    })
  },
  addStartFlag(point) {
    const flag = document.createElement('a-entity')
    flag.setAttribute('position', `${point.x} ${point.y} ${point.z}`)

    const beacon = document.createElement('a-cylinder')
    beacon.setAttribute('position', '0 1.4 0')
    beacon.setAttribute('radius', 0.12)
    beacon.setAttribute('height', 2.8)
    beacon.setAttribute('material', 'color: #ffd166; opacity: 0.26; emissive: #ffd166; emissiveIntensity: 0.8')

    const baseRing = document.createElement('a-ring')
    baseRing.setAttribute('position', '0 0.03 0')
    baseRing.setAttribute('rotation', '-90 0 0')
    baseRing.setAttribute('radius-inner', 0.55)
    baseRing.setAttribute('radius-outer', 0.88)
    baseRing.setAttribute('material', 'color: #ffd166; opacity: 0.95; emissive: #8f6c1d; emissiveIntensity: 0.5')

    const pole = document.createElement('a-cylinder')
    pole.setAttribute('position', '0 1 0')
    pole.setAttribute('radius', 0.04)
    pole.setAttribute('height', 2)
    pole.setAttribute('material', 'color: #f2f2f2; metalness: 0.15; roughness: 0.6')

    const banner = document.createElement('a-plane')
    banner.setAttribute('position', '0.5 1.46 0')
    banner.setAttribute('width', 1)
    banner.setAttribute('height', 0.56)
    banner.setAttribute('material', 'color: #ff5a36; side: double; emissive: #7a2212; emissiveIntensity: 0.28')
    banner.setAttribute('rotation', '0 -18 0')

    flag.appendChild(beacon)
    flag.appendChild(baseRing)
    flag.appendChild(pole)
    flag.appendChild(banner)
    this.el.sceneEl.appendChild(flag)
    this.routeEntities.push(flag)
  },
  addDiagnosticBeacon(point, color = '#ff4d6d') {
    const beacon = document.createElement('a-entity')
    beacon.setAttribute('position', `${point.x} ${point.y} ${point.z}`)

    const orb = document.createElement('a-sphere')
    orb.setAttribute('position', '0 0.28 0')
    orb.setAttribute('radius', 0.18)
    orb.setAttribute('material', `color: ${color}; emissive: ${color}; emissiveIntensity: 0.85; opacity: 0.92`)

    const column = document.createElement('a-cylinder')
    column.setAttribute('position', '0 1.1 0')
    column.setAttribute('radius', 0.07)
    column.setAttribute('height', 2.2)
    column.setAttribute('material', `color: ${color}; emissive: ${color}; emissiveIntensity: 0.55; opacity: 0.3`)

    beacon.appendChild(orb)
    beacon.appendChild(column)
    this.el.sceneEl.appendChild(beacon)
    this.routeEntities.push(beacon)
  },
  clearRouteEntities() {
    this.routePoints = []
    this.markerEntities.forEach(entity => entity.remove())
    this.routeEntities.forEach(entity => entity.remove())
    this.markerEntities = []
    this.routeEntities = []
  },
  activatePresetRoute(trigger) {
    this.navigationActive = false
    this.currentTargetIndex = 1
    this.activeTriggerId = trigger.id
    this.triggerLockId = trigger.id
    this.triggerArmed = false
    this.clearRouteEntities()

    this.routePoints = this.getRouteScenePoints(trigger)
    this.routePoints.forEach(point => this.addMarker(point))
    this.renderRoute()
    if (this.routePoints[0]) {
      this.addStartFlag(this.routePoints[0])
      this.addDiagnosticBeacon(this.routePoints[0], '#ff4d6d')
    }
    if (this.gpsAnchor?.scene) {
      this.addDiagnosticBeacon(this.gpsAnchor.scene, '#7c3aed')
    }

    if (trigger.once) {
      this.firedTriggers.add(trigger.id)
      this.renderTriggerMarkers()
    }

    if (trigger.autoStart && this.routePoints.length >= 2) {
      this.navigationActive = true
      this.updateMarkerColors()
      this.updateStatus(`已触发预设路线，前往第 ${this.currentTargetIndex + 1}/${this.routePoints.length} 个点`)
    } else {
      this.updateStatus(`已加载预设路线，共 ${this.routePoints.length} 个点`)
    }

    if (this.prompt) {
      const startPoint = this.routePoints[0]
      this.prompt.textContent = `已加载预设路线: ${trigger.id}，起点约在 x=${startPoint.x.toFixed(1)} z=${startPoint.z.toFixed(1)}`
    }
    this.lastDiagnostic = `activated ${trigger.id} mode=${this.getRoutePositionMode(trigger)} points=${this.routePoints.length}`
    this.updateDebugPanel()
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
  getRouteSceneAnchor(trigger) {
    if (this.getRoutePositionMode(trigger) === 'gps' && this.calibrationAnchor?.scene) {
      return {...this.calibrationAnchor.scene}
    }

    if (this.getRoutePositionMode(trigger) === 'gps' && this.camera && this.camera.object3D) {
      this.camera.object3D.getWorldPosition(this.tempCam)
      this.camera.object3D.getWorldDirection(this.tempForward)

      const horizontalLength = Math.sqrt(
        this.tempForward.x * this.tempForward.x + this.tempForward.z * this.tempForward.z
      )

      if (horizontalLength > 0.001) {
        const normalizedX = this.tempForward.x / horizontalLength
        const normalizedZ = this.tempForward.z / horizontalLength

        return {
          x: this.tempCam.x + normalizedX * 1.4,
          y: 0.05,
          z: this.tempCam.z + normalizedZ * 1.4,
        }
      }
    }

    const basePoint = trigger.triggerPoint || trigger.points?.[0] || {x: 0, y: 0.05, z: -2.2}
    return {
      x: basePoint.x,
      y: basePoint.y ?? 0.05,
      z: basePoint.z,
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
        && parsedAnchor.gps
        && typeof parsedAnchor.gps.lat === 'number'
        && typeof parsedAnchor.gps.lng === 'number'
        && parsedAnchor.scene
        && typeof parsedAnchor.scene.x === 'number'
        && typeof parsedAnchor.scene.z === 'number'
        && typeof parsedAnchor.sceneForwardAngle === 'number'
      ) {
        this.calibrationAnchor = parsedAnchor
        this.lastDiagnostic = `calibration-restored ${parsedAnchor.gps.lat.toFixed(6)},${parsedAnchor.gps.lng.toFixed(6)}`
      }
    } catch (error) {
      this.clearPersistedCalibrationAnchor()
      this.lastDiagnostic = 'calibration-restore-failed'
    }
  },
  hasGpsTrigger(route) {
    return this.getRoutePositionMode(route) === 'gps' && route.triggerGps
      && typeof route.triggerGps.lat === 'number' && typeof route.triggerGps.lng === 'number'
  },
  hasGpsPoints(route) {
    return Array.isArray(route.pointsGps) && route.pointsGps.length >= 2
      && route.pointsGps.every(point => typeof point.lat === 'number' && typeof point.lng === 'number')
  },
  getMetersOffsetBetweenGpsPoints(origin, target) {
    const metersPerLatDegree = 111320
    const avgLatRad = ((origin.lat + target.lat) / 2) * (Math.PI / 180)
    const metersPerLngDegree = 111320 * Math.cos(avgLatRad)

    return {
      eastMeters: (target.lng - origin.lng) * metersPerLngDegree,
      northMeters: (target.lat - origin.lat) * metersPerLatDegree,
    }
  },
  rotateGpsOffsetToScene(offset, transformAngle) {
    const cosAngle = Math.cos(transformAngle)
    const sinAngle = Math.sin(transformAngle)

    return {
      x: offset.eastMeters * cosAngle - offset.northMeters * sinAngle,
      z: offset.eastMeters * sinAngle + offset.northMeters * cosAngle,
    }
  },
  getGpsSceneTransformAngle(trigger) {
    if (!this.hasGpsPoints(trigger) || trigger.pointsGps.length < 2) {
      return 0
    }

    const firstOffset = this.getMetersOffsetBetweenGpsPoints(trigger.pointsGps[0], trigger.pointsGps[1])
    const gpsAngle = Math.atan2(-firstOffset.northMeters, firstOffset.eastMeters)

    if (this.calibrationAnchor) {
      return this.calibrationAnchor.sceneForwardAngle - gpsAngle
    }

    if (!this.camera || !this.camera.object3D) {
      return 0
    }

    this.camera.object3D.getWorldDirection(this.tempForward)
    const horizontalLength = Math.sqrt(
      this.tempForward.x * this.tempForward.x + this.tempForward.z * this.tempForward.z
    )

    if (horizontalLength <= 0.001) {
      return 0
    }

    const forwardX = this.tempForward.x / horizontalLength
    const forwardZ = this.tempForward.z / horizontalLength
    const sceneAngle = Math.atan2(forwardZ, forwardX)
    return sceneAngle - gpsAngle
  },
  convertGpsPointToScenePoint(originGps, targetGps, anchorPoint, transformAngle = 0) {
    const offset = this.getMetersOffsetBetweenGpsPoints(originGps, targetGps)
    const rotatedOffset = this.rotateGpsOffsetToScene(offset, transformAngle)
    return {
      x: anchorPoint.x + rotatedOffset.x,
      y: anchorPoint.y,
      z: anchorPoint.z + rotatedOffset.z,
    }
  },
  getRouteScenePoints(trigger) {
    if (this.getRoutePositionMode(trigger) === 'gps' && this.hasGpsPoints(trigger)) {
      const anchorPoint = this.getRouteSceneAnchor(trigger)
      const anchorGps = this.calibrationAnchor?.gps || trigger.triggerGps || trigger.pointsGps[0]
      const transformAngle = this.getGpsSceneTransformAngle(trigger)
      this.gpsAnchor = {
        routeId: trigger.id,
        gps: {...anchorGps},
        scene: {...anchorPoint},
        transformAngle,
        calibrated: Boolean(this.calibrationAnchor),
      }

      return trigger.pointsGps.map(point => (
        this.convertGpsPointToScenePoint(anchorGps, point, anchorPoint, transformAngle)
      ))
    }

    this.gpsAnchor = null
    return (trigger.points || []).map(point => ({...point}))
  },
  startGeolocationWatch() {
    if (!this.gpsSupported) {
      this.gpsError = '当前浏览器不支持定位'
      this.updateDebugPanel()
      return
    }

    this.gpsWatchId = navigator.geolocation.watchPosition(
      (position) => this.onGeolocationSuccess(position),
      (error) => this.onGeolocationError(error),
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      }
    )
  },
  stopGeolocationWatch() {
    if (!this.gpsSupported || this.gpsWatchId == null) {
      return
    }

    navigator.geolocation.clearWatch(this.gpsWatchId)
    this.gpsWatchId = null
  },
  onGeolocationSuccess(position) {
    this.currentGpsPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    }
    this.gpsAccuracy = position.coords.accuracy
    this.gpsUpdatedAt = Date.now()
    this.gpsReady = true
    this.gpsError = null
    this.updateDebugPanel()

    if (!this.activeTriggerId) {
      this.updateStatus(`定位已就绪，精度约 ${this.gpsAccuracy.toFixed(0)}m`)
    }
  },
  onGeolocationError(error) {
    this.gpsReady = false
    this.gpsError = error?.message || '定位失败'
    this.updateDebugPanel()

    if (!this.activeTriggerId) {
      this.updateStatus(`定位不可用：${this.gpsError}`)
    }
  },
  formatGpsPosition() {
    if (!this.currentGpsPosition) {
      return '-'
    }

    return `${this.currentGpsPosition.lat.toFixed(6)}, ${this.currentGpsPosition.lng.toFixed(6)}`
  },
  isGpsAccurateEnoughForCalibration() {
    return this.gpsAccuracy != null && this.gpsAccuracy <= GPS_CALIBRATION_ACCURACY_THRESHOLD
  },
  isGpsAccurateEnoughForTrigger() {
    return this.gpsAccuracy != null && this.gpsAccuracy <= GPS_TRIGGER_ACCURACY_THRESHOLD
  },
  getGpsDistanceMeters(from, to) {
    const earthRadius = 6371000
    const lat1 = from.lat * (Math.PI / 180)
    const lat2 = to.lat * (Math.PI / 180)
    const deltaLat = (to.lat - from.lat) * (Math.PI / 180)
    const deltaLng = (to.lng - from.lng) * (Math.PI / 180)
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
      + Math.cos(lat1) * Math.cos(lat2)
      * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return earthRadius * c
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
      this.debugRouteText.textContent = `Route: ${activeRoute} | TestOnly: ${SINGLE_ROUTE_TEST_ID} | Fired: ${firedSummary}${anchorSummary}`
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
  renderRoute() {
    this.routeEntities.forEach(entity => entity.remove())
    this.routeEntities = []

    if (this.routePoints.length < 2) {
      return
    }

    for (let i = 0; i < this.routePoints.length - 1; i += 1) {
      const from = this.routePoints[i]
      const to = this.routePoints[i + 1]
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dz = to.z - from.z
      const horizontalLength = this.getHorizontalDistance(from, to)
      if (horizontalLength < 0.001) {
        continue
      }

      const nx = -dz / horizontalLength
      const nz = dx / horizontalLength
      const railOffset = 0.72
      const railLift = 0.02
      const arrowLift = 0.04
      const leftFrom = this.getOffsetPoint(from, nx, nz, railOffset, railLift)
      const leftTo = this.getOffsetPoint(to, nx, nz, railOffset, railLift)
      const rightFrom = this.getOffsetPoint(from, nx, nz, -railOffset, railLift)
      const rightTo = this.getOffsetPoint(to, nx, nz, -railOffset, railLift)

      const leftRail = document.createElement('a-entity')
      leftRail.setAttribute('line', `start: ${leftFrom.x} ${leftFrom.y} ${leftFrom.z}; end: ${leftTo.x} ${leftTo.y} ${leftTo.z}; color: #1598db; opacity: 1`)
      this.el.sceneEl.appendChild(leftRail)
      this.routeEntities.push(leftRail)

      const rightRail = document.createElement('a-entity')
      rightRail.setAttribute('line', `start: ${rightFrom.x} ${rightFrom.y} ${rightFrom.z}; end: ${rightTo.x} ${rightTo.y} ${rightTo.z}; color: #1598db; opacity: 1`)
      this.el.sceneEl.appendChild(rightRail)
      this.routeEntities.push(rightRail)

      const yaw = Math.atan2(dx, dz) * (180 / Math.PI)
      const arrowCount = Math.max(2, Math.floor(horizontalLength / 1.1))
      const arrowSpan = railOffset * 1.2
      const arrowDepth = 0.62

      for (let arrowIndex = 1; arrowIndex <= arrowCount; arrowIndex += 1) {
        const t = arrowIndex / (arrowCount + 1)
        const arrowX = from.x + (to.x - from.x) * t
        const arrowY = from.y + dy * t + arrowLift
        const arrowZ = from.z + (to.z - from.z) * t
        this.addChevron({
          x: arrowX,
          y: arrowY,
          z: arrowZ,
        }, yaw, arrowSpan, arrowDepth)
      }
    }
  },
  addChevron(center, yaw, span, depth) {
    const chevron = document.createElement('a-entity')
    chevron.setAttribute('position', `${center.x} ${center.y} ${center.z}`)
    chevron.setAttribute('rotation', `0 ${yaw} 0`)
    chevron.setAttribute('line__left', `start: ${-span} 0 ${-depth}; end: 0 0 ${depth}; color: #1598db; opacity: 1`)
    chevron.setAttribute('line__right', `start: ${span} 0 ${-depth}; end: 0 0 ${depth}; color: #1598db; opacity: 1`)
    this.el.sceneEl.appendChild(chevron)
    this.routeEntities.push(chevron)
  },
  getOffsetPoint(point, nx, nz, offset, lift = 0) {
    return {
      x: point.x + nx * offset,
      y: point.y + lift,
      z: point.z + nz * offset,
    }
  },
  updateMarkerColors() {
    this.markerEntities.forEach((marker, index) => {
      let color = '#5ac8fa'
      let emissive = '#1a6f8f'
      let radius = 0.35

      if (index === 0) {
        color = '#31d17c'
        emissive = '#1a633f'
        radius = 0.34
      } else if (index === this.routePoints.length - 1) {
        color = '#ff9f43'
        emissive = '#8f4f15'
        radius = 0.35
      }

      if (this.navigationActive && index === this.currentTargetIndex) {
        color = '#ffd166'
        emissive = '#8f6c1d'
        radius = 0.33
      }

      marker.setAttribute('material', `color: ${color}; emissive: ${emissive}; emissiveIntensity: 0.35`)
      marker.setAttribute('radius', radius)
    })
  },
  tick() {
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
}
