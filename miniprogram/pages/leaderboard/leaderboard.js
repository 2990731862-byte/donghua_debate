Page({
  data: {
    debaters: [],
    currentFilter: '全部',
    loading: true,
    hasMore: false,
    page: 0,
    pageSize: 20
  },

  onLoad() {
    this.loadLeaderboard()
  },

  onPullDownRefresh() {
    this.setData({ page: 0, debaters: [] })
    this.loadLeaderboard().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter
    if (filter === this.data.currentFilter) return
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

    return wx.cloud.callFunction({
      name: 'getLeaderboard',
      data: {
        levelFilter: this.data.currentFilter === '全部' ? '' : this.data.currentFilter,
        offset: this.data.page * this.data.pageSize,
        limit: this.data.pageSize
      }
    }).then(res => {
      const newDebaters = res.result.data || []
      this.setData({
        debaters: this.data.debaters.concat(newDebaters),
        hasMore: newDebaters.length === this.data.pageSize,
        loading: false
      })
    }).catch(err => {
      console.error('加载排行榜失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  loadMore() {
    this.setData({ page: this.data.page + 1 })
    this.loadLeaderboard()
  }
})
