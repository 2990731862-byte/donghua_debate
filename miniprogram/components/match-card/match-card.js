Component({
  properties: {
    match: {
      type: Object,
      value: {}
    },
    // 当前辩手在此比赛中的得分（在辩手详情页使用）
    participantScore: {
      type: Number,
      value: null
    },
    index: {
      type: Number,
      value: 0
    }
  },

  data: {
    animationStyle: '',
    expanded: false
  },

  lifetimes: {
    attached() {
      const delay = this.data.index * 0.05
      this.setData({
        animationStyle: `animation-delay: ${delay}s`
      })
    }
  },

  methods: {
    toggleExpand() {
      this.setData({
        expanded: !this.data.expanded
      })
    }
  }
})
