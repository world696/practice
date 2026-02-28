const fs = require('node:fs')
const { JSDOM } = require('jsdom')

const dom = new JSDOM(`<!DOCTYPE html><div id='app'></div>`)

const document = dom.window.document
const window = dom.window

fetch('https://api.thecatapi.com/v1/images/search?limit=10&page=1').then(res => res.json()).then(data => {
    const app = document.getElementById('app')
    data.forEach(item=>{
       const img =  document.createElement('img')
       img.src = item.url
       img.style.width = '200px'
       img.style.height = '200px'
       app.appendChild(img)
    })
    /**
     * dom.serialize() 把当前 DOM 树转换成完整的 HTML 字符串
     */
    fs.writeFileSync('./index.html', dom.serialize())
})

// SSR (SERVER-SIDE RENDERING) 服务端渲染请求数据和拼装都在服务端完成;
// 而我们的Vue,react 等框架这里不谈(nuxtjs,nextjs)，是在客户端完成渲染拼接的属于CSR（Client-Side Rendering）客户端渲染