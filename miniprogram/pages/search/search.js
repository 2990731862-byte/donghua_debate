const RECENT_KEY = 'recent_searches'

Page({
  data: {
    keyword: '',
    results: [],
    searched: false,
    searching: false,
    recentSearches: []
  },

  onLoad() {
    const recent = wx.getStorageSync(RECENT_KEY) || []
    this.setData({ recentSearches: recent })
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
    const keyword = this.data.keyword.trim()
    if (!keyword) return

    this.saveToRecent(keyword)
    this.doSearch(keyword)
  },

  onRecentTap(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({ keyword })
    this.doSearch(keyword)
  },

  onClear() {
    this.setData({
      keyword: '',
      results: [],
      searched: false
    })
  },

  doSearch(keyword) {
    this.setData({ searching: true, searched: true })

    wx.cloud.callFunction({
      name: 'searchDebaters',
      data: { keyword }
    }).then(res => {
      this.setData({
        results: res.result.data || [],
        searching: false
      })
    }).catch(err => {
      console.error('搜索失败', err)
      this.setData({ searching: false })
      wx.showToast({ title: '搜索失败', icon: 'none' })
    })
  },

  saveToRecent(keyword) {
    let recent = this.data.recentSearches.filter(k => k !== keyword)
    recent.unshift(keyword)
    recent = recent.slice(0, 10) // 最多保存10条
    this.setData({ recentSearches: recent })
    wx.setStorageSync(RECENT_KEY, recent)
  },

  clearHistory() {
    this.setData({ recentSearches: [] })
    wx.removeStorageSync(RECENT_KEY)
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '搜索辩手' })
  }
})
