const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { levelFilter, offset = 0, limit = 20 } = event

  let query = db.collection('debaters')

  // 如果有级别筛选，需要从matches中聚合
  // 但简化版本：直接按totalScore排序（不区分级别）
  // 如需按级别筛选，需要在debaters中额外存储各级别的积分
  if (levelFilter) {
    // 按级别筛选时，查找参与过该级别比赛的辩手
    // 先从matches中获取参与者ID列表
    const matchResult = await db.collection('matches')
      .where({ level: levelFilter })
      .field({ participants: true })
      .get()

    const debaterIds = new Set()
    matchResult.data.forEach(match => {
      (match.participants || []).forEach(p => {
        debaterIds.add(p.debaterId)
      })
    })

    if (debaterIds.size === 0) {
      return { data: [] }
    }

    const ids = Array.from(debaterIds)
    // 云数据库 where in 限制100条
    const _ = db.command
    query = query.where({
      _id: _.in(ids.slice(0, 100))
    })
  }

  const result = await query
    .orderBy('totalScore', 'desc')
    .skip(offset)
    .limit(limit)
    .get()

  return { data: result.data }
}
