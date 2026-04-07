const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action, inviteCode, usedByName } = event

  // 兑换邀请码
  if (action === 'redeem') {
    if (!inviteCode) {
      return { success: false, message: '请输入邀请码' }
    }
    if (!usedByName) {
      return { success: false, message: '请输入姓名' }
    }

    // 检查是否已是管理员
    const existing = await db.collection('admins')
      .where({ openid: OPENID })
      .get()

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
      if (existing.data.length > 0) {
        return { success: true, message: '您已经是管理员', role: existing.data[0].role }
      }
      return { success: false, message: '邀请码无效或已过期' }
    }

    const codeDoc = codeResult.data[0]

    // 标记邀请码已使用
    await db.collection('invite_codes').doc(codeDoc._id).update({
      data: {
        used: true,
        usedBy: OPENID,
        usedByName: usedByName,
        usedAt: new Date()
      }
    })

    // 更新有效期（7天）
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    if (existing.data.length > 0) {
      // 已是管理员，续期
      await db.collection('admins').doc(existing.data[0]._id).update({
        data: {
          expiresAt,
          lastInvitedBy: codeDoc.createdBy,
          updatedAt: new Date()
        }
      })
      return { success: true, message: '授权已续期7天', role: existing.data[0].role, expiresAt }
    }

    // 新管理员，添加记录（7天有效期）
    await db.collection('admins').add({
      data: {
        openid: OPENID,
        role: codeDoc.role || 'admin',
        invitedBy: codeDoc.createdBy,
        createdAt: new Date(),
        expiresAt
      }
    })

    return { success: true, message: '授权成功', role: codeDoc.role || 'admin', expiresAt }
  }

  // 默认：检查是否为管理员（超级管理员永不过期，普通管理员需在有效期内）
  const _ = db.command
  const now = new Date()
  const adminResult = await db.collection('admins')
    .where(_.or([
      { openid: OPENID, role: 'super_admin' },
      { openid: OPENID, expiresAt: _.gt(now) },
      { openid: OPENID, expiresAt: _.exists(false) }
    ]))
    .get()

  return {
    isAdmin: adminResult.data.length > 0,
    role: adminResult.data.length > 0 ? adminResult.data[0].role : ''
  }
}
