const { adminGuard } = require('../../../utils/auth')

Page({
  data: {
    debaters: [],
    loading: true,
    showForm: false,
    editingId: '',
    formName: '',
    formCollege: '',
    formGrade: ''
  },

  onLoad() {
    adminGuard().then(allowed => {
      if (allowed) this.loadDebaters()
    })
  },

  loadDebaters() {
    this.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'manageDebater',
      data: { action: 'list' }
    }).then(res => {
      if (res.result.success) {
        this.setData({ debaters: res.result.data, loading: false })
      }
    }).catch(() => {
      this.setData({ loading: false })
    })
  },

  showAddForm() {
    this.setData({
      showForm: true,
      editingId: '',
      formName: '',
      formCollege: '',
      formGrade: ''
    })
  },

  showEditForm(e) {
    const index = e.currentTarget.dataset.index
    const debater = this.data.debaters[index]
    this.setData({
      showForm: true,
      editingId: debater._id,
      formName: debater.name,
      formCollege: debater.college,
      formGrade: debater.grade
    })
  },

  hideForm() {
    this.setData({ showForm: false })
  },

  doNothing() {},
  preventTouchMove() {},

  onNameInput(e) { this.setData({ formName: e.detail.value }) },
  onCollegeInput(e) { this.setData({ formCollege: e.detail.value }) },
  onGradeInput(e) { this.setData({ formGrade: e.detail.value }) },

  submitForm() {
    const { editingId, formName, formCollege, formGrade } = this.data
    if (!formName.trim() || !formCollege.trim()) {
      wx.showToast({ title: '请填写姓名和学院', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    const action = editingId ? 'update' : 'create'
    const data = {
      name: formName.trim(),
      college: formCollege.trim(),
      grade: formGrade.trim()
    }
    if (editingId) data.id = editingId

    wx.cloud.callFunction({
      name: 'manageDebater',
      data: { action, data }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        wx.showToast({ title: editingId ? '已更新' : '已添加', icon: 'success' })
        this.hideForm()
        this.loadDebaters()
      } else {
        wx.showToast({ title: res.result.message || '操作失败', icon: 'none' })
      }
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  },

  deleteDebater(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: `确定删除辩手"${name}"？该辩手的比赛记录将一并清除，此操作不可撤销。`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          wx.cloud.callFunction({
            name: 'manageDebater',
            data: { action: 'delete', data: { id } }
          }).then(res => {
            wx.hideLoading()
            if (res.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadDebaters()
            }
          }).catch(() => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
          })
        }
      }
    })
  }
})
