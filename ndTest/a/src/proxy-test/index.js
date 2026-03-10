const http = require('node:http')
const fs = require('node:fs')
const url = require('node:url')
const html = fs.readFileSync('./index.html')
const config = require('./q.config')

const server = http.createServer((req, res) => {
    const { pathname } = url.parse(req.url)
    const proxyList = Object.keys(config.serve.proxy) // 获取代理的服务
    if(proxyList.includes(pathname)) {
        const proxy = createProxyMiddleware(config.serve.proxy[pathname])
        proxy(req, res)
        return
    }
    console.log('='.repeat(80));
    console.log('proxyList==', proxyList);
    console.log('='.repeat(80));
    res.writeHead(200, {
        'content-type': 'text/html'
    })
    res.end(html)
})

server.listen(80)