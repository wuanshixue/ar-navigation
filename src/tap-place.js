// Minimal navigation component: tap to place route points, then follow the path.

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
    this.navigationActive = false
    this.currentTargetIndex = 1
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

    this.updateStatus('点击地面设置起点和终点')
  },
  remove() {
    this.ground.removeEventListener('click', this.onGroundClick)
    this.startButton.removeEventListener('click', this.onStartNavigation)
    this.undoButton.removeEventListener('click', this.onUndoLastPoint)
    this.clearButton.removeEventListener('click', this.onClearRoute)
    this.recenterButton.removeEventListener('click', this.onRecenter)
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
    this.currentTargetIndex = 1
    this.routePoints = []

    this.markerEntities.forEach(entity => entity.remove())
    this.routeEntities.forEach(entity => entity.remove())
    this.markerEntities = []
    this.routeEntities = []

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

    const remaining = this.getRemainingDistance(distToTarget)
    this.updateStatus(`导航中：下一点 ${distToTarget.toFixed(1)}cm，剩余 ${remaining.toFixed(1)}cm`)
  },
  getRemainingDistance(distToTarget) {
    let remaining = distToTarget

    for (let i = this.currentTargetIndex; i < this.routePoints.length - 1; i += 1) {
      const from = this.routePoints[i]
      const to = this.routePoints[i + 1]
      remaining += this.getHorizontalDistance(from, to)
    }

    return remaining
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
