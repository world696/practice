module.exports = {
    serve: {
        proxy: {
            // 代理路径
            '/api': {
                target: 'http:localhost:3000', // 转发地址
                changeOrigin: true // 是否跨域
            }
        }
    }
}