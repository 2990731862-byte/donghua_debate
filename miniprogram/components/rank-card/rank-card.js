Component({
  properties: {
    debater: {
      type: Object,
      value: {}
    },
    index: {
      type: Number,
      value: 0
    }
  },

  data: {
    animationStyle: ''
  },

  lifetimes: {
    attached() {
      // 交错动画延迟
      const delay = this.data.index * 0.05
      this.setData({
        animationStyle: `animation-delay: ${delay}s`
      })
    }
  },

  methods: {
    onTapCard() {
      const { debater } = this.data
      wx.navigateTo({
        url: `/pages/debater/debater?id=${debater._id}`
      })
    }
  }
})
