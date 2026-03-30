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
    const app = getApp()
    // 有缓存就直接用，不等 adminGuard
    if (app.globalData.openid && app.globalData.isAdmin) {
      this.setData({ authorized: true })
      this.loadRole()
      this.loadStats()
    } else {
      adminGuard().then(allowed => {
        if (allowed) {
          this.setData({ authorized: true })
          this.loadRole()
          this.loadStats()
        }
      })
    }
  },

  onShow() {
    if (this.data.authorized) {
      this.loadStats()
    }
  },

  loadRole() {
    checkAdminStatus().then(result => {
      this.setData({ role: result.role })
    })
  },

  loadStats() {
    wx.cloud.callFunction({
      name: 'manageDebater',
      data: { action: 'count' }
    }).then(res => {
      if (res.result.success) {
        this.setData({ 'stats.debaterCount': res.result.count })
      }
    })

    wx.cloud.callFunction({
      name: 'manageMatch',
      data: { action: 'count' }
    }).then(res => {
      if (res.result.success) {
        this.setData({ 'stats.matchCount': res.result.count })
      }
    })
  },

  goMatchForm() {
    wx.navigateTo({ url: '/pages/admin/match-form/match-form' })
  },

  goMatchManage() {
    wx.navigateTo({ url: '/pages/admin/match-manage/match-manage' })
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
