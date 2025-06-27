const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 832,
    minHeight: 650,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  })
  // 开发时加载本地 Vite 服务，正式打包时改成文件路径
  win.loadURL('http://localhost:5173/')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
