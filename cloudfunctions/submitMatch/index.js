const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const LEVEL_WEIGHTS = { '院赛': 1, '校赛': 2, '市赛': 4 }

function floorToHalf(value) {
  return Math.floor(value * 2) / 2
}

/**
 * 破纪录机制（按时间顺序、按级别独立计算）：
 * - 轮次破纪录：同级别赛事中，首次达到某轮次
 * - 佳辩破纪录：同级别赛事中，首次获得佳辩（不限轮次）
 * - 前三破纪录：同级别赛事中，首次获得前三
 */
function calculateParticipantScore(participant, W, personalRecords) {
  const { roundsParticipated, bestDebaterRounds, topThreeFinish } = participant
  const rounds = [...roundsParticipated].sort((a, b) => a - b)
  const maxRound = Math.max(...rounds)

  let currentMaxRound = personalRecords.maxRound || 0
  let hadBestDebater = personalRecords.bestDebater || false
  let hadTopThree = personalRecords.topThree || false

  const roundDetails = []
  let totalScore = 0

  for (const roundNum of rounds) {
    const isBestDebater = bestDebaterRounds.includes(roundNum)
    const isTopThree = topThreeFinish && roundNum === maxRound

    // 基础奖励
    let baseReward = 0.5 * W * roundNum
    if (isBestDebater) baseReward += 0.5 * W
    if (isTopThree) baseReward += W

    // 破纪录奖励
    let recordBonus = 0
    const isRecordBreakingRound = roundNum > currentMaxRound
    const isRecordBreakingBestDebater = isBestDebater && !hadBestDebater
    const isRecordBreakingTopThree = isTopThree && !hadTopThree

    if (isRecordBreakingRound) {
      recordBonus += 0.5 * Math.log2(W) + 0.5 * Math.floor(0.5 * roundNum)
    }
    if (isBestDebater && isRecordBreakingBestDebater) {
      recordBonus += 0.5 * W
    }
    if (isTopThree && isRecordBreakingTopThree) {
      recordBonus += 0.5 * W
    }

    // 更新个人纪录（无论是否破纪录，只要达到了新高度就更新）
    if (roundNum > currentMaxRound) currentMaxRound = roundNum
    if (isBestDebater) hadBestDebater = true
    if (isTopThree) hadTopThree = true

    const roundScore = baseReward + recordBonus
    totalScore += roundScore

    roundDetails.push({
      round: roundNum,
      baseReward,
      recordBonus,
      roundScore,
      isBestDebater,
      isTopThree,
      isRecordBreakingRound,
      isRecordBreakingBestDebater,
      isRecordBreakingTopThree
    })
  }

  return {
    roundDetails,
    rawTotal: totalScore,
    matchTotal: floorToHalf(totalScore),
    updatedRecords: {
      maxRound: Math.max(personalRecords.maxRound || 0, maxRound),
      bestDebater: hadBestDebater,
      topThree: hadTopThree
    }
  }
}

/**
 * 全局重算积分（按比赛日期顺序）
 */
