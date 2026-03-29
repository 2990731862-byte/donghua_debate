const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { debaterId } = event

  if (!debaterId) {
    return { error: '缺少辩手ID' }
  }

  // 获取辩手信息
  const debaterResult = await db.collection('debaters').doc(debaterId).get()
  const debater = debaterResult.data

  // 获取该辩手参加的所有比赛
  // 云数据库不支持数组内嵌对象的字段查询，需要获取所有比赛再筛选
  // 对于小规模数据（大学辩论队）这是可行的
  const _ = db.command
  const matchResult = await db.collection('matches')
    .where({
      'participants.debaterId': debaterId
    })
    .orderBy('date', 'desc')
    .get()

  return {
    debater,
    matches: matchResult.data
  }
}
