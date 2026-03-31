const { checkAdminStatus } = require('../../utils/auth')

Page({
  data: {
    scoreTable: [
      { round: '第一轮', college: '0.5', school: '1', city: '2' },
      { round: '第二轮', college: '1', school: '2', city: '4' },
      { round: '第三轮', college: '1.5', school: '3', city: '6' },
      { round: '第四轮', college: '2', school: '4', city: '8' },
      { round: '第五轮', college: '2.5', school: '5', city: '10' },
      { round: '佳辩', college: '0.5', school: '1', city: '2' },
      { round: '前三名', college: '1', school: '2', city: '4' }
    ]
  },

  goAdmin() {
    checkAdminStatus().then(result => {
      if (result.isAdmin) {
        wx.navigateTo({
          url: '/pages/admin/dashboard/dashboard'
        })
      } else {
        this.setData({ showCodeModal: true, inputCode: '', inputName: '' })
      }
    })
  },

  cancelCodeModal() {
    this.setData({ showCodeModal: false, inputCode: '', inputName: '' })
  },

  onCodeInput(e) {
    this.setData({ inputCode: e.detail.value })
  },

  onNameInput(e) {
    this.setData({ inputName: e.detail.value })
  },

  confirmCode() {
    const code = this.data.inputCode.trim()
    const name = this.data.inputName.trim()
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    this.redeemCode(code, name)
  },

  redeemCode(code, name) {
    wx.showLoading({ title: '验证中...' })
    const { redeemInviteCode } = require('../../utils/auth')

    redeemInviteCode(code, name).then(result => {
      wx.hideLoading()
      if (result.success) {
        this.setData({ showCodeModal: false, inputCode: '' })
        wx.showToast({ title: '授权成功（有效期7天）', icon: 'success' })
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/admin/dashboard/dashboard'
          })
        }, 1500)
      } else {
        wx.showToast({ title: result.message || '邀请码无效', icon: 'none' })
      }
    }).catch(() => {
      wx.hideLoading()
      this.setData({ showCodeModal: false })
      wx.showToast({ title: '验证失败', icon: 'none' })
    })
  }
})
