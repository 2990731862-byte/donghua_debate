const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 积分算法（与 miniprogram/utils/scoring.js 保持一致）
 */
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

    if (isRecordBreakingRound) currentMaxRound = roundNum
    if (isBestDebater && !hadBestDebater) hadBestDebater = true
    if (isTopThree && !hadTopThree) hadTopThree = true

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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { matchData } = event

  // 验证管理员权限
  const adminResult = await db.collection('admins')
    .where({ openid: OPENID })
    .get()
  if (adminResult.data.length === 0) {
    return { success: false, message: '无权限' }
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

  // 为每个参赛者计算积分
  const processedParticipants = []

  for (const p of participants) {
    // 获取辩手当前个人纪录
    const debaterResult = await db.collection('debaters').doc(p.debaterId).get()
    const debater = debaterResult.data
    const personalRecords = (debater.personalRecords || {})[level] || {
      maxRound: 0,
      bestDebater: false,
      topThree: false
    }

    // 计算积分
    const scoreResult = calculateParticipantScore(p, W, personalRecords)

    processedParticipants.push({
      debaterId: p.debaterId,
      debaterName: debater.name,
      roundsParticipated: p.roundsParticipated,
      bestDebaterRounds: p.bestDebaterRounds || [],
      topThreeFinish: p.topThreeFinish || false,
      scoreBreakdown: {
        roundDetails: scoreResult.roundDetails,
        matchTotal: scoreResult.matchTotal
      }
    })

    // 更新辩手的个人纪录和总积分
    const newTotalScore = (debater.totalScore || 0) + scoreResult.matchTotal
    const newMatchCount = (debater.matchCount || 0) + 1

    const updatedRecords = { ...debater.personalRecords }
    updatedRecords[level] = scoreResult.updatedRecords

    await db.collection('debaters').doc(p.debaterId).update({
      data: {
        totalScore: newTotalScore,
        matchCount: newMatchCount,
        personalRecords: updatedRecords,
        updatedAt: new Date()
      }
    })
  }

  // 保存比赛记录
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

  // 更新排名
  await updateRankings()

  return { success: true, matchId: matchResult._id }
}

/**
 * 更新所有辩手的排名
 */
async function updateRankings() {
  const allDebaters = await db.collection('debaters')
    .orderBy('totalScore', 'desc')
    .limit(100)
    .get()

  for (let i = 0; i < allDebaters.data.length; i++) {
    await db.collection('debaters').doc(allDebaters.data[i]._id).update({
      data: { rank: i + 1 }
    })
  }
}
