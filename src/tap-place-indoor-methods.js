export const tapPlaceIndoorMethods = {
  populateIndoorAnchorOptions() {
    if (!this.startAnchorSelect) {
      return
    }

    const optionsMarkup = ['<option value="">请选择起点锚点</option>']
    this.indoorAnchors.forEach((anchor) => {
      optionsMarkup.push(`<option value="${anchor.id}">${anchor.name}</option>`)
    })
    this.startAnchorSelect.innerHTML = optionsMarkup.join('')
  },
  populateDestinationOptions(anchorId) {
    if (!this.destinationSelect) {
      return
    }

    const routes = this.findIndoorRoutesByStartAnchor(anchorId)
    const optionsMarkup = ['<option value="">请选择目的地</option>']
    routes.forEach((route) => {
      optionsMarkup.push(`<option value="${route.id}">${route.destinationName}</option>`)
    })
    this.destinationSelect.innerHTML = optionsMarkup.join('')

    if (routes.length === 0) {
      this.selectedIndoorRouteId = null
      this.clearPersistedSelectedIndoorRoute()
      return
    }

    const matchedRoute = routes.find(route => route.id === this.selectedIndoorRouteId)
    const nextRoute = matchedRoute || routes[0]
    this.selectedIndoorRouteId = nextRoute.id
    this.destinationSelect.value = nextRoute.id
    this.persistSelectedIndoorRoute()
  },
  findIndoorAnchorById(anchorId) {
    return this.indoorAnchors.find(anchor => anchor.id === anchorId) || null
  },
  findIndoorRoutesByStartAnchor(anchorId) {
    if (!anchorId) {
      return []
    }

    return this.indoorRoutes.filter(route => route.startAnchorId === anchorId)
  },
  findIndoorRouteById(routeId) {
    return this.indoorRoutes.find(route => route.id === routeId) || null
  },
  renderIndoorAnchorMarkers() {
    this.anchorEntities.forEach(entity => entity.remove())
    this.anchorEntities = []

    this.indoorAnchors.forEach((anchor) => {
      const isSelected = anchor.id === this.selectedStartAnchorId
      const marker = document.createElement('a-entity')
      marker.setAttribute(
        'position',
        `${anchor.scenePoint.x} ${anchor.scenePoint.y} ${anchor.scenePoint.z}`
      )

      const ring = document.createElement('a-ring')
      ring.setAttribute('position', '0 0.03 0')
      ring.setAttribute('rotation', '-90 0 0')
      ring.setAttribute('radius-inner', isSelected ? 0.48 : 0.34)
      ring.setAttribute('radius-outer', isSelected ? 0.72 : 0.54)
      ring.setAttribute(
        'material',
        `color: ${isSelected ? '#31d17c' : '#a7f3d0'}; opacity: 0.92; emissive: ${isSelected ? '#1a633f' : '#14532d'}; emissiveIntensity: 0.45`
      )

      const pillar = document.createElement('a-cylinder')
      pillar.setAttribute('position', '0 0.55 0')
      pillar.setAttribute('radius', 0.05)
      pillar.setAttribute('height', isSelected ? 1.2 : 0.9)
      pillar.setAttribute(
        'material',
        `color: ${isSelected ? '#31d17c' : '#d1fae5'}; opacity: 0.9; emissive: ${isSelected ? '#14532d' : '#166534'}; emissiveIntensity: 0.35`
      )

      const label = this.createFloatingLabel({
        text: anchor.name,
        y: isSelected ? 1.45 : 1.2,
        width: Math.max(1.1, anchor.name.length * 0.42),
        textWidth: Math.max(3.4, anchor.name.length * 1.3),
        backgroundColor: isSelected ? '#166534' : '#14532d',
        textColor: '#f0fdf4',
      })

      marker.appendChild(ring)
      marker.appendChild(pillar)
      marker.appendChild(label)
      this.el.sceneEl.appendChild(marker)
      this.anchorEntities.push(marker)
    })

    this.getIndoorDestinationMarkers().forEach((destination) => {
      const marker = this.createIndoorDestinationMarker(destination)
      this.el.sceneEl.appendChild(marker)
      this.anchorEntities.push(marker)
    })
  },
  getIndoorDestinationMarkers() {
    const dedupedDestinations = new Map()

    this.indoorRoutes.forEach((route) => {
      const endpoint = route.points?.[route.points.length - 1]
      if (!endpoint) {
        return
      }

      const key = `${route.destinationName}:${endpoint.x}:${endpoint.y}:${endpoint.z}`
      if (!dedupedDestinations.has(key)) {
        dedupedDestinations.set(key, {
          routeId: route.id,
          destinationName: route.destinationName,
          point: endpoint,
        })
      }
    })

    return [...dedupedDestinations.values()]
  },
  createIndoorDestinationMarker(destination) {
    const isSelected = destination.routeId === this.selectedIndoorRouteId
    const palette = this.getIndoorDestinationPalette(destination.destinationName)
    const marker = document.createElement('a-entity')
    marker.setAttribute(
      'position',
      `${destination.point.x} ${destination.point.y} ${destination.point.z}`
    )

    const ring = document.createElement('a-ring')
    ring.setAttribute('position', '0 0.03 0')
    ring.setAttribute('rotation', '-90 0 0')
    ring.setAttribute('radius-inner', isSelected ? 0.26 : 0.18)
    ring.setAttribute('radius-outer', isSelected ? 0.46 : 0.34)
    ring.setAttribute(
      'material',
      `color: ${isSelected ? palette.activeRing : palette.ring}; opacity: 0.94; emissive: ${isSelected ? palette.activeEmissive : palette.emissive}; emissiveIntensity: 0.42`
    )

    const pillar = document.createElement('a-cylinder')
    pillar.setAttribute('position', '0 0.42 0')
    pillar.setAttribute('radius', 0.04)
    pillar.setAttribute('height', isSelected ? 0.92 : 0.72)
    pillar.setAttribute(
      'material',
      `color: ${isSelected ? palette.activePillar : palette.pillar}; opacity: 0.96; emissive: ${isSelected ? palette.activeEmissive : palette.emissive}; emissiveIntensity: 0.24`
    )

    const label = this.createFloatingLabel({
      text: destination.destinationName,
      y: isSelected ? 1.42 : 1.22,
      width: Math.max(1.05, destination.destinationName.length * 0.42),
      textWidth: Math.max(3.2, destination.destinationName.length * 1.25),
      backgroundColor: isSelected ? palette.activeLabel : palette.label,
      textColor: '#fff7ed',
      emissiveColor: palette.labelEmissive,
    })

    marker.appendChild(ring)
    marker.appendChild(pillar)
    marker.appendChild(label)
    return marker
  },
  createFloatingLabel({
    text,
    y = 1.2,
    width = 1.1,
    height = 0.42,
    textWidth = 3.2,
    backgroundColor = '#1f2937',
    textColor = '#ffffff',
    emissiveColor = '#111827',
  }) {
    const labelBg = document.createElement('a-plane')
    labelBg.classList.add('billboard-label')
    labelBg.setAttribute('position', `0 ${y} 0`)
    labelBg.setAttribute('width', width)
    labelBg.setAttribute('height', height)
    labelBg.setAttribute(
      'material',
      `color: ${backgroundColor}; side: double; opacity: 0.92; emissive: ${emissiveColor}; emissiveIntensity: 0.24`
    )

    const labelText = document.createElement('a-text')
    labelText.setAttribute('value', text)
    labelText.setAttribute('position', '0 0 0.01')
    labelText.setAttribute('align', 'center')
    labelText.setAttribute('anchor', 'center')
    labelText.setAttribute('baseline', 'center')
    labelText.setAttribute('color', textColor)
    labelText.setAttribute('width', textWidth)

    labelBg.appendChild(labelText)
    this.billboardEntities.push(labelBg)
    return labelBg
  },
  updateBillboardLabels() {
    if (!this.camera || !this.camera.object3D || this.billboardEntities.length === 0) {
      return
    }

    this.camera.object3D.getWorldPosition(this.tempCam)
    this.billboardEntities = this.billboardEntities.filter(entity => entity?.isConnected)

    this.billboardEntities.forEach((entity) => {
      if (!entity.object3D) {
        return
      }

      entity.object3D.getWorldPosition(this.tempTarget)
      const dx = this.tempCam.x - this.tempTarget.x
      const dz = this.tempCam.z - this.tempTarget.z
      if (Math.abs(dx) < 0.0001 && Math.abs(dz) < 0.0001) {
        return
      }

      const yaw = Math.atan2(dx, dz)
      entity.object3D.rotation.set(0, yaw, 0)
    })
  },
  getIndoorDestinationPalette(destinationName) {
    const paletteByDestination = {
      '服务台': {ring: '#60a5fa', activeRing: '#2563eb', emissive: '#1d4ed8', activeEmissive: '#1e3a8a', pillar: '#dbeafe', activePillar: '#93c5fd', label: '#1d4ed8', activeLabel: '#1e40af', labelEmissive: '#172554'},
      '电梯口': {ring: '#a78bfa', activeRing: '#7c3aed', emissive: '#6d28d9', activeEmissive: '#4c1d95', pillar: '#ede9fe', activePillar: '#c4b5fd', label: '#6d28d9', activeLabel: '#5b21b6', labelEmissive: '#2e1065'},
      '内科': {ring: '#34d399', activeRing: '#059669', emissive: '#047857', activeEmissive: '#064e3b', pillar: '#d1fae5', activePillar: '#6ee7b7', label: '#047857', activeLabel: '#065f46', labelEmissive: '#022c22'},
      '外科': {ring: '#f87171', activeRing: '#dc2626', emissive: '#b91c1c', activeEmissive: '#7f1d1d', pillar: '#fee2e2', activePillar: '#fca5a5', label: '#b91c1c', activeLabel: '#991b1b', labelEmissive: '#450a0a'},
      '检验科': {ring: '#22d3ee', activeRing: '#0891b2', emissive: '#0e7490', activeEmissive: '#164e63', pillar: '#cffafe', activePillar: '#67e8f9', label: '#0e7490', activeLabel: '#155e75', labelEmissive: '#083344'},
      '药房': {ring: '#fbbf24', activeRing: '#d97706', emissive: '#b45309', activeEmissive: '#78350f', pillar: '#fef3c7', activePillar: '#fcd34d', label: '#b45309', activeLabel: '#92400e', labelEmissive: '#451a03'},
    }

    return paletteByDestination[destinationName] || {
      ring: '#fb923c',
      activeRing: '#f97316',
      emissive: '#7c2d12',
      activeEmissive: '#9a3412',
      pillar: '#ffedd5',
      activePillar: '#fdba74',
      label: '#7c2d12',
      activeLabel: '#ea580c',
      labelEmissive: '#431407',
    }
  },
  loadIndoorRoute(route) {
    this.navigationActive = false
    this.currentTargetIndex = 1
    this.activeTriggerId = route.id
    this.triggerLockId = null
    this.clearRouteEntities()

    this.routePoints = this.getIndoorRouteScenePoints(route)
    this.routePoints.forEach(point => this.addMarker(point))
    this.renderRoute()

    if (this.routePoints[0]) {
      this.addStartFlag(this.routePoints[0])
      this.addDiagnosticBeacon(this.routePoints[0], '#22c55e')
    }
    if (this.routePoints.length > 0) {
      const destinationPoint = this.routePoints[this.routePoints.length - 1]
      this.addDestinationFlag(destinationPoint, route.destinationName)
    }

    if (route.autoStart && this.routePoints.length >= 2) {
      this.navigationActive = true
      this.updateMarkerColors()
      this.updateStatus(`室内导航开始，前往 ${route.destinationName}`)
    } else {
      this.updateStatus(`已加载室内路线，目标：${route.destinationName}`)
    }

    if (this.prompt) {
      this.prompt.textContent = `室内路线：${route.destinationName}`
    }

    this.lastDiagnostic = `indoor-route-loaded ${route.id}${this.calibrationAnchor?.anchorId === route.startAnchorId ? ' calibrated' : ''}`
    this.updateDebugPanel()
  },
}
