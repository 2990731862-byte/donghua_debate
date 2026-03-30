const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { levelFilter, offset = 0, limit = 20 } = event

  if (!levelFilter) {
    // 全部：直接按 totalScore 排序
    const result = await db.collection('debaters')
      .orderBy('totalScore', 'desc')
      .skip(offset)
      .limit(limit)
      .get()
    const data = result.data.map((d, i) => ({
      ...d,
      rank: offset + i + 1
    }))
    return { data }
  }

  // 按赛级筛选：从 matches 中聚合该赛级的积分
  // 分批获取所有该赛级的比赛（云数据库单次最多100条）
  const allMatches = []
  let lastMatchId = null
  let hasMore = true
  while (hasMore) {
    let query = db.collection('matches')
      .where({ level: levelFilter })
      .field({ participants: true })
      .limit(100)
      .orderBy('_id', 'asc')
    if (lastMatchId) {
      query = query.where({ _id: _.gt(lastMatchId) })
    }
    const res = await query.get()
    allMatches.push(...res.data)
    if (res.data.length < 100) {
      hasMore = false
    } else {
      lastMatchId = res.data[res.data.length - 1]._id
    }
  }

  // 计算每个辩手在该赛级的累计得分
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

  if (Object.keys(scoreMap).length === 0) {
    return { data: [] }
  }

  // 查询这些辩手的详细信息
  const debaterIds = Object.keys(scoreMap)
  // 云数据库 where in 限制100条，分批查询
  const allDebaters = []
  for (let i = 0; i < debaterIds.length; i += 100) {
    const batch = debaterIds.slice(i, i + 100)
    const result = await db.collection('debaters')
      .where({ _id: _.in(batch) })
      .get()
    allDebaters.push(...result.data)
  }

  // 替换为赛级专属积分和比赛数
  const enriched = allDebaters.map(d => ({
    ...d,
    totalScore: scoreMap[d._id] || 0,
    matchCount: matchCountMap[d._id] || 0
  }))

  // 按赛级积分排序
  enriched.sort((a, b) => b.totalScore - a.totalScore)

  // 分页
  const paged = enriched.slice(offset, offset + limit)

  // 设置排名
  const result = paged.map((d, i) => ({
    ...d,
    rank: offset + i + 1
  }))

  return { data: result }
}
