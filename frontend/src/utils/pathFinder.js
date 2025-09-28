// Simple DFS pathfinder looking for up to maxDepth paths
export function findPaths(graph, start, end, maxDepth = 3) {
    const paths = []
    const visited = new Set()

    function dfs(node, path) {
        if (path.length > maxDepth) return
        if (node === end) {
            paths.push([...path])
            return
        }
        const neighbors = graph[node] || []
        for (const n of neighbors) {
            if (path.includes(n.to)) continue
            path.push(n.to)
            dfs(n.to, path)
            path.pop()
        }
    }


    dfs(start, [start])
    return paths.map(p => p)
}