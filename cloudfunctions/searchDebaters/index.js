const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { keyword } = event

  if (!keyword || !keyword.trim()) {
    return { data: [] }
  }

  const searchTerm = keyword.trim()

  // 云数据库支持正则搜索
  const _ = db.command
  const result = await db.collection('debaters')
    .where(_.or([
      { name: db.RegExp({ regexp: searchTerm, options: 'i' }) },
      { college: db.RegExp({ regexp: searchTerm, options: 'i' }) }
    ]))
    .orderBy('totalScore', 'desc')
    .limit(50)
    .get()

  return { data: result.data }
}
