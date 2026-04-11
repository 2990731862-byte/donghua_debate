Page({
  data: {
    debaters: [],
    timeFilter: '',
    timeDisplay: '',
    showTimePicker: false,
    timeOptions: [],
    currentFilter: '全部',
    loading: true
  },

  _requestId: 0,
  _savedMonth: '',
  _savedMonthDisplay: '',
  _inited: false,

  onLoad() {
    this.initTimeOptions()
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '辩手积分榜' })
    if (!this._inited) {
      this._inited = true
      this._requestId++
      this.setData({ debaters: [], loading: true })
      this.loadLeaderboard()
      return
    }
    this._requestId++
    this.refreshMonthIfNeeded()
    this.setData({ debaters: [], loading: true })
    this.loadLeaderboard()
  },

  onPullDownRefresh() {
    this._requestId++
    this.setData({ debaters: [], loading: true })
    this.loadLeaderboard().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  refreshMonthIfNeeded() {
    const now = new Date()
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    if (this._savedMonth !== currentMonthStr) {
      this.initTimeOptions()
    }
    // 同月不需要刷新列表，时间选项不会变
  },

  initTimeOptions() {
    const now = new Date()
    const options = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      options.push({
        value: m,
        label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
        isCurrentMonth: i === 0
      })
    }
    const current = options[0]
    this._savedMonth = current.value
    this._savedMonthDisplay = current.label
    this.setData({
      timeOptions: options,
      timeFilter: current.value,
      timeDisplay: current.label
    })
  },

  onSelectAll() {
    if (this.data.timeFilter === '') return
    this._requestId++
    this.setData({
      timeFilter: '',
      showTimePicker: false,
      debaters: [],
      loading: true
    })
    this.loadLeaderboard()
  },

  onMonthTap() {
    if (this.data.timeFilter !== '') return
    this._requestId++
    this.setData({
      timeFilter: this._savedMonth,
      timeDisplay: this._savedMonthDisplay,
      showTimePicker: false,
      debaters: [],
      loading: true
    })
    this.loadLeaderboard()
  },

  toggleTimePicker() {
    if (this.data.timeFilter === '') {
      this.setData({
        timeFilter: this._savedMonth,
        timeDisplay: this._savedMonthDisplay,
        showTimePicker: true,
        debaters: [],
        loading: true
      })
      this._requestId++
      this.loadLeaderboard()
      return
    }
    this.setData({ showTimePicker: !this.data.showTimePicker })
  },

  onPickMonth(e) {
    const month = e.currentTarget.dataset.month
    const label = e.currentTarget.dataset.label
    this._savedMonth = month
    this._savedMonthDisplay = label
    this._requestId++
    this.setData({
      timeFilter: month,
      timeDisplay: label,
      showTimePicker: false,
      debaters: [],
      loading: true
    })
    this.loadLeaderboard()
  },

  closeTimePicker() {
    this.setData({ showTimePicker: false })
  },

  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter
    if (filter === this.data.currentFilter) return
    this._requestId++
    this.setData({
      currentFilter: filter,
      debaters: [],
      loading: true
    })
    this.loadLeaderboard()
  },

  loadLeaderboard() {
    this.setData({ loading: true })
    const requestId = this._requestId
    const levelFilter = this.data.currentFilter === '全部' ? '' : this.data.currentFilter

    return wx.cloud.callFunction({
      name: 'getLeaderboard',
      data: {
        levelFilter,
        monthFilter: this.data.timeFilter,
        offset: 0,
        limit: 20
      }
    }).then(res => {
      if (requestId !== this._requestId) return
      this.setData({
        debaters: res.result.data || [],
        loading: false
      })
    }).catch(err => {
      if (requestId !== this._requestId) return
      console.error('加载排行榜失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  }
})
