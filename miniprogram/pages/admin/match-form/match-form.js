const { adminGuard } = require('../../../utils/auth')
const { LEVEL_WEIGHTS } = require('../../../utils/scoring')

// 拼音首字母映射（常见汉字姓氏覆盖）
const PINYIN_MAP = {
  '赵': 'Z', '钱': 'Q', '孙': 'S', '李': 'L', '周': 'Z', '吴': 'W', '郑': 'Z', '王': 'W',
  '冯': 'F', '陈': 'C', '褚': 'C', '卫': 'W', '蒋': 'J', '沈': 'S', '韩': 'H', '杨': 'Y',
  '朱': 'Z', '秦': 'Q', '尤': 'Y', '许': 'X', '何': 'H', '吕': 'L', '施': 'S', '张': 'Z',
  '孔': 'K', '曹': 'C', '严': 'Y', '华': 'H', '金': 'J', '魏': 'W', '陶': 'T', '姜': 'J',
  '戚': 'Q', '谢': 'X', '邹': 'Z', '喻': 'Y', '柏': 'B', '水': 'S', '窦': 'D', '章': 'Z',
  '云': 'Y', '苏': 'S', '潘': 'P', '葛': 'G', '奚': 'X', '范': 'F', '彭': 'P', '郎': 'L',
  '鲁': 'L', '韦': 'W', '昌': 'C', '马': 'M', '苗': 'M', '凤': 'F', '花': 'H', '方': 'F',
  '俞': 'Y', '任': 'R', '袁': 'Y', '柳': 'L', '丰': 'F', '鲍': 'B', '史': 'S', '唐': 'T',
  '费': 'F', '廉': 'L', '岑': 'C', '薛': 'X', '雷': 'L', '贺': 'H', '倪': 'N', '汤': 'T',
  '滕': 'T', '殷': 'Y', '罗': 'L', '毕': 'B', '郝': 'H', '邬': 'W', '安': 'A', '常': 'C',
  '乐': 'L', '于': 'Y', '时': 'S', '傅': 'F', '皮': 'P', '卞': 'B', '齐': 'Q', '康': 'K',
  '伍': 'W', '余': 'Y', '元': 'Y', '卜': 'B', '顾': 'G', '孟': 'M', '平': 'P', '黄': 'H',
  '和': 'H', '穆': 'M', '萧': 'X', '尹': 'Y', '姚': 'Y', '邵': 'S', '湛': 'Z', '汪': 'W',
  '祁': 'Q', '毛': 'M', '禹': 'Y', '狄': 'D', '米': 'M', '贝': 'B', '明': 'M', '臧': 'Z',
  '计': 'J', '伏': 'F', '成': 'C', '戴': 'D', '谈': 'T', '宋': 'S', '茅': 'M', '庞': 'P',
  '熊': 'X', '纪': 'J', '舒': 'S', '屈': 'Q', '项': 'X', '祝': 'Z', '董': 'D', '梁': 'L',
  '杜': 'D', '阮': 'R', '蓝': 'L', '闵': 'M', '席': 'X', '季': 'J', '麻': 'M', '强': 'Q',
  '贾': 'J', '路': 'L', '娄': 'L', '危': 'W', '江': 'J', '童': 'T', '颜': 'Y', '郭': 'G',
  '梅': 'M', '盛': 'S', '林': 'L', '刁': 'D', '钟': 'Z', '徐': 'X', '邱': 'Q', '骆': 'L',
  '高': 'G', '夏': 'X', '蔡': 'C', '田': 'T', '樊': 'F', '胡': 'H', '凌': 'L', '霍': 'H',
  '虞': 'Y', '万': 'W', '支': 'Z', '柯': 'K', '昝': 'Z', '管': 'G', '卢': 'L', '莫': 'M',
  '经': 'J', '房': 'F', '裘': 'Q', '缪': 'M', '干': 'G', '解': 'X', '应': 'Y', '宗': 'Z',
  '丁': 'D', '宣': 'X', '贲': 'B', '邓': 'D', '郁': 'Y', '单': 'S', '杭': 'H', '洪': 'H',
  '包': 'B', '诸': 'Z', '左': 'Z', '石': 'S', '崔': 'C', '吉': 'J', '钮': 'N', '龚': 'G',
  '程': 'C', '嵇': 'J', '邢': 'X', '滑': 'H', '裴': 'P', '陆': 'L', '荣': 'R', '翁': 'W',
  '荀': 'X', '羊': 'Y', '於': 'Y', '惠': 'H', '甄': 'Z', '曲': 'Q', '家': 'J', '封': 'F',
  '芮': 'R', '羿': 'Y', '储': 'C', '靳': 'J', '汲': 'J', '邴': 'B', '糜': 'M', '松': 'S',
  '井': 'J', '段': 'D', '富': 'F', '巫': 'W', '乌': 'W', '焦': 'J', '巴': 'B', '弓': 'G',
  '牧': 'M', '隗': 'W', '山': 'S', '谷': 'G', '车': 'C', '侯': 'H', '宓': 'M', '蓬': 'P',
  '全': 'Q', '郗': 'X', '班': 'B', '仰': 'Y', '秋': 'Q', '仲': 'Z', '伊': 'Y', '宫': 'G',
  '宁': 'N', '仇': 'Q', '栾': 'L', '暴': 'B', '甘': 'G', '钭': 'T', '厉': 'L', '戎': 'R',
  '祖': 'Z', '武': 'W', '符': 'F', '刘': 'L', '景': 'J', '詹': 'Z', '束': 'S', '龙': 'L',
  '叶': 'Y', '幸': 'X', '司': 'S', '韶': 'S', '郜': 'G', '黎': 'L', '蓟': 'J', '薄': 'B',
  '印': 'Y', '宿': 'S', '白': 'B', '怀': 'H', '蒲': 'P', '邰': 'T', '从': 'C', '鄂': 'E',
  '索': 'S', '咸': 'X', '籍': 'J', '赖': 'L', '卓': 'Z', '蔺': 'L', '屠': 'T', '蒙': 'M',
  '池': 'C', '乔': 'Q', '阴': 'Y', '郁': 'Y', '胥': 'X', '能': 'N', '苍': 'C', '双': 'S',
  '闻': 'W', '莘': 'S', '党': 'D', '翟': 'Z', '谭': 'T', '贡': 'G', '劳': 'L', '逄': 'P',
  '姬': 'J', '申': 'S', '扶': 'F', '堵': 'D', '冉': 'R', '宰': 'Z', '郦': 'L', '雍': 'Y',
  '却': 'Q', '璩': 'Q', '桑': 'S', '桂': 'G', '濮': 'P', '牛': 'N', '寿': 'S', '通': 'T',
  '边': 'B', '扈': 'H', '燕': 'Y', '冀': 'J', '郏': 'J', '浦': 'P', '尚': 'S', '农': 'N',
  '温': 'W', '别': 'B', '庄': 'Z', '晏': 'Y', '柴': 'C', '瞿': 'Q', '阎': 'Y', '充': 'C',
  '慕': 'M', '连': 'L', '茹': 'R', '习': 'X', '宦': 'H', '艾': 'A', '鱼': 'Y', '容': 'R',
  '向': 'X', '古': 'G', '易': 'Y', '慎': 'S', '戈': 'G', '廖': 'L', '庚': 'G', '终': 'Z',
  '暨': 'J', '居': 'J', '衡': 'H', '步': 'B', '都': 'D', '耿': 'G', '满': 'M', '弘': 'H',
  '匡': 'K', '国': 'G', '文': 'W', '寇': 'K', '广': 'G', '禄': 'L', '阙': 'Q', '东': 'D',
  '欧': 'O', '殳': 'S', '沃': 'W', '利': 'L', '蔚': 'W', '越': 'Y', '夔': 'K', '隆': 'L',
  '师': 'S', '巩': 'G', '厍': 'S', '聂': 'N', '晁': 'C', '勾': 'G', '敖': 'A', '融': 'R',
  '冷': 'L', '訾': 'Z', '辛': 'X', '阚': 'K', '那': 'N', '简': 'J', '饶': 'R', '空': 'K',
  '曾': 'Z', '毋': 'W', '沙': 'S', '乜': 'M', '养': 'Y', '鞠': 'J', '须': 'X', '丰': 'F',
  '巢': 'C', '关': 'G', '蒯': 'K', '相': 'X', '查': 'Z', '后': 'H', '荆': 'J', '红': 'H',
  '游': 'Y', '竺': 'Z', '权': 'Q', '逯': 'L', '盖': 'G', '益': 'Y', '桓': 'H', '公': 'G',
  '万俟': 'W', '司马': 'S', '上官': 'S', '欧阳': 'O', '夏侯': 'X', '诸葛': 'Z', '闻人': 'W',
  '东方': 'D', '赫连': 'H', '皇甫': 'H', '尉迟': 'Y', '公羊': 'G', '澹台': 'T', '公冶': 'G',
  '宗政': 'Z', '濮阳': 'P', '淳于': 'C', '单于': 'S', '太叔': 'T', '申屠': 'S', '公孙': 'G',
  '仲孙': 'Z', '轩辕': 'X', '令狐': 'L', '钟离': 'Z', '宇文': 'Y', '长孙': 'Z', '慕容': 'M',
  '鲜于': 'X', '闾丘': 'L', '司徒': 'S', '司空': 'S', '亓官': 'Q', '司寇': 'S', '仉': 'Z',
  '督': 'D', '子车': 'Z', '颛孙': 'Z', '端木': 'D', '巫马': 'W', '公西': 'G', '漆雕': 'Q',
  '乐正': 'Y', '壤驷': 'R', '公良': 'G', '拓跋': 'T', '夹谷': 'J', '宰父': 'Z', '谷梁': 'G',
  '晋': 'J', '楚': 'C', '闫': 'Y', '法': 'F', '汝': 'R', '鄢': 'Y', '涂': 'T', '钦': 'Q',
  '段干': 'D', '百里': 'B', '东郭': 'D', '南门': 'N', '呼延': 'H', '归': 'G', '海': 'H',
  '羊舌': 'Y', '微生': 'W', '岳': 'Y', '帅': 'S', '缑': 'G', '亢': 'K', '况': 'K', '后': 'H',
  '有': 'Y', '琴': 'Q', '梁丘': 'L', '左丘': 'Z', '东门': 'D', '西门': 'X', '商': 'S', '牟': 'M',
  '佘': 'S', '佴': 'N', '伯': 'B', '赏': 'S', '南宫': 'N', '墨': 'M', '哈': 'H', '谯': 'Q',
  '笪': 'D', '年': 'N', '爱': 'A', '阳': 'Y', '佟': 'T', '第五': 'D', '言': 'Y', '福': 'F'
}

