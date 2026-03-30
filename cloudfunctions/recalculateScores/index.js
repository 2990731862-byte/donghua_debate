const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const LEVEL_WEIGHTS = { '院赛': 1, '校赛': 2, '市赛': 4 }

function floorToHalf(value) {
  return Math.floor(value * 2) / 2
}

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

    if (isRecordBreakingRound) currentMaxRound = roundNum
    if (isBestDebater && !hadBestDebater) hadBestDebater = true
    if (isTopThree && !hadTopThree) hadTopThree = true

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

  // 验证权限：内部调用（如 manageMatch 删除后自动触发）跳过验证
  if (!event.internal) {
    const adminResult = await db.collection('admins')
      .where({ openid: OPENID })
      .get()
    if (adminResult.data.length === 0) {
      return { success: false, message: '无权限' }
    }
  }

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
  const allMatches = await db.collection('matches')
    .orderBy('date', 'asc')
    .limit(100)
    .get()

  // 逐场比赛重算
  for (const match of allMatches.data) {
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
  // 先按积分排序
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
    message: `重算完成，处理了 ${allMatches.data.length} 场比赛，${sortedIds.length} 位辩手`
  }
}
