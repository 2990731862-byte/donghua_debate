const { adminGuard } = require('../../../utils/auth')

Page({
  data: {
    debaters: [],
    loading: true,
    showForm: false,
    editingId: '',
    formName: '',
    formCollege: '',
    formGrade: '',
    formStudentId: '',

    // 学院管理
    colleges: [],
    showCollegeModal: false,
    newCollegeName: '',
    collegePickerRange: [],
    collegePickerIndex: 0,
    gradePickerRange: Array.from({ length: 52 }, (_, i) => String(2019 + i)),
    gradePickerIndex: 0
  },

  onLoad() {
    adminGuard().then(allowed => {
      if (allowed) {
        this.loadDebaters()
        this.loadColleges()
      }
    })
  },

  loadColleges() {
    wx.cloud.callFunction({
      name: 'manageDebater',
      data: { action: 'listColleges' }
    }).then(res => {
      if (res.result.success) {
        const colleges = res.result.data
        this.setData({ colleges })
      }
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
    const range = ['请选择学院', ...this.data.colleges]
    this.setData({
      showForm: true,
      editingId: '',
      formName: '',
      formCollege: '',
      formGrade: '',
      formStudentId: '',
      collegePickerRange: range,
      collegePickerIndex: 0,
      gradePickerIndex: 0
    })
  },

  showEditForm(e) {
    const index = e.currentTarget.dataset.index
    const debater = this.data.debaters[index]
    const range = ['请选择学院', ...this.data.colleges]
    const pickerIndex = range.indexOf(debater.college)
    const gradeIndex = this.data.gradePickerRange.indexOf(debater.grade || '')
    this.setData({
      showForm: true,
      editingId: debater._id,
      formName: debater.name,
      formCollege: debater.college,
      formGrade: debater.grade,
      formStudentId: debater.studentId || '',
      collegePickerRange: range,
      collegePickerIndex: pickerIndex >= 0 ? pickerIndex : 0,
      gradePickerIndex: gradeIndex >= 0 ? gradeIndex : 0
    })
  },

  hideForm() {
    this.setData({ showForm: false })
  },

  doNothing() {},
  preventTouchMove() {},

  onNameInput(e) { this.setData({ formName: e.detail.value }) },
  onCollegePickerChange(e) {
    const idx = e.detail.value
    const name = this.data.collegePickerRange[idx]
    this.setData({ collegePickerIndex: idx, formCollege: name === '请选择学院' ? '' : name })
  },
  onGradeInput(e) { this.setData({ formGrade: e.detail.value }) },
  onGradePickerChange(e) {
    const idx = e.detail.value
    this.setData({ gradePickerIndex: idx, formGrade: this.data.gradePickerRange[idx] })
  },
  onStudentIdInput(e) { this.setData({ formStudentId: e.detail.value }) },

  submitForm() {
    const { editingId, formName, formCollege, formGrade, formStudentId } = this.data
    if (!formName.trim() || !formCollege.trim()) {
      wx.showToast({ title: '请填写姓名和学院', icon: 'none' })
      return
    }
    const sid = formStudentId.trim()
    if (sid && !/^\d{9}$/.test(sid)) {
      wx.showToast({ title: '请填写正确的9位学号', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    const action = editingId ? 'update' : 'create'
    const data = {
      name: formName.trim(),
      college: formCollege.trim(),
      grade: formGrade.trim(),
      studentId: sid
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
  },

  // ====== 学院管理 ======
  showCollegeModal() {
    this.setData({ showCollegeModal: true, newCollegeName: '' })
  },

  hideCollegeModal() {
    this.setData({ showCollegeModal: false })
  },

  onNewCollegeInput(e) {
    this.setData({ newCollegeName: e.detail.value })
  },

  addCollege() {
    const name = this.data.newCollegeName.trim()
    if (!name) {
      wx.showToast({ title: '请输入学院名称', icon: 'none' })
      return
    }
    wx.cloud.callFunction({
      name: 'manageDebater',
      data: { action: 'addCollege', data: { name } }
    }).then(res => {
      if (res.result.success) {
        wx.showToast({ title: '已添加', icon: 'success' })
        this.setData({ newCollegeName: '' })
        this.loadColleges()
      } else {
        wx.showToast({ title: res.result.message || '添加失败', icon: 'none' })
      }
    }).catch(err => {
      console.error('添加学院失败', err)
      wx.showToast({ title: err.message || '添加失败', icon: 'none', duration: 3000 })
    })
  },

  deleteCollege(e) {
    const name = e.currentTarget.dataset.name
    wx.showModal({
      title: '确认删除',
      content: `确定删除学院"${name}"？`,
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'manageDebater',
            data: { action: 'deleteCollege', data: { name } }
          }).then(res => {
            if (res.result.success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadColleges()
            }
          })
        }
      }
    })
  }
})
