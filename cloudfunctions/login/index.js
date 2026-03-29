const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  // 检查是否为管理员
  const adminResult = await db.collection('admins')
    .where({ openid: OPENID })
    .get()

  const isAdmin = adminResult.data.length > 0
  const adminRole = isAdmin ? adminResult.data[0].role : ''

  return {
    openid: OPENID,
    isAdmin,
    adminRole
  }
}
