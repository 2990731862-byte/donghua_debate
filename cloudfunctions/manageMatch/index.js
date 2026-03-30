const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action, data } = event

  // 验证管理员权限
  const adminResult = await db.collection('admins')
    .where({ openid: OPENID })
    .get()
  if (adminResult.data.length === 0) {
    return { success: false, message: '无权限' }
  }

  if (action === 'list') {
    const allMatches = await db.collection('matches')
      .orderBy('date', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()

    return { success: true, data: allMatches.data }
  }

  if (action === 'delete') {
    const { matchId } = data
    if (!matchId) return { success: false, message: '缺少比赛ID' }

    // 获取比赛记录
    const matchResult = await db.collection('matches').doc(matchId).get()
    const match = matchResult.data

    // 扣除参赛者的积分
    for (const p of match.participants) {
      const debaterResult = await db.collection('debaters').doc(p.debaterId).get()
      const debater = debaterResult.data
      const scoreToDeduct = p.scoreBreakdown ? p.scoreBreakdown.matchTotal : 0
      const newTotalScore = Math.max(0, (debater.totalScore || 0) - scoreToDeduct)
      const newMatchCount = Math.max(0, (debater.matchCount || 0) - 1)

      await db.collection('debaters').doc(p.debaterId).update({
        data: {
          totalScore: newTotalScore,
          matchCount: newMatchCount
        }
      })
    }

    // 删除比赛记录
    await db.collection('matches').doc(matchId).remove()

    // 更新排名
    const allDebaters = await db.collection('debaters')
      .orderBy('totalScore', 'desc')
      .limit(100)
      .get()
    for (let i = 0; i < allDebaters.data.length; i++) {
      await db.collection('debaters').doc(allDebaters.data[i]._id).update({
        data: { rank: i + 1 }
      })
    }

    return { success: true, message: '已删除' }
  }

  if (action === 'count') {
    const countResult = await db.collection('matches').count()
    return { success: true, count: countResult.total }
  }

  if (action === 'deleteParticipant') {
    const { matchId, debaterId } = data
    if (!matchId || !debaterId) return { success: false, message: '缺少参数' }

    const matchResult = await db.collection('matches').doc(matchId).get()
    const match = matchResult.data

    const pIndex = match.participants.findIndex(p => p.debaterId === debaterId)
    if (pIndex === -1) return { success: false, message: '未找到该参赛者' }

    const participant = match.participants[pIndex]

    try {
      const debaterResult = await db.collection('debaters').doc(debaterId).get()
      const debater = debaterResult.data
      const scoreToDeduct = participant.scoreBreakdown ? participant.scoreBreakdown.matchTotal : 0
      const newTotalScore = Math.max(0, (debater.totalScore || 0) - scoreToDeduct)
      const newMatchCount = Math.max(0, (debater.matchCount || 0) - 1)

      await db.collection('debaters').doc(debaterId).update({
        data: { totalScore: newTotalScore, matchCount: newMatchCount }
      })
    } catch (e) { }

    match.participants.splice(pIndex, 1)

    if (match.participants.length === 0) {
      await db.collection('matches').doc(matchId).remove()
    } else {
      await db.collection('matches').doc(matchId).update({
        data: { participants: match.participants }
      })
    }

    const allDebaters = await db.collection('debaters')
      .orderBy('totalScore', 'desc')
      .limit(100)
      .get()
    for (let i = 0; i < allDebaters.data.length; i++) {
      await db.collection('debaters').doc(allDebaters.data[i]._id).update({
        data: { rank: i + 1 }
      })
    }

    return { success: true, message: '已删除该参赛者记录' }
  }

  return { success: false, message: '未知操作' }
}
