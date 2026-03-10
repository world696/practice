const http = require("node:http"); // NODE内置HTTP服务器模块
const url = require("node:url"); // NODE 内置URL解析模块
/**
 * 启动服务器
      │
      ▼
客户端发请求
      │
      ▼
createServer 回调触发
      │
      ▼
解析 URL
      │
      ▼
判断请求方法 (GET / POST)
      │
      ▼
判断路径
      │
      ▼
处理请求数据
      │
      ▼
返回响应
 */
http
  .createServer((req, res) => {
    /**
     * req
        req.url        请求路径
        req.method     请求方法
        req.headers    请求头
        req.on()       接收请求数据


      * res
        res.statusCode
        res.setHeader()
        res.write()
        res.end()
    */
    const { pathname, query } = url.parse(req.url, true); // 解析url，获取路径和查询参数
    if (req.method === "POST") {
      if (pathname === "/post") {
        // 检查路径是否为 '/post'
        let data = "";
        req.on("data", (chunk) => {
          data += chunk; // 获取 POST 请求的数据
          console.log(data);
        });
        req.on("end", () => {
          res.setHeader("Content-Type", "application/json"); // 设置响应头的 Content-Type 为 'application/json'
          res.statusCode = 200; // 设置响应状态码为 200
          res.end(data); // 将获取到的数据作为响应体返回
        });
      } else {
        res.setHeader("Content-Type", "application/json"); // 设置响应头的 Content-Type 为 'application/json'
        res.statusCode = 404; // 设置响应状态码为 404
        res.end("Not Found"); // 返回 'Not Found' 作为响应体
      }
    } else if (req.method === "GET") {
      if (pathname === "/get") {
        // 检查路径是否为 '/get'
        console.log(query.a); // 打印查询参数中的键名为 'a' 的值
        res.end("get success"); // 返回 'get success' 作为响应体
      }
    }
  })
  .listen(98, () => {
    console.log("server is running on port 98");
  });
