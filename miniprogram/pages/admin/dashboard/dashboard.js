const { adminGuard, checkAdminStatus } = require('../../../utils/auth')

Page({
  data: {
    authorized: false,
    role: '',
    stats: {
      debaterCount: 0,
      matchCount: 0
    }
  },

  onLoad() {
    adminGuard().then(allowed => {
      if (allowed) {
        this.setData({ authorized: true })
        this.loadRole()
        this.loadStats()
      }
    })
  },

  loadRole() {
    checkAdminStatus().then(result => {
      this.setData({ role: result.role })
    })
  },

  loadStats() {
    // 获取辩手数量
    wx.cloud.callFunction({
      name: 'manageDebater',
      data: { action: 'list' }
    }).then(res => {
      if (res.result.success) {
        this.setData({ 'stats.debaterCount': res.result.data.length })
      }
    })

    // 简单获取比赛数量（通过leaderboard间接获取，或直接查数据库）
    wx.cloud.callFunction({
      name: 'getLeaderboard',
      data: { offset: 0, limit: 1 }
    }).then(res => {
      // 使用辩手数据中的matchCount来估算
    })
  },

  goMatchForm() {
    wx.navigateTo({ url: '/pages/admin/match-form/match-form' })
  },

  goDebaterManage() {
    wx.navigateTo({ url: '/pages/admin/debater-manage/debater-manage' })
  },

  goInvite() {
    wx.navigateTo({ url: '/pages/admin/invite/invite' })
  },

  recalculate() {
    wx.showModal({
      title: '确认重算',
      content: '将根据所有比赛记录重新计算全部辩手积分，确定继续？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '重算中...' })
          wx.cloud.callFunction({
            name: 'recalculateScores'
          }).then(res => {
            wx.hideLoading()
            wx.showToast({
              title: res.result.message || '重算完成',
              icon: 'success',
              duration: 3000
            })
          }).catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '重算失败', icon: 'none' })
          })
        }
      }
    })
  }
})
