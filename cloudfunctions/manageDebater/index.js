const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action, data } = event

  // 验证管理员权限（超级管理员永不过期，普通管理员需在有效期内）
  const _ = db.command
  const now = new Date()
  const adminResult = await db.collection('admins')
    .where(_.or([
      { openid: OPENID, role: 'super_admin' },
      { openid: OPENID, expiresAt: _.gt(now) },
      { openid: OPENID, expiresAt: _.exists(false) }
    ]))
    .get()
  if (adminResult.data.length === 0) {
    return { success: false, message: '无权限或权限已过期' }
  }

  if (action === 'create') {
    const { name, college, grade, studentId } = data
    if (!name || !college) {
      return { success: false, message: '姓名和学院不能为空' }
    }

    const result = await db.collection('debaters').add({
      data: {
        name,
        college,
        grade: grade || '',
        studentId: studentId || '',
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
    const { id, name, college, grade, studentId } = data
    if (!id) return { success: false, message: '缺少辩手ID' }

    const updateData = { updatedAt: new Date() }
    if (name) updateData.name = name
    if (college) updateData.college = college
    if (grade !== undefined) updateData.grade = grade
    if (studentId !== undefined) updateData.studentId = studentId

    await db.collection('debaters').doc(id).update({ data: updateData })
    return { success: true }
  }

  if (action === 'delete') {
    const { id } = data
    if (!id) return { success: false, message: '缺少辩手ID' }

    // 查找该辩手参与的所有比赛
    const matchResult = await db.collection('matches')
      .where({ 'participants.debaterId': id })
      .limit(100)
      .get()

    let cleanedMatches = 0
    let removedMatches = 0

    for (const match of matchResult.data) {
      const newParticipants = match.participants.filter(p => p.debaterId !== id)

      if (newParticipants.length === 0) {
        // 没有参赛者了，删除整场比赛
        await db.collection('matches').doc(match._id).remove()
        removedMatches++
      } else {
        // 移除该辩手的参赛记录
        await db.collection('matches').doc(match._id).update({
          data: { participants: newParticipants }
        })
        cleanedMatches++
      }
    }

    // 删除辩手记录
    await db.collection('debaters').doc(id).remove()

    // 重算所有积分确保数据一致
    try {
      await cloud.callFunction({
        name: 'recalculateScores',
        data: { internal: true }
      })
    } catch (e) {
      console.error('自动重算失败', e)
    }

    return {
      success: true,
      message: `已删除辩手，清理了 ${cleanedMatches} 场比赛记录，删除了 ${removedMatches} 场空比赛`
    }
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

  // ====== 学院管理 ======
  async function ensureSettingsCollection() {
    try {
      await db.createCollection('settings')
    } catch (e) {
      // 集合已存在，忽略
    }
  }

  if (action === 'listColleges') {
    await ensureSettingsCollection()
    const doc = await db.collection('settings').doc('colleges').get().catch(() => null)
    return { success: true, data: (doc && doc.data) ? doc.data.names : [] }
  }

  if (action === 'addCollege') {
    const { name } = data
    if (!name || !name.trim()) return { success: false, message: '学院名称不能为空' }
    const trimmed = name.trim()

    await ensureSettingsCollection()
    const doc = await db.collection('settings').doc('colleges').get().catch(() => null)
    const names = (doc && doc.data) ? doc.data.names : []

    if (names.includes(trimmed)) return { success: false, message: '该学院已存在' }

    names.push(trimmed)
    await db.collection('settings').doc('colleges').set({ data: { names } })
    return { success: true }
  }

  if (action === 'deleteCollege') {
    const { name } = data
    if (!name) return { success: false, message: '缺少学院名称' }

    await ensureSettingsCollection()
    const doc = await db.collection('settings').doc('colleges').get().catch(() => null)
    const names = (doc && doc.data) ? doc.data.names : []

    const idx = names.indexOf(name)
    if (idx === -1) return { success: false, message: '学院不存在' }

    names.splice(idx, 1)
    await db.collection('settings').doc('colleges').set({ data: { names } })
    return { success: true }
  }

  // ====== 设置管理 ======
  if (action === 'getSetting') {
    const { key } = event.data || event
    if (!key) return { success: false, message: '缺少key' }
    const doc = await db.collection('settings').doc(key).get().catch(() => null)
    return { success: true, data: (doc && doc.data) ? doc.data : null }
  }

  return { success: false, message: '未知操作' }
}
