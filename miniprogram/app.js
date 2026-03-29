App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 以上的基础库以使用云能力')
      return
    }

    wx.cloud.init({
      // env 参数说明：
      // 填入云开发环境ID，可在云控制台获取
      // 如不填则使用默认环境（第一个创建的环境）
      traceUser: true,
    })

    this.globalData = {}

    // 获取用户登录状态和管理员权限
    this.checkLoginStatus()
  },

  checkLoginStatus: function () {
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        this.globalData.openid = res.result.openid
        this.globalData.isAdmin = res.result.isAdmin
        this.globalData.adminRole = res.result.adminRole
        // 触发回调，通知页面登录完成
        if (this.loginReadyCallback) {
          this.loginReadyCallback(res.result)
        }
      },
      fail: err => {
        console.error('登录失败', err)
      }
    })
  },

  globalData: {
    openid: '',
    isAdmin: false,
    adminRole: ''
  }
})
