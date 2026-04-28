export const tapPlaceRenderMethods = {
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
  addDestinationFlag(point, destinationName) {
    const palette = this.getIndoorDestinationPalette(destinationName)
    const flag = document.createElement('a-entity')
    flag.setAttribute('position', `${point.x} ${point.y} ${point.z}`)

    const pulseHalo = document.createElement('a-ring')
    pulseHalo.setAttribute('position', '0 0.04 0')
    pulseHalo.setAttribute('rotation', '-90 0 0')
    pulseHalo.setAttribute('radius-inner', 0.76)
    pulseHalo.setAttribute('radius-outer', 1.08)
    pulseHalo.setAttribute(
      'material',
      `color: ${palette.activeRing}; opacity: 0.34; emissive: ${palette.activeEmissive}; emissiveIntensity: 0.82`
    )
    pulseHalo.setAttribute(
      'animation__pulse',
      'property: scale; dir: alternate; dur: 1100; easing: easeInOutSine; loop: true; to: 1.2 1.2 1.2'
    )
    pulseHalo.setAttribute(
      'animation__fade',
      'property: material.opacity; dir: alternate; dur: 1100; easing: easeInOutSine; loop: true; to: 0.14'
    )

    const ring = document.createElement('a-ring')
    ring.setAttribute('position', '0 0.03 0')
    ring.setAttribute('rotation', '-90 0 0')
    ring.setAttribute('radius-inner', 0.5)
    ring.setAttribute('radius-outer', 0.88)
    ring.setAttribute(
      'material',
      `color: ${palette.activeRing}; opacity: 0.98; emissive: ${palette.activeEmissive}; emissiveIntensity: 0.68`
    )

    const pillar = document.createElement('a-cylinder')
    pillar.setAttribute('position', '0 1.18 0')
    pillar.setAttribute('radius', 0.06)
    pillar.setAttribute('height', 2.35)
    pillar.setAttribute(
      'material',
      `color: ${palette.activePillar}; opacity: 0.98; emissive: ${palette.activeEmissive}; emissiveIntensity: 0.34`
    )
    pillar.setAttribute(
      'animation__glow',
      'property: material.emissiveIntensity; dir: alternate; dur: 1100; easing: easeInOutSine; loop: true; to: 0.58'
    )

    const beacon = document.createElement('a-cylinder')
    beacon.setAttribute('position', '0 1.38 0')
    beacon.setAttribute('radius', 0.11)
    beacon.setAttribute('height', 2.8)
    beacon.setAttribute(
      'material',
      `color: ${palette.activeRing}; opacity: 0.16; emissive: ${palette.activeEmissive}; emissiveIntensity: 0.92`
    )

    const labelBg = document.createElement('a-plane')
    labelBg.setAttribute('position', '0 2.35 0')
    labelBg.setAttribute('width', Math.max(1.35, destinationName.length * 0.58))
    labelBg.setAttribute('height', 0.6)
    labelBg.setAttribute(
      'material',
      `color: ${palette.activeLabel}; side: double; opacity: 0.98; emissive: ${palette.labelEmissive}; emissiveIntensity: 0.34`
    )

    const labelText = document.createElement('a-text')
    labelText.setAttribute('value', destinationName)
    labelText.setAttribute('position', '0 0 0.01')
    labelText.setAttribute('align', 'center')
    labelText.setAttribute('anchor', 'center')
    labelText.setAttribute('baseline', 'center')
    labelText.setAttribute('color', '#fff7ed')
    labelText.setAttribute('width', Math.max(4.1, destinationName.length * 1.6))

    labelBg.appendChild(labelText)
    flag.appendChild(pulseHalo)
    flag.appendChild(ring)
    flag.appendChild(pillar)
    flag.appendChild(beacon)
    flag.appendChild(labelBg)
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
      this.prompt.textContent = `起点坐标：${this.routePoints[0]?.x?.toFixed(1) || 0}, ${this.routePoints[0]?.z?.toFixed(1) || 0}`
    }

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
}
