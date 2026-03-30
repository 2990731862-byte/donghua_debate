Page({
  data: {
    debater: {},
    matches: [],
    recordsList: [],
    personalRecordsSummary: {
      maxRound: 0,
      bestDebaterCount: 0
    },
    loading: true
  },

  onLoad(options) {
    if (options.id) {
      this.loadDebaterDetail(options.id)
    }
  },

  loadDebaterDetail(debaterId) {
    wx.cloud.callFunction({
      name: 'getDebaterDetail',
      data: { debaterId }
    }).then(res => {
      const { debater, matches } = res.result

      // 处理个人纪录列表
      const recordsList = []
      const records = debater.personalRecords || {}
      let totalMaxRound = 0
      let bestDebaterCount = 0

      for (const level of ['院赛', '校赛', '市赛']) {
        const record = records[level]
        if (record && record.maxRound > 0) {
          recordsList.push({
            level,
            maxRound: record.maxRound,
            bestDebater: record.bestDebater,
            topThree: record.topThree
          })
          if (record.maxRound > totalMaxRound) {
            totalMaxRound = record.maxRound
          }
          if (record.bestDebater) bestDebaterCount++
        }
      }

      // 为每场比赛标注该辩手的得分和状态
      const processedMatches = matches.map(match => {
        const participant = (match.participants || []).find(
          p => p.debaterId === debaterId
        )
        const round = match.totalRounds
        return {
          ...match,
          participantScore: participant ? participant.scoreBreakdown.matchTotal : null,
          scoreBreakdown: participant ? participant.scoreBreakdown : null,
          isBestDebater: participant ? (participant.bestDebaterRounds || []).includes(round) : false,
          isTopThree: participant ? (participant.topThreeFinish || false) : false
        }
      })

      this.setData({
        debater,
        matches: processedMatches,
        recordsList,
        personalRecordsSummary: {
          maxRound: totalMaxRound,
          bestDebaterCount
        },
        loading: false
      })

      wx.setNavigationBarTitle({ title: debater.name })
    }).catch(err => {
      console.error('加载辩手详情失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  }
})
