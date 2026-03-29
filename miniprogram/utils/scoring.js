/**
 * 东华大学辩论协会 - 辩手积分算法
 *
 * 基于《东华大学辩论协会关于试行辩手积分榜制度的通知》
 *
 * 积分公式：
 *   轮次积分 = 基础奖励 + 破纪录奖励
 *   基础奖励 = 轮次基础分(0.5×W×轮次号) + 佳辩分(0.5×W) + 前三分(W)
 *   破纪录奖励 = 破纪录轮次分(0.5×log2(W) + 0.5×⌊0.5×轮次号⌋)
 *              + 破纪录佳辩分(0.5×W) + 破纪录前三分(0.5×W)
 *   比赛全局积分 = Σ各轮次积分 → 向下取0.5的倍数
 */

/**
 * 赛事级别对应的权重
 */
const LEVEL_WEIGHTS = {
  '院赛': 1,
  '校赛': 2,
  '市赛': 4
}

/**
 * 向下取0.5的倍数
 * @param {number} value
 * @returns {number}
 */
function floorToHalf(value) {
  return Math.floor(value * 2) / 2
}

/**
 * 计算单个轮次的基础奖励
 * @param {number} roundNumber - 轮次号（从1开始）
 * @param {number} W - 赛事权重
 * @param {boolean} isBestDebater - 该轮次是否获得最佳辩手
 * @param {boolean} isTopThree - 是否获得前三名（仅在最后一轮计算）
 * @returns {number} 基础奖励分
 */
function calcBaseReward(roundNumber, W, isBestDebater, isTopThree) {
  // 轮次基础分 = 0.5 × W × 轮次号
  let score = 0.5 * W * roundNumber

  // 最佳辩手得分 = 0.5 × W
  if (isBestDebater) {
    score += 0.5 * W
  }

  // 前三名得分 = W（仅比赛最终名次，只计算一次）
  if (isTopThree) {
    score += W
  }

  return score
}

/**
 * 计算单个轮次的破纪录奖励
 * @param {number} roundNumber - 轮次号
 * @param {number} W - 赛事权重
 * @param {boolean} isBestDebater - 该轮次是否获得最佳辩手
 * @param {boolean} isTopThree - 是否获得前三名
 * @param {boolean} isRecordBreakingRound - 该轮次是否破了轮次纪录
 * @param {boolean} isRecordBreakingBestDebater - 是否破了佳辩纪录
 * @param {boolean} isRecordBreakingTopThree - 是否破了前三名纪录
 * @returns {number} 破纪录奖励分
 */
function calcRecordBonus(roundNumber, W, isBestDebater, isTopThree, isRecordBreakingRound, isRecordBreakingBestDebater, isRecordBreakingTopThree) {
  let bonus = 0

  // 破纪录轮次分 = 0.5 × log2(W) + 0.5 × ⌊0.5 × 轮次号⌋
  if (isRecordBreakingRound) {
    bonus += 0.5 * Math.log2(W) + 0.5 * Math.floor(0.5 * roundNumber)
  }

  // 破纪录最佳辩手分 = 0.5 × W
  if (isBestDebater && isRecordBreakingBestDebater) {
    bonus += 0.5 * W
  }

  // 破纪录前三名分 = 0.5 × W
  if (isTopThree && isRecordBreakingTopThree) {
    bonus += 0.5 * W
  }

  return bonus
}

/**
 * 计算一个辩手在一场比赛中的完整积分
 *
 * @param {Object} participant - 参赛者信息
 * @param {number[]} participant.roundsParticipated - 参加的轮次号数组，如 [1, 2, 3]
 * @param {number[]} participant.bestDebaterRounds - 获得最佳辩手的轮次号数组，如 [2]
 * @param {boolean} participant.topThreeFinish - 是否获得比赛前三名
 * @param {number} W - 赛事权重
 * @param {Object} personalRecords - 个人历史纪录
 * @param {number} personalRecords.maxRound - 该级别赛事的历史最高轮次
 * @param {boolean} personalRecords.bestDebater - 是否在该级别获得过佳辩
 * @param {boolean} personalRecords.topThree - 是否在该级别获得过前三
 * @returns {Object} 积分明细
 */
function calculateParticipantScore(participant, W, personalRecords) {
  const { roundsParticipated, bestDebaterRounds, topThreeFinish } = participant
  const rounds = [...roundsParticipated].sort((a, b) => a - b)
  const maxRound = Math.max(...rounds)

  // 复制个人纪录用于追踪本场比赛中的纪录变化
  let currentMaxRound = personalRecords.maxRound || 0
  let hadBestDebater = personalRecords.bestDebater || false
  let hadTopThree = personalRecords.topThree || false

  const roundDetails = []
  let totalScore = 0

  for (const roundNum of rounds) {
    const isBestDebater = bestDebaterRounds.includes(roundNum)
    // 前三名只在最高轮次计算一次
    const isTopThree = topThreeFinish && roundNum === maxRound

    // 基础奖励
    const baseReward = calcBaseReward(roundNum, W, isBestDebater, isTopThree)

    // 判断是否破纪录
    const isRecordBreakingRound = roundNum > currentMaxRound
    const isRecordBreakingBestDebater = isBestDebater && !hadBestDebater
    const isRecordBreakingTopThree = isTopThree && !hadTopThree

    // 破纪录奖励
    const recordBonus = calcRecordBonus(
      roundNum, W,
      isBestDebater, isTopThree,
      isRecordBreakingRound,
      isRecordBreakingBestDebater,
      isRecordBreakingTopThree
    )

    // 更新个人纪录（本场比赛内同步刷新）
    if (isRecordBreakingRound) {
      currentMaxRound = roundNum
    }
    if (isBestDebater && !hadBestDebater) {
      hadBestDebater = true
    }
    if (isTopThree && !hadTopThree) {
      hadTopThree = true
    }

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

  // 向下取0.5的倍数
  const matchTotal = floorToHalf(totalScore)

  return {
    roundDetails,
    rawTotal: totalScore,
    matchTotal,
    updatedRecords: {
      maxRound: Math.max(personalRecords.maxRound || 0, maxRound),
      bestDebater: hadBestDebater,
      topThree: hadTopThree
    }
  }
}

/**
 * 获取赛事级别对应的权重
 * @param {string} level - 赛事级别：'院赛' | '校赛' | '市赛'
 * @returns {number} 权重W
 */
function getLevelWeight(level) {
  return LEVEL_WEIGHTS[level] || 1
}

module.exports = {
  LEVEL_WEIGHTS,
  floorToHalf,
  calcBaseReward,
  calcRecordBonus,
  calculateParticipantScore,
  getLevelWeight
}
