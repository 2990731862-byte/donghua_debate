const { adminGuard, checkAdminStatus } = require('../../../utils/auth')

Page({
  data: {
    authorized: false,
    role: '',
    stats: {
      debaterCount: 0,
      matchCount: 0
    },
    nextClearDate: '',
    isOverdue: false
  },

  onLoad() {
    const app = getApp()
    if (app.globalData.openid && app.globalData.isAdmin) {
      this.setData({ authorized: true })
      this.loadRole()
      this.loadStats()
      this.loadNextClearDate()
      this.autoGraduateCleanup()
    } else {
      adminGuard().then(allowed => {
        if (allowed) {
          this.setData({ authorized: true })
          this.loadRole()
          this.loadStats()
          this.loadNextClearDate()
          this.autoGraduateCleanup()
        }
      })
    }
  },

  onShow() {
    if (this.data.authorized) {
      this.loadStats()
      this.loadNextClearDate()
      this.autoGraduateCleanup()
    }
  },

  loadRole() {
    checkAdminStatus().then(result => {
      this.setData({ role: result.role })
    }).catch(err => {
      console.error('获取角色失败', err)
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
    }).catch(err => {
      console.error('获取辩手数量失败', err)
    })

    wx.cloud.callFunction({
      name: 'manageMatch',
      data: { action: 'count' }
    }).then(res => {
      if (res.result.success) {
        this.setData({ 'stats.matchCount': res.result.count })
      }
    }).catch(err => {
      console.error('获取比赛数量失败', err)
    })
  },

  loadNextClearDate() {
    wx.cloud.callFunction({
      name: 'manageDebater',
      data: { action: 'getSetting', key: 'nextClearDate' }
    }).then(res => {
      if (res.result && res.result.success && res.result.data) {
        const nextClearDate = res.result.data.nextClearDate
        const today = new Date()
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        this.setData({
          nextClearDate: nextClearDate,
          isOverdue: todayStr > nextClearDate
        })
      }
    }).catch(err => {
      // 首次使用没有设置，忽略
    })
  },

  // 只在7月及之后才检查毕业清除（前半年零开销）
  autoGraduateCleanup() {
    const month = new Date().getMonth() + 1
    if (month < 7) return

    wx.cloud.callFunction({
      name: 'graduateCleanup'
    }).then(res => {
      if (res.result && res.result.executed) {
        this.loadStats()
        wx.showToast({
          title: res.result.message,
          icon: 'none',
          duration: 4000
        })
      }
    }).catch(err => {
      console.error('毕业清除检查失败', err)
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
            this.loadStats()
          }).catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '重算失败', icon: 'none' })
          })
        }
      }
    })
  },

  clearMatchData() {
    wx.showModal({
      title: '确认清空所有比赛数据',
      content: '此操作将删除所有比赛记录并重置全部辩手积分为0，辩手信息将保留。此操作不可撤销！',
      confirmColor: '#E94560',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '清空中...' })
          wx.cloud.callFunction({
            name: 'clearMatchData'
          }).then(result => {
            wx.hideLoading()
            wx.showToast({
              title: result.result.message || '清空完成',
              icon: 'success',
              duration: 3000
            })
            this.loadStats()
            this.loadNextClearDate()
          }).catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '清空失败', icon: 'none' })
          })
        }
      }
    })
  }
})
