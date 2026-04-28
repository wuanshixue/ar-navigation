import {
  GPS_CALIBRATION_ACCURACY_THRESHOLD,
  GPS_TRIGGER_ACCURACY_THRESHOLD,
} from './tap-place-config'

export const tapPlaceGeoMethods = {
  getRouteSceneAnchor(trigger) {
    const selectedAnchor = this.findIndoorAnchorById(this.selectedStartAnchorId)
    if (selectedAnchor?.scenePoint) {
      return {...selectedAnchor.scenePoint}
    }

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
  getAnchorForwardAngle(anchor) {
    const forwardX = anchor?.forward?.x ?? 0
    const forwardZ = anchor?.forward?.z ?? -1
    const horizontalLength = Math.sqrt(forwardX * forwardX + forwardZ * forwardZ)
    if (horizontalLength <= 0.001) {
      return -Math.PI / 2
    }

    return Math.atan2(forwardZ / horizontalLength, forwardX / horizontalLength)
  },
  rotateSceneOffset(offset, transformAngle) {
    const cosAngle = Math.cos(transformAngle)
    const sinAngle = Math.sin(transformAngle)
    return {
      x: offset.x * cosAngle - offset.z * sinAngle,
      z: offset.x * sinAngle + offset.z * cosAngle,
    }
  },
  getIndoorRouteScenePoints(route) {
    const sourceAnchor = this.findIndoorAnchorById(route.startAnchorId)
    if (!sourceAnchor?.scenePoint) {
      return (route.points || []).map(point => ({...point}))
    }

    const canUseIndoorCalibration =
      this.calibrationAnchor
      && this.calibrationAnchor.type === 'indoor-anchor'
      && this.calibrationAnchor.anchorId === route.startAnchorId

    if (!canUseIndoorCalibration) {
      return (route.points || []).map(point => ({...point}))
    }

    const baseAngle = this.getAnchorForwardAngle(sourceAnchor)
    const transformAngle = this.calibrationAnchor.sceneForwardAngle - baseAngle
    const anchorScene = this.calibrationAnchor.scene

    return route.points.map((point) => {
      const offset = {
        x: point.x - sourceAnchor.scenePoint.x,
        z: point.z - sourceAnchor.scenePoint.z,
      }
      const rotatedOffset = this.rotateSceneOffset(offset, transformAngle)
      return {
        x: anchorScene.x + rotatedOffset.x,
        y: point.y ?? anchorScene.y ?? 0.05,
        z: anchorScene.z + rotatedOffset.z,
      }
    })
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
}
