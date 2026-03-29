const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action, inviteCode } = event

  // 兑换邀请码
  if (action === 'redeem') {
    if (!inviteCode) {
      return { success: false, message: '请输入邀请码' }
    }

    // 检查是否已是管理员
    const existing = await db.collection('admins')
      .where({ openid: OPENID })
      .get()
    if (existing.data.length > 0) {
      return { success: true, message: '您已经是管理员', role: existing.data[0].role }
    }

    // 查找有效的邀请码
    const _ = db.command
    const codeResult = await db.collection('invite_codes')
      .where({
        code: inviteCode,
        used: false,
        expiresAt: _.gt(new Date())
      })
      .get()

    if (codeResult.data.length === 0) {
      return { success: false, message: '邀请码无效或已过期' }
    }

    const codeDoc = codeResult.data[0]

    // 标记邀请码已使用
    await db.collection('invite_codes').doc(codeDoc._id).update({
      data: {
        used: true,
        usedBy: OPENID,
        usedAt: new Date()
      }
    })

    // 添加为管理员
    await db.collection('admins').add({
      data: {
        openid: OPENID,
        role: codeDoc.role || 'admin',
        invitedBy: codeDoc.createdBy,
        createdAt: new Date()
      }
    })

    return { success: true, message: '授权成功', role: codeDoc.role || 'admin' }
  }

  // 默认：检查是否为管理员
  const adminResult = await db.collection('admins')
    .where({ openid: OPENID })
    .get()

  return {
    isAdmin: adminResult.data.length > 0,
    role: adminResult.data.length > 0 ? adminResult.data[0].role : ''
  }
}
