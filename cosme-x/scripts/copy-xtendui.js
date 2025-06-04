// scripts/copy-xtendui.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ESM 环境下获取 __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// 源目录：node_modules/xtendui/dist
const xtenduiDistDir = path.join(projectRoot, 'node_modules', 'xtendui', 'dist')

// 目标目录：public/vendor/xtendui
const targetVendorDir = path.join(projectRoot, 'public', 'vendor', 'xtendui')

// 允许复制的文件后缀
const allowedExtensions = ['.js', '.js.map', '.css', '.css.map']

// 确保目标目录存在
function ensureTargetDir() {
  if (!fs.existsSync(targetVendorDir)) {
    console.log(`[copy-xtendui] 目标目录不存在，正在创建：${targetVendorDir}`)
    try {
      fs.mkdirSync(targetVendorDir, { recursive: true })
      console.log('[copy-xtendui] 目标目录创建成功。')
    } catch (err) {
      console.error(`[copy-xtendui] 无法创建目标目录 ${targetVendorDir}`, err)
      process.exit(1)
    }
  }
}

// 遍历源目录，复制所有符合后缀条件的文件
function copyAllDistFiles() {
  let files
  try {
    files = fs.readdirSync(xtenduiDistDir)
  } catch (err) {
    console.error(`[copy-xtendui] 无法读取源目录：${xtenduiDistDir}`, err)
    process.exit(1)
  }

  files.forEach((filename) => {
    const ext = path.extname(filename) // .js .css .map 等
    if (!allowedExtensions.includes(ext)) {
      return // 跳过其他非目标文件
    }

    const srcPath = path.join(xtenduiDistDir, filename)
    const destPath = path.join(targetVendorDir, filename)

    if (!fs.existsSync(srcPath)) {
      console.warn(`[copy-xtendui] 源文件不存在，跳过：${srcPath}`)
      return
    }

    try {
      fs.copyFileSync(srcPath, destPath)
      console.log(`[copy-xtendui] 已复制：${srcPath} → ${destPath}`)
    } catch (err) {
      console.error(`[copy-xtendui] 复制文件时出错：${srcPath} → ${destPath}`, err)
      process.exit(1)
    }
  })
}

function main() {
  console.log('[copy-xtendui] 开始复制 xtendui dist 目录下所有分片……')
  ensureTargetDir()
  copyAllDistFiles()
  console.log('[copy-xtendui] xtendui dist 全部文件复制完成。')
}

main()
