import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'

const RENDERER_DIR = path.resolve(__dirname, '../../out/renderer')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
}

const server = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url || '/index.html'
  const filePath = path.join(RENDERER_DIR, url)

  try {
    const data = fs.readFileSync(filePath)
    const ext = path.extname(filePath)
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    })
    res.end(data)
  } catch {
    // SPA fallback: serve index.html for any 404
    try {
      const indexData = fs.readFileSync(path.join(RENDERER_DIR, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(indexData)
    } catch {
      res.writeHead(404)
      res.end('Not Found')
    }
  }
})

const PORT = parseInt(process.env.TEST_PORT || '9223')
server.listen(PORT, () => {
  console.log(`[test-server] Serving ${RENDERER_DIR} on http://localhost:${PORT}`)
})
