const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  // 检查是否为管理员（超级管理员永不过期，普通管理员需在有效期内）
  const _ = db.command
  const now = new Date()
  const adminResult = await db.collection('admins')
    .where(_.or([
      { openid: OPENID, role: 'super_admin' },
      { openid: OPENID, expiresAt: _.gt(now) }
    ]))
    .get()

  const isAdmin = adminResult.data.length > 0
  const adminRole = isAdmin ? adminResult.data[0].role : ''

  return {
    openid: OPENID,
    isAdmin,
    adminRole
  }
}
