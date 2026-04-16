// Minimal navigation component: tap to place route points, then follow the path.
import triggerRoutes from './trigger-routes.json'

export const tapPlaceComponent = {
  schema: {
    arrivalThreshold: {default: 0.8},
  },
  init() {
    this.ground = document.getElementById('ground')
    this.camera = document.getElementById('camera')
    this.prompt = document.getElementById('promptText')
    this.statusText = document.getElementById('statusText')
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
    this.activeTriggerId = null
    this.triggerLockId = null
    this.firedTriggers = new Set()
    this.triggerCooldownMs = 1500
    this.lastTriggerAt = 0
    this.triggerArmed = true
    this.tempCam = new AFRAME.THREE.Vector3()
    this.tempTarget = new AFRAME.THREE.Vector3()

    this.onGroundClick = this.onGroundClick.bind(this)
    this.onStartNavigation = this.onStartNavigation.bind(this)
    this.onUndoLastPoint = this.onUndoLastPoint.bind(this)
    this.onClearRoute = this.onClearRoute.bind(this)
    this.onRecenter = this.onRecenter.bind(this)

    this.ground.addEventListener('click', this.onGroundClick)
    this.startButton.addEventListener('click', this.onStartNavigation)
    this.undoButton.addEventListener('click', this.onUndoLastPoint)
    this.clearButton.addEventListener('click', this.onClearRoute)
    this.recenterButton.addEventListener('click', this.onRecenter)

    this.renderTriggerMarkers()
    this.updateStatus('点击地面设置起点和终点')
  },
  remove() {
    this.ground.removeEventListener('click', this.onGroundClick)
    this.startButton.removeEventListener('click', this.onStartNavigation)
    this.undoButton.removeEventListener('click', this.onUndoLastPoint)
    this.clearButton.removeEventListener('click', this.onClearRoute)
    this.recenterButton.removeEventListener('click', this.onRecenter)
    this.triggerEntities.forEach(entity => entity.remove())
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
    this.navigationActive = false
    this.currentTargetIndex = 1

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
    this.currentTargetIndex = 1
    this.clearRouteEntities()

    if (this.prompt) {
      this.prompt.textContent = '点击地面设置起点和终点'
    }
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

    this.routePoints = trigger.points.map(point => ({...point}))
    this.routePoints.forEach(point => this.addMarker(point))
    this.renderRoute()
    if (this.routePoints[0]) {
      this.addStartFlag(this.routePoints[0])
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
  },
  getTriggerEnterRadius(trigger) {
    return trigger.enterRadius ?? trigger.triggerRadius ?? 1.5
  },
  getTriggerExitRadius(trigger) {
    const enterRadius = this.getTriggerEnterRadius(trigger)
    return trigger.exitRadius ?? Math.max(enterRadius + 0.7, enterRadius * 1.35)
  },
  findTriggerById(triggerId) {
    return this.triggerRoutes.find(trigger => trigger.id === triggerId) || null
  },
  updateTriggerArming() {
    if (!this.camera || !this.camera.object3D || this.triggerArmed || !this.triggerLockId) {
      return
    }

    const lockedTrigger = this.findTriggerById(this.triggerLockId)
    if (!lockedTrigger) {
      this.triggerArmed = true
      this.triggerLockId = null
      return
    }

    this.camera.object3D.getWorldPosition(this.tempCam)
    this.tempTarget.set(lockedTrigger.triggerPoint.x, lockedTrigger.triggerPoint.y, lockedTrigger.triggerPoint.z)
    const distance = this.getHorizontalDistance(this.tempCam, this.tempTarget)

    if (distance >= this.getTriggerExitRadius(lockedTrigger)) {
      this.triggerArmed = true
      this.triggerLockId = null
    }
  },
  checkTriggerRoutes() {
    if (!this.camera || !this.camera.object3D) {
      return
    }

    this.updateTriggerArming()

    if (!this.triggerArmed) {
      return
    }

    const now = Date.now()
    if (now - this.lastTriggerAt < this.triggerCooldownMs) {
      return
    }

    this.camera.object3D.getWorldPosition(this.tempCam)

    for (const trigger of this.triggerRoutes) {
      if (trigger.once && this.firedTriggers.has(trigger.id)) {
        continue
      }

      this.tempTarget.set(trigger.triggerPoint.x, trigger.triggerPoint.y, trigger.triggerPoint.z)
      const distance = this.getHorizontalDistance(this.tempCam, this.tempTarget)

      if (distance > this.getTriggerEnterRadius(trigger)) {
        continue
      }

      this.lastTriggerAt = now
      this.activatePresetRoute(trigger)
      return
    }
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
