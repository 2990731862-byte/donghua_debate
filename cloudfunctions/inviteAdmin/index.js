const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 生成6位随机邀请码
 */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉容易混淆的字符
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action, role = 'admin' } = event

  // 验证是否为超级管理员
  const adminResult = await db.collection('admins')
    .where({ openid: OPENID, role: 'super_admin' })
    .get()

  if (adminResult.data.length === 0) {
    return { success: false, message: '仅超级管理员可以邀请' }
  }

  if (action === 'generate') {
    // 生成邀请码，7天有效
    const code = generateCode()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await db.collection('invite_codes').add({
      data: {
        code,
        createdBy: OPENID,
        role,
        used: false,
        usedBy: null,
        expiresAt,
        createdAt: new Date()
      }
    })

    return { success: true, code, expiresAt }
  }

  if (action === 'list') {
    // 列出所有邀请码
    const codes = await db.collection('invite_codes')
      .where({ createdBy: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    return { success: true, data: codes.data }
  }

  return { success: false, message: '未知操作' }
}
