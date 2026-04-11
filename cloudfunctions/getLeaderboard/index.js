const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { levelFilter = '', monthFilter = '', offset = 0, limit = 20 } = event

  // 计算月份筛选的日期范围
  let dateRange = null
  if (monthFilter) {
    // monthFilter 格式: "2026-04"
    const startDate = monthFilter + '-01'
    const [year, month] = monthFilter.split('-').map(Number)
    // 计算该月最后一天
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${monthFilter}-${String(lastDay).padStart(2, '0')}`
    dateRange = { startDate, endDate }
  }

  if (!levelFilter && !monthFilter) {
    // 全部（无筛选）：直接按 totalScore 排序，排除积分为0的
    const result = await db.collection('debaters')
      .where({ totalScore: _.gt(0) })
      .orderBy('totalScore', 'desc')
      .orderBy('matchCount', 'desc')
      .skip(offset)
      .limit(limit)
      .get()
    const data = result.data.map((d, i) => ({
      ...d,
      rank: offset + i + 1
    }))
    return { data }
  }

  // 需要从 matches 中聚合的场景
  let whereCondition = {}
  if (levelFilter) {
    whereCondition.level = levelFilter
  }
  if (dateRange) {
    whereCondition.date = _.gte(dateRange.startDate).and(_.lte(dateRange.endDate))
  }

  // 分批获取符合条件的比赛
  const allMatches = []
  let lastMatchId = null
  let hasMore = true
  while (hasMore) {
    let condition = { ...whereCondition }
    if (lastMatchId) {
      condition._id = _.gt(lastMatchId)
    }
    const res = await db.collection('matches')
      .where(condition)
      .field({ participants: true })
      .limit(100)
      .orderBy('_id', 'asc')
      .get()
    allMatches.push(...res.data)
    if (res.data.length < 100) {
      hasMore = false
    } else {
      lastMatchId = res.data[res.data.length - 1]._id
    }
  }

  // 计算每个辩手的累计得分
  const scoreMap = {}
  const matchCountMap = {}
  for (const match of allMatches) {
    for (const p of (match.participants || [])) {
      const id = p.debaterId
      if (!id) continue
      scoreMap[id] = (scoreMap[id] || 0) + ((p.scoreBreakdown && p.scoreBreakdown.matchTotal) || 0)
      matchCountMap[id] = (matchCountMap[id] || 0) + 1
    }
  }

  // 过滤掉积分为0的
  const filteredIds = Object.keys(scoreMap).filter(id => scoreMap[id] > 0)

  if (filteredIds.length === 0) {
    return { data: [] }
  }

  // 查询辩手详细信息
  const allDebaters = []
  for (let i = 0; i < filteredIds.length; i += 100) {
    const batch = filteredIds.slice(i, i + 100)
    const result = await db.collection('debaters')
      .where({ _id: _.in(batch) })
      .get()
    allDebaters.push(...result.data)
  }

  // 替换为筛选后的积分
  const enriched = allDebaters.map(d => ({
    ...d,
    totalScore: scoreMap[d._id] || 0,
    matchCount: matchCountMap[d._id] || 0
  }))

  // 按积分排序（同分按比赛场数降序）
  enriched.sort((a, b) => b.totalScore - a.totalScore || b.matchCount - a.matchCount)

  // 分页
  const paged = enriched.slice(offset, offset + limit)

  const result = paged.map((d, i) => ({
    ...d,
    rank: offset + i + 1
  }))

  return { data: result }
}
