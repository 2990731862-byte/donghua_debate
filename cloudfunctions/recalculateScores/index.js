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

    let baseReward = 0.5 * W * roundNum
    if (isBestDebater) baseReward += 0.5 * W
    if (isTopThree) baseReward += W

    let recordBonus = 0
    const isRecordBreakingRound = roundNum > currentMaxRound
    const isRecordBreakingBestDebater = isBestDebater && !hadBestDebater
    const isRecordBreakingTopThree = isTopThree && !hadTopThree

    if (isRecordBreakingRound) {
      recordBonus += 0.5 * Math.log2(W) + 0.5 * Math.floor(0.5 * roundNum)
    }
    if (isBestDebater && isRecordBreakingBestDebater) recordBonus += 0.5 * W
    if (isTopThree && isRecordBreakingTopThree) recordBonus += 0.5 * W

    if (roundNum > currentMaxRound) currentMaxRound = roundNum
    if (isBestDebater) hadBestDebater = true
    if (isTopThree) hadTopThree = true

    totalScore += baseReward + recordBonus
    roundDetails.push({
      round: roundNum, baseReward, recordBonus, roundScore: baseReward + recordBonus,
      isBestDebater, isTopThree,
      isRecordBreakingRound, isRecordBreakingBestDebater, isRecordBreakingTopThree
    })
  }

  return {
    roundDetails,
    matchTotal: floorToHalf(totalScore),
    updatedRecords: {
      maxRound: Math.max(personalRecords.maxRound || 0, maxRound),
      bestDebater: hadBestDebater,
      topThree: hadTopThree
    }
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()

  // 验证权限：内部调用（云函数间调用，OPENID 为空）跳过验证
  const WX_CONTEXT = cloud.getWXContext()
  const isInternalCall = !WX_CONTEXT.FROM_OPENID || WX_CONTEXT.FROM_OPENID === ''
  if (!isInternalCall) {
    const _ = db.command
    const now = new Date()
    const adminResult = await db.collection('admins')
      .where(_.or([
        { openid: OPENID, role: 'super_admin' },
        { openid: OPENID, expiresAt: _.gt(now) }
      ]))
      .get()
    if (adminResult.data.length === 0) {
      return { success: false, message: '无权限或权限已过期' }
    }
  }

  // 获取所有辩手，重置积分（游标分页，防超100）
  const _ = db.command
  const debaterMap = {}
  let lastDebaterId = null
  let hasMoreDebaters = true
  while (hasMoreDebaters) {
    let condition = {}
    if (lastDebaterId) condition._id = _.gt(lastDebaterId)
    const batch = await db.collection('debaters')
      .where(condition)
      .limit(100)
      .orderBy('_id', 'asc')
      .get()
    if (batch.data.length === 0) {
      hasMoreDebaters = false
      break
    }
    for (const d of batch.data) {
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
    lastDebaterId = batch.data[batch.data.length - 1]._id
    if (batch.data.length < 100) hasMoreDebaters = false
  }

  // 按日期顺序获取所有比赛（同日期按创建时间排序，游标分页）
  // 注意：用 date+createdAt 复合排序，用 _id 游标分页（_id 本身按时间递增）
  const allMatches = []
  let lastMatchId = null
  let hasMoreMatches = true
  while (hasMoreMatches) {
    let condition = {}
    if (lastMatchId) condition._id = _.gt(lastMatchId)
    const batch = await db.collection('matches')
      .where(condition)
      .orderBy('_id', 'asc')
      .limit(100)
      .get()
    if (batch.data.length === 0) {
      hasMoreMatches = false
      break
    }
    allMatches.push(...batch.data)
    lastMatchId = batch.data[batch.data.length - 1]._id
    if (batch.data.length < 100) hasMoreMatches = false
  }
  // 按 date + createdAt 排序（确保破纪录机制按时间顺序计算）
  allMatches.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    const ta = new Date(a.createdAt).getTime() || 0
    const tb = new Date(b.createdAt).getTime() || 0
    return ta - tb
  })

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

  // 更新所有辩手的积分和排名
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

  return {
    success: true,
    message: `重算完成，处理了 ${allMatches.length} 场比赛，${sortedIds.length} 位辩手`
  }
}
