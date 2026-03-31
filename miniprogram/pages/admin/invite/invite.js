const { adminGuard } = require('../../../utils/auth')

Page({
  data: {
    codes: [],
    newCode: '',
    hasActiveCode: false,
    activeCodeInfo: null
  },

  onLoad() {
    adminGuard().then(allowed => {
      if (allowed) this.loadCodes()
    })
  },

  onShow() {
    if (this.data.authorized) this.loadCodes()
  },

  loadCodes() {
    wx.cloud.callFunction({
      name: 'inviteAdmin',
      data: { action: 'list' }
    }).then(res => {
      if (res.result.success) {
        const now = new Date()
        const codes = res.result.data.map(c => ({
          ...c,
          expired: !c.used && new Date(c.expiresAt) < now,
          createdAtStr: this.formatDate(c.createdAt),
          expiresAtStr: this.formatDate(c.expiresAt)
        }))
        // 检查是否有有效邀请码
        const activeCode = codes.find(c => !c.used && !c.expired)
        this.setData({
          codes,
          authorized: true,
          hasActiveCode: !!activeCode,
          activeCodeInfo: activeCode || null,
          newCode: activeCode ? activeCode.code : this.data.newCode
        })
      }
    })
  },

  generateCode() {
    if (this.data.hasActiveCode) {
      wx.showToast({ title: '当前已有有效邀请码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '生成中...' })
    wx.cloud.callFunction({
      name: 'inviteAdmin',
      data: { action: 'generate', role: 'admin' }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        this.setData({ newCode: res.result.code })
        this.loadCodes()
      } else {
        wx.showToast({ title: res.result.message || '生成失败', icon: 'none' })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '生成失败', icon: 'none' })
    })
  },

  copyCode(e) {
    const code = e.currentTarget.dataset.code || this.data.newCode
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
})