async function recalculateAll() {
  // 获取所有辩手，重置积分
  const allDebaters = await db.collection('debaters').limit(100).get()
  const debaterMap = {}

  for (const d of allDebaters.data) {
    debaterMap[d._id] = {
      totalScore: 0,
      matchCount: 0,
      personalRecords: {
        '院赛': { maxRound: 0, bestDebater: false, topThree: false },
        '校赛': { maxRound: 0, bestDebater: false, topThree: false },
        '市赛': { maxRound: 0, bestDebater: false, topThree: false }
      }
    }
  }

  // 按日期顺序获取所有比赛
  const { data: allMatches } = await db.collection('matches')
    .orderBy('date', 'asc')
    .orderBy('createdAt', 'asc')
    .limit(100)
    .get()

  // 逐场比赛重算
  for (const match of allMatches) {
    const W = LEVEL_WEIGHTS[match.level] || 1
    const updatedParticipants = []

    for (const p of match.participants) {
      const debaterState = debaterMap[p.debaterId]
      if (!debaterState) continue

      const personalRecords = debaterState.personalRecords[match.level]
      const scoreResult = calculateParticipantScore(p, W, personalRecords)

      debaterState.totalScore += scoreResult.matchTotal
      debaterState.matchCount += 1
      debaterState.personalRecords[match.level] = scoreResult.updatedRecords

      updatedParticipants.push({
        ...p,
        scoreBreakdown: {
          roundDetails: scoreResult.roundDetails,
          matchTotal: scoreResult.matchTotal
        }
      })
    }

    // 更新比赛记录中的积分明细
    await db.collection('matches').doc(match._id).update({
      data: { participants: updatedParticipants }
    })
  }

  // 按积分排序，更新排名
  const sortedIds = Object.keys(debaterMap).sort(
    (a, b) => debaterMap[b].totalScore - debaterMap[a].totalScore
  )

  for (let i = 0; i < sortedIds.length; i++) {
    const id = sortedIds[i]
    const state = debaterMap[id]
    await db.collection('debaters').doc(id).update({
      data: {
        totalScore: state.totalScore,
        matchCount: state.matchCount,
        personalRecords: state.personalRecords,
        rank: i + 1,
        updatedAt: new Date()
      }
    })
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { matchData } = event

  // 验证管理员权限
  const _ = db.command
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

  const { name, level, stage, date, totalRounds, participants } = matchData

  // 参数验证
  if (!name || !level || !date || !participants || participants.length === 0) {
    return { success: false, message: '比赛信息不完整' }
  }

  const W = LEVEL_WEIGHTS[level]
  if (!W) {
    return { success: false, message: '无效的赛事级别' }
  }

  // 查找是否已存在相同比赛（同名、同日、同级别、同赛程、同轮次）
  const existingMatchResult = await db.collection('matches')
    .where({
      name,
      level,
      stage: stage || '',
      date,
      totalRounds: totalRounds || 0
    })
    .get()

  // 为每个参赛者准备数据（不在这里计算积分，交给全局重算）
  const processedParticipants = []

  for (const p of participants) {
    if (!p.debaterId) {
      return { success: false, message: '参赛者信息缺少辩手ID' }
    }

    // 跳过已在该场比赛中的辩手
    if (existingMatchResult.data.length > 0) {
      const existingMatch = existingMatchResult.data[0]
      if ((existingMatch.participants || []).some(ep => ep.debaterId === p.debaterId)) {
        return { success: false, message: `辩手「${p.debaterName || p.debaterId}」已在该轮比赛中` }
      }
    }

    // 获取辩手信息
    let debater
    try {
      const debaterResult = await db.collection('debaters').doc(p.debaterId).get()
      debater = debaterResult.data
    } catch (e) {
      return { success: false, message: `辩手不存在：${p.debaterId}` }
    }

    processedParticipants.push({
      debaterId: p.debaterId,
      debaterName: debater.name,
      studentId: debater.studentId || '',
      roundsParticipated: p.roundsParticipated,
      bestDebaterRounds: p.bestDebaterRounds || [],
      topThreeFinish: p.topThreeFinish || false
    })
  }

  if (existingMatchResult.data.length > 0) {
    // 合并到已有比赛记录
    const existingMatch = existingMatchResult.data[0]
    const mergedParticipants = [...(existingMatch.participants || []), ...processedParticipants]

    await db.collection('matches').doc(existingMatch._id).update({
      data: {
        participants: mergedParticipants,
        updatedAt: new Date()
      }
    })

    // 全局重算积分
    await recalculateAll()

    return { success: true, matchId: existingMatch._id, merged: true }
  }

  // 保存新比赛记录
  const matchResult = await db.collection('matches').add({
    data: {
      name,
      level,
      stage: stage || '',
      weight: W,
      date,
      totalRounds: totalRounds || 0,
      participants: processedParticipants,
      submittedBy: OPENID,
      createdAt: new Date()
    }
  })

  // 全局重算积分（确保破纪录计算正确）
  await recalculateAll()

  return { success: true, matchId: matchResult._id }
}
