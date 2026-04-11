const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const isInternalCall = event && event.internal === true

  if (!isInternalCall) {
    const now = new Date()
    const adminResult = await db.collection('admins')
      .where(_.or([
        { openid: OPENID, role: 'super_admin' },
        { openid: OPENID, expiresAt: _.gt(now) },
        { openid: OPENID, expiresAt: _.exists(false) }
      ]))
      .get()
    if (adminResult.data.length === 0) {
      return { success: false, message: '无权限', executed: false }
    }
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  if (currentMonth < 7) {
    return { success: true, executed: false }
  }

  const targetGrades = [
    String(currentYear - 4),
    String(currentYear - 7)
  ]

  const settingDoc = await db.collection('settings').doc('lastGraduateCleanup').get().catch(() => null)
  const clearedKeys = (settingDoc && settingDoc.data) ? settingDoc.data.clearedGrades || [] : []

  const needClean = targetGrades.filter(g => {
    return !clearedKeys.includes(`${g}@${currentYear}`)
  })

  if (needClean.length === 0) {
    return { success: true, executed: false }
  }

  // 收集所有需要删除的辩手ID（分页游标，防超100）
  const allDebaterIds = []
  for (const grade of needClean) {
    let lastId = null
    let hasMore = true
    while (hasMore) {
      let condition = { grade }
      if (lastId) {
        condition._id = _.gt(lastId)
      }
      const res = await db.collection('debaters')
        .where(condition)
        .field({ _id: true })
        .limit(100)
        .orderBy('_id', 'asc')
        .get()
      if (res.data.length === 0) {
        hasMore = false
        break
      }
      res.data.forEach(d => allDebaterIds.push(d._id))
      lastId = res.data[res.data.length - 1]._id
      if (res.data.length < 100) hasMore = false
    }
  }

  if (allDebaterIds.length === 0) {
    for (const grade of needClean) {
      clearedKeys.push(`${grade}@${currentYear}`)
    }
    await db.collection('settings').doc('lastGraduateCleanup').set({
      data: { clearedGrades: clearedKeys, updatedAt: now }
    })
    return { success: true, executed: false, message: '无需要清除的辩手' }
  }

  // 优化：一次性查出所有关联的比赛，然后批量处理
  let totalMatchesCleaned = 0
  let totalMatchesRemoved = 0

  // 用 or 查询：participants.debaterId in allDebaterIds（分批查询防超限）
  const allMatchIds = new Set()
  const allMatchDataMap = {}
  for (let i = 0; i < allDebaterIds.length; i += 20) {
    const batchIds = allDebaterIds.slice(i, i + 20)
    const orConditions = batchIds.map(id => ({ 'participants.debaterId': id }))
    let lastMatchId = null
    let hasMoreMatches = true
    while (hasMoreMatches) {
      let cond
      if (lastMatchId) {
        cond = _.and(_.or(orConditions), { _id: _.gt(lastMatchId) })
      } else {
        cond = _.or(orConditions)
      }
      const matchResult = await db.collection('matches')
        .where(cond)
        .limit(100)
        .orderBy('_id', 'asc')
        .get()
      if (matchResult.data.length === 0) {
        hasMoreMatches = false
        break
      }
      for (const match of matchResult.data) {
        allMatchIds.add(match._id)
        allMatchDataMap[match._id] = match
      }
      lastMatchId = matchResult.data[matchResult.data.length - 1]._id
      if (matchResult.data.length < 100) hasMoreMatches = false
    }
  }

  for (const matchId of allMatchIds) {
    const match = allMatchDataMap[matchId]
    const newP = match.participants.filter(p => !allDebaterIds.includes(p.debaterId))
    if (newP.length === 0) {
      await db.collection('matches').doc(match._id).remove()
      totalMatchesRemoved++
    } else {
      await db.collection('matches').doc(match._id).update({
        data: { participants: newP }
      })
      totalMatchesCleaned++
    }
  }

  // 批量删除辩手
  for (const id of allDebaterIds) {
    await db.collection('debaters').doc(id).remove()
  }

  // 记录已清除
  for (const grade of needClean) {
    clearedKeys.push(`${grade}@${currentYear}`)
  }
  await db.collection('settings').doc('lastGraduateCleanup').set({
    data: { clearedGrades: clearedKeys, updatedAt: now }
  })

  // 重算积分
  try {
    await cloud.callFunction({
      name: 'recalculateScores',
      data: { internal: true }
    })
  } catch (e) {
    console.error('自动重算失败', e)
  }

  return {
    success: true,
    executed: true,
    cleanedGrades: needClean,
    message: `已自动清除 ${needClean.join('级、')}级 共 ${allDebaterIds.length} 位辩手`
  }
}
