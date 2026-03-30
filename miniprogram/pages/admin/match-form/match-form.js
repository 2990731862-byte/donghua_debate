const { adminGuard } = require('../../../utils/auth')
const { LEVEL_WEIGHTS } = require('../../../utils/scoring')

Page({
  data: {
    step: 1,

    // 步骤1数据
    matchName: '',
    matchLevel: '院赛',
    matchWeight: 1,
    matchDate: '',
    matchRound: 1,

    // 步骤2数据
    allDebaters: [],
    selectedCount: 0,

    // 步骤3数据
    participants: [],

    // 提交状态
    submitting: false
  },

  onLoad() {
    adminGuard().then(allowed => {
      if (allowed) {
        // 设置默认日期为今天
        const today = new Date()
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        this.setData({ matchDate: dateStr })
        this.loadDebaters()
      }
    })
  },

  loadDebaters() {
    wx.cloud.callFunction({
      name: 'manageDebater',
      data: { action: 'list' }
    }).then(res => {
      if (res.result.success) {
        const debaters = res.result.data.map(d => ({ ...d, selected: false }))
        this.setData({ allDebaters: debaters })
      }
    })
  },

  // 步骤1输入
  onMatchNameInput(e) { this.setData({ matchName: e.detail.value }) },
  onLevelChange(e) {
    const level = e.currentTarget.dataset.level
    this.setData({
      matchLevel: level,
      matchWeight: LEVEL_WEIGHTS[level]
    })
  },
  onDateChange(e) { this.setData({ matchDate: e.detail.value }) },
  onRoundChange(e) {
    const round = e.currentTarget.dataset.round
    this.setData({ matchRound: round })
  },

  // 步骤2选人
  toggleDebater(e) {
    const index = e.currentTarget.dataset.index
    const key = `allDebaters[${index}].selected`
    const newVal = !this.data.allDebaters[index].selected
    this.setData({
      [key]: newVal,
      selectedCount: this.data.allDebaters.filter((d, i) =>
        i === index ? newVal : d.selected
      ).length
    })
  },

  // 步骤3操作
  toggleBestDebater(e) {
    const pindex = e.currentTarget.dataset.pindex
    this.setData({
      [`participants[${pindex}].isBestDebater`]: !this.data.participants[pindex].isBestDebater
    })
  },

  toggleTopThree(e) {
    const pindex = e.currentTarget.dataset.pindex
    this.setData({
      [`participants[${pindex}].topThreeFinish`]: !this.data.participants[pindex].topThreeFinish
    })
  },

  // 步骤导航
  nextStep() {
    const { step } = this.data

    // 验证
    if (step === 1) {
      if (!this.data.matchName.trim()) {
        wx.showToast({ title: '请输入比赛名称', icon: 'none' }); return
      }
      if (!this.data.matchDate) {
        wx.showToast({ title: '请选择比赛日期', icon: 'none' }); return
      }
    }

    if (step === 2) {
      const selected = this.data.allDebaters.filter(d => d.selected)
      if (selected.length === 0) {
        wx.showToast({ title: '请至少选择一位辩手', icon: 'none' }); return
      }
      const participants = selected.map(d => ({
        debaterId: d._id,
        debaterName: d.name,
        isBestDebater: false,
        topThreeFinish: false
      }))
      this.setData({ participants })
    }

    this.setData({ step: step + 1 })
  },

  prevStep() {
    this.setData({ step: this.data.step - 1 })
  },

  submitMatch() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })

    const round = this.data.matchRound
    const matchData = {
      name: this.data.matchName.trim(),
      level: this.data.matchLevel,
      date: this.data.matchDate,
      totalRounds: round,
      participants: this.data.participants.map(p => ({
        debaterId: p.debaterId,
        roundsParticipated: [round],
        bestDebaterRounds: p.isBestDebater ? [round] : [],
        topThreeFinish: p.topThreeFinish
      }))
    }

    wx.cloud.callFunction({
      name: 'submitMatch',
      data: { matchData }
    }).then(res => {
      wx.hideLoading()
      this.setData({ submitting: false })

      if (res.result.success) {
        wx.showToast({ title: '录入成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ title: res.result.message || '录入失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ submitting: false })
      console.error('提交失败', err)
      wx.showToast({ title: '提交失败', icon: 'none' })
    })
  }
})
