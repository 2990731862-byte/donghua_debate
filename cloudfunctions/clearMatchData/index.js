const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 清空所有比赛数据：
 * - 删除 matches 集合中的所有记录
 * - 重置所有辩手的 totalScore、matchCount、personalRecords、rank
 * - 更新 settings 中的下次清空日期
 * - 不删除辩手信息
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()

  // 验证管理员权限
  const now = new Date()
  const adminResult = await db.collection('admins')
    .where(_.or([
      { openid: OPENID, role: 'super_admin' },
      { openid: OPENID, expiresAt: _.gt(now) },
      { openid: OPENID, expiresAt: _.exists(false) }
    ]))
    .get()
  if (adminResult.data.length === 0) {
    return { success: false, message: '无权限或权限已过期' }
  }

  // 删除所有比赛记录（分批删除，使用 _id 游标避免死循环）
  let deletedCount = 0
  let lastId = null
  let hasMore = true
  while (hasMore) {
    let query = db.collection('matches').limit(100).orderBy('_id', 'asc')
    if (lastId) {
      query = query.where({ _id: _.gt(lastId) })
    }
    const batch = await query.get()
    if (batch.data.length === 0) {
      hasMore = false
      break
    }
    for (const doc of batch.data) {
      await db.collection('matches').doc(doc._id).remove()
      deletedCount++
    }
    lastId = batch.data[batch.data.length - 1]._id
    if (batch.data.length < 100) {
      hasMore = false
    }
  }

  // 重置所有辩手的积分（使用 _id 游标）
  let resetCount = 0
  let lastDebaterId = null
  let hasMoreDebaters = true
  while (hasMoreDebaters) {
    let query = db.collection('debaters').limit(100).orderBy('_id', 'asc')
    if (lastDebaterId) {
      query = query.where({ _id: _.gt(lastDebaterId) })
    }
    const batch = await query.get()
    if (batch.data.length === 0) {
      hasMoreDebaters = false
      break
    }
    for (const d of batch.data) {
      await db.collection('debaters').doc(d._id).update({
        data: {
          totalScore: 0,
          matchCount: 0,
          rank: 0,
          personalRecords: {
            '院赛': { maxRound: 0, bestDebater: false, topThree: false },
            '校赛': { maxRound: 0, bestDebater: false, topThree: false },
            '市赛': { maxRound: 0, bestDebater: false, topThree: false }
          },
          updatedAt: now
        }
      })
      resetCount++
    }
    lastDebaterId = batch.data[batch.data.length - 1]._id
    if (batch.data.length < 100) {
      hasMoreDebaters = false
    }
  }

  // 确保 settings 集合存在
  try { await db.createCollection('settings') } catch (e) { /* 已存在 */ }

  // 计算下次清空日期：从当前月份开始 + 6个月，取1号
  const clearMonth = new Date(now.getFullYear(), now.getMonth() + 6, 1)
  const nextClearDate = `${clearMonth.getFullYear()}-${String(clearMonth.getMonth() + 1).padStart(2, '0')}-01`

  // 更新 settings 中的下次清空日期
  try {
    await db.collection('settings').doc('nextClearDate').set({
      data: {
        nextClearDate: nextClearDate,
        updatedAt: now
      }
    })
  } catch (e) {
    console.error('更新清空日期失败', e)
  }

  return {
    success: true,
    message: `已清空 ${deletedCount} 场比赛，重置 ${resetCount} 位辩手积分`,
    nextClearDate: nextClearDate
  }
}
