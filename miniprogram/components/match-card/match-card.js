Component({
  properties: {
    match: {
      type: Object,
      value: {}
    },
    participantScore: {
      type: Number,
      value: null
    },
    isBestDebater: {
      type: Boolean,
      value: false
    },
    isTopThree: {
      type: Boolean,
      value: false
    },
    index: {
      type: Number,
      value: 0
    }
  },

  data: {
    animationStyle: '',
    expanded: false,
    breakdownLines: []
  },

  observers: {
    'match.weight, match.scoreBreakdown': function () {
      var sb = this.data.match.scoreBreakdown
      if (!sb || !sb.roundDetails) {
        this.setData({ breakdownLines: [] })
        return
      }

      var W = this.data.match.weight || 1
      var lines = sb.roundDetails.map(function (rd) {
        var item = { round: rd.round, lines: [] }

        item.lines.push('基础分 +' + (0.5 * W * rd.round).toFixed(1))

        if (rd.isBestDebater) {
          item.lines.push('最佳辩手 +' + (0.5 * W).toFixed(1))
        }

        if (rd.isTopThree) {
          item.lines.push('前三名 +' + W.toFixed(1))
        }

        if (rd.recordBonus > 0) {
          var parts = []
          if (rd.isRecordBreakingRound) {
            var rbRound = 0.5 * Math.log2(Math.max(1, W)) + 0.5 * Math.floor(0.5 * rd.round)
            if (rbRound > 0) parts.push('轮次+' + rbRound.toFixed(1))
          }
          if (rd.isRecordBreakingBestDebater) {
            parts.push('佳辩+' + (0.5 * W).toFixed(1))
          }
          if (rd.isRecordBreakingTopThree) {
            parts.push('前三+' + (0.5 * W).toFixed(1))
          }
          if (parts.length > 0) {
            item.lines.push('破纪录奖励 ' + parts.join(' '))
          }
        }

        item.totalLine = '本轮合计 +' + rd.roundScore.toFixed(1)
        return item
      })

      this.setData({ breakdownLines: lines })
    }
  },

  lifetimes: {
    attached() {
      var delay = this.data.index * 0.05
      this.setData({
        animationStyle: 'animation-delay: ' + delay + 's'
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
