const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action, data } = event

  // 验证管理员权限
  const adminResult = await db.collection('admins')
    .where({ openid: OPENID })
    .get()
  if (adminResult.data.length === 0) {
    return { success: false, message: '无权限' }
  }

  if (action === 'create') {
    const { name, college, grade } = data
    if (!name || !college) {
      return { success: false, message: '姓名和学院不能为空' }
    }

    const result = await db.collection('debaters').add({
      data: {
        name,
        college,
        grade: grade || '',
        totalScore: 0,
        rank: 0,
        matchCount: 0,
        personalRecords: {
          '院赛': { maxRound: 0, bestDebater: false, topThree: false },
          '校赛': { maxRound: 0, bestDebater: false, topThree: false },
          '市赛': { maxRound: 0, bestDebater: false, topThree: false }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    return { success: true, id: result._id }
  }

  if (action === 'update') {
    const { id, name, college, grade } = data
    if (!id) return { success: false, message: '缺少辩手ID' }

    const updateData = { updatedAt: new Date() }
    if (name) updateData.name = name
    if (college) updateData.college = college
    if (grade !== undefined) updateData.grade = grade

    await db.collection('debaters').doc(id).update({ data: updateData })
    return { success: true }
  }

  if (action === 'delete') {
    const { id } = data
    if (!id) return { success: false, message: '缺少辩手ID' }

    await db.collection('debaters').doc(id).remove()
    return { success: true }
  }

  if (action === 'list') {
    const result = await db.collection('debaters')
      .orderBy('name', 'asc')
      .limit(100)
      .get()
    return { success: true, data: result.data }
  }

  if (action === 'count') {
    const result = await db.collection('debaters').count()
    return { success: true, count: result.total }
  }

  return { success: false, message: '未知操作' }
}
