import neo4j from 'neo4j-driver'

// 连接信息（和docker-compose.yml中的配置一致）
const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', '12345678')
)

// 获取会话
const session = driver.session()

// 1.执行创建节点
async function createData() {
    const result = await session.run(`
        CREATE (p:Product { name: "珍珠奶茶"})
        CREATE (i:Ingredient {name: "珍珠})`)

    console.log('创建成功');
}

// 2.执行创建关系
async function createRelation() {
    const result = await session.run(`
        MATCH (p:Product {name: "珍珠奶茶"}),(i:Ingredient { name: '珍珠})
        CREATE (p)-[:包含]->(i)`)

    return 
}