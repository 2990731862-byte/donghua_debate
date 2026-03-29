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
        // 非管理员显示邀请码输入弹窗
        wx.showModal({
          title: '管理员入口',
          content: '请输入邀请码以获取管理权限',
          editable: true,
          placeholderText: '输入邀请码',
          success: (res) => {
            if (res.confirm && res.content) {
              this.redeemCode(res.content.trim())
            }
          }
        })
      }
    })
  },

  redeemCode(code) {
    wx.showLoading({ title: '验证中...' })
    const { redeemInviteCode } = require('../../utils/auth')

    redeemInviteCode(code).then(result => {
      wx.hideLoading()
      if (result.success) {
        wx.showToast({ title: '授权成功', icon: 'success' })
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
      wx.showToast({ title: '验证失败', icon: 'none' })
    })
  }
})