function getInitial(name) {
  if (!name) return '#'
  const firstChar = name.charAt(0)
  if (/[A-Za-z]/.test(firstChar)) return firstChar.toUpperCase()
  if (PINYIN_MAP[firstChar]) return PINYIN_MAP[firstChar]
  return '#'
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('')

Page({
  data: {
    step: 1,

    // 步骤1数据
    matchName: '',
    matchLevel: '院赛',
    matchWeight: 1,
    matchDate: '',
    matchRound: 1,
    matchStage: '初赛',

    // 比赛名称自动补全
    matchNameSuggestions: [],
    showNameSuggestions: false,

    // 步骤2数据
    allDebaters: [],
    filteredDebaters: [],
    groupedDebaters: [],
    selectedCount: 0,
    searchKeyword: '',
    letters: LETTERS,

    // 步骤3数据
    participants: [],

    // 提交状态
    submitting: false
  },

  onUnload() {
    if (this._blurTimer) clearTimeout(this._blurTimer)
  },

  onLoad() {
    adminGuard().then(allowed => {
      if (allowed) {
        const today = new Date()
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        this.setData({ matchDate: dateStr, maxDate: dateStr })
        this.loadDebaters()
        this.loadMatchNames()
      }
    })
  },

  loadMatchNames() {
    wx.cloud.callFunction({
      name: 'manageMatch',
      data: { action: 'list' }
    }).then(res => {
      if (res.result.success) {
        const names = [...new Set(res.result.data.map(m => m.name))]
        this.setData({ allMatchNames: names })
      }
    })
  },

  loadDebaters() {
    wx.cloud.callFunction({
      name: 'manageDebater',
      data: { action: 'list' }
    }).then(res => {
      if (res.result.success) {
        const debaters = res.result.data.map(d => ({
          ...d,
          selected: false,
          initial: getInitial(d.name)
        }))
        debaters.sort((a, b) => {
          if (a.initial !== b.initial) return a.initial.localeCompare(b.initial)
          return a.name.localeCompare(b.name, 'zh-CN')
        })
        this.setData({ allDebaters: debaters })
        this.applySearch()
      }
    })
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
    this.applySearch()
  },

  clearSearch() {
    this.setData({ searchKeyword: '' })
    this.applySearch()
  },

  applySearch() {
    const keyword = this.data.searchKeyword.trim().toLowerCase()
    const filtered = keyword
      ? this.data.allDebaters.filter(d =>
          d.name.toLowerCase().includes(keyword) ||
          (d.college || '').toLowerCase().includes(keyword) ||
          (d.studentId || '').includes(keyword)
        )
      : this.data.allDebaters

    // 按首字母分组
    const groups = []
    let currentLetter = ''
    let currentGroup = null
    for (const d of filtered) {
      if (d.initial !== currentLetter) {
        currentLetter = d.initial
        currentGroup = { letter: currentLetter, items: [] }
        groups.push(currentGroup)
      }
      currentGroup.items.push(d)
    }
    this.setData({ filteredDebaters: filtered, groupedDebaters: groups })
  },

  onLetterTap(e) {
    const letter = e.currentTarget.dataset.letter
    this.createSelectorQuery().select(`#letter-${letter}`).boundingClientRect(rect => {
      if (rect) {
        wx.pageScrollTo({ scrollTop: rect.top + wx.getSystemInfoSync().scrollTop - 120, duration: 100 })
      }
    }).exec()
  },

  // 步骤1输入
  onMatchNameInput(e) {
    const val = e.detail.value
    this.setData({ matchName: val })
    if (!val.trim()) {
      // 清空时显示全部历史名称
      if (this.data.allMatchNames && this.data.allMatchNames.length > 0) {
        this.setData({
          matchNameSuggestions: this.data.allMatchNames.slice(0, 10),
          showNameSuggestions: true
        })
      } else {
        this.setData({ showNameSuggestions: false })
      }
      return
    }
    const keyword = val.trim().toLowerCase()
    const suggestions = (this.data.allMatchNames || [])
      .filter(name => name.toLowerCase().includes(keyword))
      .slice(0, 10)
    this.setData({
      matchNameSuggestions: suggestions,
      showNameSuggestions: suggestions.length > 0
    })
  },

  onMatchNameFocus() {
    if (this._blurTimer) clearTimeout(this._blurTimer)
    if (this.data.allMatchNames && this.data.allMatchNames.length > 0) {
      this.setData({
        matchNameSuggestions: this.data.matchName.trim()
          ? this.data.allMatchNames.filter(n => n.toLowerCase().includes(this.data.matchName.trim().toLowerCase())).slice(0, 10)
          : this.data.allMatchNames.slice(0, 10),
        showNameSuggestions: true
      })
    }
  },

  onMatchNameBlur() {
    this._blurTimer = setTimeout(() => {
      this.setData({ showNameSuggestions: false })
    }, 300)
  },

  selectMatchName(e) {
    if (this._blurTimer) clearTimeout(this._blurTimer)
    const name = e.currentTarget.dataset.name
    this.setData({ matchName: name, showNameSuggestions: false })
  },

  preventTouchMove() {},
  onLevelChange(e) {
    const level = e.currentTarget.dataset.level
    this.setData({
      matchLevel: level,
      matchWeight: LEVEL_WEIGHTS[level]
    })
  },
  onDateChange(e) { this.setData({ matchDate: e.detail.value }) },
  onRoundChange(e) {
    const round = e.currentTarget.dataset.round
    this.setData({ matchRound: round })
  },
  onStageChange(e) {
    const stage = e.currentTarget.dataset.stage
    this.setData({ matchStage: stage })
  },

  // 步骤2选人
  toggleDebater(e) {
    const id = e.currentTarget.dataset.id
    const index = this.data.allDebaters.findIndex(d => d._id === id)
    if (index === -1) return
    const newVal = !this.data.allDebaters[index].selected
    this.setData({
      [`allDebaters[${index}].selected`]: newVal,
      selectedCount: this.data.allDebaters.filter((d, i) =>
        i === index ? newVal : d.selected
      ).length
    })
    this.applySearch()
  },

  // 步骤3操作
  toggleBestDebater(e) {
    const pindex = e.currentTarget.dataset.pindex
    this.setData({
      [`participants[${pindex}].isBestDebater`]: !this.data.participants[pindex].isBestDebater
    })
  },

  toggleTopThree(e) {
    const pindex = e.currentTarget.dataset.pindex
    this.setData({
      [`participants[${pindex}].topThreeFinish`]: !this.data.participants[pindex].topThreeFinish
    })
  },

  // 步骤导航
  nextStep() {
    const { step } = this.data

    // 验证
    if (step === 1) {
      if (!this.data.matchName.trim()) {
        wx.showToast({ title: '请输入比赛名称', icon: 'none' }); return
      }
      if (!this.data.matchDate) {
        wx.showToast({ title: '请选择比赛日期', icon: 'none' }); return
      }
    }

    if (step === 2) {
      const selected = this.data.allDebaters.filter(d => d.selected)
      if (selected.length === 0) {
        wx.showToast({ title: '请至少选择一位辩手', icon: 'none' }); return
      }
      const participants = selected.map(d => ({
        debaterId: d._id,
        debaterName: d.name,
        studentId: d.studentId || '',
        isBestDebater: false,
        topThreeFinish: false
      }))
      this.setData({ participants })
    }

    this.setData({ step: step + 1 })
  },

  prevStep() {
    this.setData({ step: this.data.step - 1 })
  },

  submitMatch() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...' })

    const round = this.data.matchRound
    const matchData = {
      name: this.data.matchName.trim(),
      level: this.data.matchLevel,
      stage: this.data.matchStage,
      date: this.data.matchDate,
      totalRounds: round,
      participants: this.data.participants.map(p => ({
        debaterId: p.debaterId,
        roundsParticipated: [round],
        bestDebaterRounds: p.isBestDebater ? [round] : [],
        topThreeFinish: p.topThreeFinish
      }))
    }

    wx.cloud.callFunction({
      name: 'submitMatch',
      data: { matchData }
    }).then(res => {
      wx.hideLoading()
      this.setData({ submitting: false })

      if (res.result.success) {
        wx.showToast({ title: '录入成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ title: res.result.message || '录入失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      this.setData({ submitting: false })
      console.error('提交失败', err)
      wx.showToast({ title: '提交失败', icon: 'none' })
    })
  }
})
