Page({
  data: {
    debaters: [],
    currentFilter: '全部',
    loading: true,
    hasMore: false,
    page: 0,
    pageSize: 20
  },

  _requestId: 0,

  onLoad() {
    this.loadLeaderboard()
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '辩手积分榜' })
    // 每次显示时刷新数据（录入比赛后切回排行榜需看到最新数据）
    this._requestId++
    this.setData({ page: 0, debaters: [], loading: true })
    this.loadLeaderboard()
  },

  onPullDownRefresh() {
    this._requestId++
    this.setData({ page: 0, debaters: [], loading: true })
    this.loadLeaderboard().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter
    if (filter === this.data.currentFilter) return
    this._requestId++
    this.setData({
      currentFilter: filter,
      page: 0,
      debaters: [],
      loading: true
    })
    this.loadLeaderboard()
  },

  loadLeaderboard() {
    this.setData({ loading: true })
    const requestId = ++this._requestId

    return wx.cloud.callFunction({
      name: 'getLeaderboard',
      data: {
        levelFilter: this.data.currentFilter === '全部' ? '' : this.data.currentFilter,
        offset: this.data.page * this.data.pageSize,
        limit: this.data.pageSize
      }
    }).then(res => {
      if (requestId !== this._requestId) return
      const newDebaters = res.result.data || []
      this.setData({
        debaters: this.data.debaters.concat(newDebaters),
        hasMore: newDebaters.length === this.data.pageSize,
        loading: false
      })
    }).catch(err => {
      if (requestId !== this._requestId) return
      console.error('加载排行榜失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  loadMore() {
    if (this.data.loading) return
    this.setData({ page: this.data.page + 1 })
    this.loadLeaderboard()
  }
})
