const { adminGuard } = require('../../../utils/auth')

Page({
  data: {
    codes: []
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
        const codes = res.result.data.map(c => {
          const expired = !c.used && new Date(c.expiresAt) < now
          const active = !c.used && !expired
          return {
            ...c,
            expired,
            active,
            status: c.used ? '已使用' : (expired ? '已过期' : '有效'),
            statusClass: c.used ? 'used' : (expired ? 'expired' : 'active'),
            createdAtStr: this.formatDate(c.createdAt),
            expiresAtStr: this.formatDate(c.expiresAt)
          }
        })
        this.setData({ codes, authorized: true })
      }
    })
  },

  generateCode() {
    wx.showLoading({ title: '生成中...' })
    wx.cloud.callFunction({
      name: 'inviteAdmin',
      data: { action: 'generate', role: 'admin' }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        wx.showToast({ title: '已生成', icon: 'success' })
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
    const code = e.currentTarget.dataset.code
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  deleteCode(e) {
    const { id, code, status } = e.currentTarget.dataset
    const msg = status === '有效'
      ? `确定删除邀请码"${code}"？删除后该码将立即失效。`
      : `确定删除邀请码"${code}"？`
    wx.showModal({
      title: '确认删除',
      content: msg,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          wx.cloud.callFunction({
            name: 'inviteAdmin',
            data: { action: 'delete', id }
          }).then(res => {
            wx.hideLoading()
            if (res.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadCodes()
            }
          }).catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
          })
        }
      }
    })
  },

  formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
})
