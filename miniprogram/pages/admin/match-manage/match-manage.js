const { adminGuard } = require('../../../utils/auth')

Page({
  data: {
    matches: [],
    loading: true,
    searchKeyword: '',
    activeTab: 'records',
    groupedMatches: [],
    detailRecords: [],
    sortMode: 'time',
    expandedGroups: {},
    expandedDetails: []
  },

  onLoad() {
    adminGuard().then(allowed => {
      if (allowed) this.loadMatches()
    })
  },

  onShow() {
    if (this.data.authorized) this.loadMatches()
  },

  loadMatches() {
    this.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'manageMatch',
      data: { action: 'list' }
    }).then(res => {
      if (res.result.success) {
        this.setData({
          matches: res.result.data,
          loading: false,
          authorized: true
        })
        this.applyFilter()
      }
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
    this.applyFilter()
  },

  doSearch() {
    this.applyFilter()
  },

  applyFilter() {
    const keyword = this.data.searchKeyword.trim().toLowerCase()
    const filtered = keyword
      ? this.data.matches.filter(m => m.name.toLowerCase().includes(keyword))
      : this.data.matches
    this.buildGroups(filtered)
    this.buildDetails(filtered)
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  switchSort(e) {
    this.setData({ sortMode: e.currentTarget.dataset.mode })
    this.applyFilter()
  },

  buildGroups(matchList) {
    const map = {}
    for (const m of matchList) {
      const matchWithFlags = {
        ...m,
        participants: (m.participants || []).map(p => ({
          ...p,
          _isBest: (p.bestDebaterRounds || []).includes(m.totalRounds)
        }))
      }
      if (!map[m.name]) {
        map[m.name] = { name: m.name, level: m.level, stage: m.stage || '', dates: [], matches: [] }
      }
      map[m.name].matches.push(matchWithFlags)
      if (m.date && !map[m.name].dates.includes(m.date)) {
        map[m.name].dates.push(m.date)
      }
    }
    const groups = Object.values(map).map(g => {
      g.count = g.matches.length
      g.dates.sort()
      g.rounds = [...new Set(g.matches.map(m => m.totalRounds))].sort((a, b) => a - b)
      return g
    })
    this.setData({ groupedMatches: groups })
  },

  toggleGroup(e) {
    const name = e.currentTarget.dataset.name
    const key = `expandedGroups.${name}`
    this.setData({ [key]: !this.data.expandedGroups[name] })
  },

  toggleDetail(e) {
    const idx = e.currentTarget.dataset.idx
    const key = `expandedDetails[${idx}]`
    this.setData({ [key]: !this.data.expandedDetails[idx] })
  },

  formatBreakdown(scoreBreakdown, weight) {
    if (!scoreBreakdown || !scoreBreakdown.roundDetails) return []
    const W = weight || 1
    return scoreBreakdown.roundDetails.map(function (rd) {
      var item = { round: rd.round, lines: [] }
      item.lines.push('基础分 +' + (0.5 * W * rd.round).toFixed(1))
      if (rd.isBestDebater) {
        item.lines.push('最佳辩手 +' + (0.5 * W).toFixed(1))
      }
      if (rd.isTopThree) {
        item.lines.push('前三名 +' + W.toFixed(1))
      }
      if (rd.recordBonus > 0) {
        var parts = []
        if (rd.isRecordBreakingRound) {
          var rbRound = 0.5 * Math.log2(Math.max(1, W)) + 0.5 * Math.floor(0.5 * rd.round)
          if (rbRound > 0) parts.push('轮次+' + rbRound.toFixed(1))
        }
        if (rd.isRecordBreakingBestDebater) {
          parts.push('佳辩+' + (0.5 * W).toFixed(1))
        }
        if (rd.isRecordBreakingTopThree) {
          parts.push('前三+' + (0.5 * W).toFixed(1))
        }
        if (parts.length > 0) {
          item.lines.push('破纪录奖励 ' + parts.join(' '))
        }
      }
      item.totalLine = '本轮合计 +' + rd.roundScore.toFixed(1)
      return item
    })
  },

  buildDetails(matchList) {
    const self = this
    const records = []
    for (const m of matchList) {
      for (const p of (m.participants || [])) {
        records.push({
          matchId: m._id,
          debaterId: p.debaterId,
          debaterName: p.debaterName,
          studentId: p.studentId || '',
          matchName: m.name,
          matchLevel: m.level,
          matchStage: m.stage || '',
          matchDate: m.date,
          round: m.totalRounds,
          weight: m.weight || 1,
          isBestDebater: (p.bestDebaterRounds || []).includes(m.totalRounds),
          isTopThree: p.topThreeFinish || false,
          score: (p.scoreBreakdown && p.scoreBreakdown.matchTotal) || 0,
          breakdownLines: self.formatBreakdown(p.scoreBreakdown, m.weight || 1)
        })
      }
    }

    const sorted = [...records]
    if (this.data.sortMode === 'time') {
      sorted.sort((a, b) => {
        if (a.matchDate !== b.matchDate) return b.matchDate.localeCompare(a.matchDate)
        return a.matchName.localeCompare(b.matchName)
      })
    } else {
      sorted.sort((a, b) => a.debaterName.localeCompare(b.debaterName, 'zh-CN'))
    }

    this.setData({ detailRecords: sorted })
  },

  deleteParticipant(e) {
    const { matchid, debaterid, debatername, matchname } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${debatername}」在「${matchname}」的这条记录？积分将被扣除。`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          wx.cloud.callFunction({
            name: 'manageMatch',
            data: { action: 'deleteParticipant', data: { matchId: matchid, debaterId: debaterid } }
          }).then(res => {
            wx.hideLoading()
            if (res.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadMatches()
            } else {
              wx.showToast({ title: res.result.message || '删除失败', icon: 'none' })
            }
          }).catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
          })
        }
      }
    })
  },

  deleteMatch(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${name}」该轮次的所有记录？相关辩手积分将被扣除。`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          wx.cloud.callFunction({
            name: 'manageMatch',
            data: { action: 'delete', data: { matchId: id } }
          }).then(res => {
            wx.hideLoading()
            if (res.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadMatches()
            } else {
              wx.showToast({ title: res.result.message || '删除失败', icon: 'none' })
            }
          }).catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
          })
        }
      }
    })
  }
})
