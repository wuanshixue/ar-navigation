1. 定义触发点与预设路线
- 新增一个触发配置表，例如 triggerRoutes。
- 每条配置包含：
  - 触发点坐标 x y z（或后续换成 GPS）
  - 触发半径 triggerRadius
  - 对应预设路线 points（至少2个点）
  - 是否自动开始导航 autoStart
  - 一次性触发 once
2. 在组件里增加状态
- activeTriggerId：当前已触发的规则
- firedTriggers：已触发集合，防止重复
- triggerCooldownMs 和 lastTriggerAt：防抖，避免边界抖动反复触发
- triggerArmed：是否允许再次触发
3. 在 tick 里做触发检测
- 即使 navigationActive 为 false，也要持续检测用户位置。
- 读取 camera 世界坐标，与每个 trigger 点计算水平距离。
 - 如果距离小于 triggerRadius 且满足冷却条件，就触发路线加载。
4. 触发后加载预设路线
- 调用新方法 activatePresetRoute(trigger)：
  - 先清空当前路线实体和点位（复用你已有清空逻辑）
  - 把 trigger.points 赋值给 routePoints
  - 为每个点创建 marker
  - renderRoute
  - 根据 autoStart 决定是否直接 navigationActive = true
  - 更新提示文案和状态文案
5. 避免重复触发
- once 为 true 时，触发后写入 firedTriggers，不再触发。
- 若需要可重复触发，建议用 进入半径 与 退出半径 两级阈值（例如 1.5m 进入，2.2m 退出），避免人在边缘来回跳。
6. 数据来源建议
- 初版可直接写在组件常量里，先跑通。
- 二版改为读取 JSON（如 routes.json），便于运营配置多个触发点和路线。
7. 两种定位模式
- 场景坐标定位（推荐先做）：用当前 camera 的世界坐标和触发点比距离，改动最小。
- GPS 地理围栏（后续）：把经纬度映射到 AR 坐标或直接做地理触发，再加载同一套预设路线逻辑。