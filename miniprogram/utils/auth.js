/**
 * 认证工具 - 检查管理员状态
 */

/**
 * 检查当前用户是否为管理员
 * @returns {Promise<{isAdmin: boolean, role: string}>}
 */
function checkAdminStatus() {
  return new Promise((resolve, reject) => {
    const app = getApp()

    // 如果已经有登录数据，直接返回
    if (app.globalData.openid) {
      resolve({
        isAdmin: app.globalData.isAdmin,
        role: app.globalData.adminRole
      })
      return
    }

    // 等待登录完成
    app.loginReadyCallback = function (result) {
      resolve({
        isAdmin: result.isAdmin,
        role: result.adminRole
      })
    }
  })
}

/**
 * 兑换邀请码成为管理员
 * @param {string} code - 邀请码
 * @returns {Promise<Object>}
 */
function redeemInviteCode(code) {
  return wx.cloud.callFunction({
    name: 'checkAdmin',
    data: {
      action: 'redeem',
      inviteCode: code
    }
  }).then(res => {
    if (res.result.success) {
      // 更新全局状态
      const app = getApp()
      app.globalData.isAdmin = true
      app.globalData.adminRole = res.result.role
    }
    return res.result
  })
}

/**
 * 权限守卫 - 在管理页面的 onLoad 中调用
 * 非管理员自动跳回首页
 */
function adminGuard() {
  return checkAdminStatus().then(result => {
    if (!result.isAdmin) {
      wx.showToast({
        title: '无权限访问',
        icon: 'none',
        duration: 2000
      })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/leaderboard/leaderboard' })
      }, 1500)
      return false
    }
    return true
  })
}

module.exports = {
  checkAdminStatus,
  redeemInviteCode,
  adminGuard
}
