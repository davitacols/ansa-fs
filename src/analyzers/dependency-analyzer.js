// Dependency Graph Analyzer
import path from 'path';

export function analyzeDependencies(structure, options = {}) {
  const opts = {
    includeNodeModules: false,
    includeExternalDeps: true,
    ...options
  };
  
  const dependencies = {
    nodes: [],
    edges: [],
    externalDependencies: {}
  };
  
  const fileMap = {};
  const nodeIndex = {};
  
  // First pass: collect all files
  function collectFiles(node, parentDir = '') {
    if (node.type === 'file') {
      const isSourceFile = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'rb', 'go'].includes(node.extension);
      
      if (isSourceFile) {
        const id = node.path;
        fileMap[id] = {
          id,
          path: node.path,
          name: node.name,
          content: node.content,
          language: node.language,
          extension: node.extension,
          dependencies: []
        };
        
        // Add to nodes
        const nodeId = dependencies.nodes.length;
        nodeIndex[id] = nodeId;
        
        dependencies.nodes.push({
          id: nodeId,
          name: node.name,
          path: node.path,
          type: node.extension,
          size: node.size || 0
        });
      }
    }
    
    if (node.children) {
      node.children.forEach(child => collectFiles(child, node.path));
    }
  }
  
  // Second pass: analyze dependencies
  function analyzeDependenciesInFiles() {
    for (const filePath in fileMap) {
      const file = fileMap[filePath];
      
      if (!file.content) continue;
      
      const deps = extractDependencies(file);
      file.dependencies = deps;
      
      // Add edges
      deps.forEach(dep => {
        if (dep.type === 'internal' && nodeIndex[dep.path] !== undefined) {
          dependencies.edges.push({
            source: nodeIndex[filePath],
            target: nodeIndex[dep.path],
            type: 'internal'
          });
        } else if (dep.type === 'external' && opts.includeExternalDeps) {
          // Track external dependencies
          if (!dependencies.externalDependencies[dep.module]) {
            dependencies.externalDependencies[dep.module] = {
              count: 0,
              files: []
            };
          }
          
          dependencies.externalDependencies[dep.module].count++;
          dependencies.externalDependencies[dep.module].files.push(filePath);
        }
      });
    }
  }
  
  function extractDependencies(file) {
    const deps = [];
    
    if (['js', 'jsx', 'ts', 'tsx'].includes(file.extension)) {
      // JavaScript/TypeScript import detection
      const importRegex = /import\s+(?:[\w*\s{},]*)\s+from\s+['"]([^'"]+)['"]/g;
      const requireRegex = /(?:const|let|var)\s+(?:[\w*\s{},]*)\s+=\s+require\s*$$\s*['"]([^'"]+)['"]\s*$$/g;
      
      let match;
      
      // Process import statements
      while ((match = importRegex.exec(file.content)) !== null) {
        const importPath = match[1];
        processDependency(importPath, file.path, deps);
      }
      
      // Process require statements
      while ((match = requireRegex.exec(file.content)) !== null) {
        const importPath = match[1];
        processDependency(importPath, file.path, deps);
      }
    } else if (file.extension === 'py') {
      // Python import detection
      const importRegex = /(?:from\s+([^\s]+)\s+import|import\s+([^\s]+))/g;
      
      let match;
      while ((match = importRegex.exec(file.content)) !== null) {
        const importPath = match[1] || match[2];
        processDependency(importPath, file.path, deps, 'py');
      }
    }
    // Add more language-specific import detection as needed
    
    return deps;
  }
  
  function processDependency(importPath, filePath, deps, fileType = 'js') {
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      // Internal dependency
      let resolvedPath;
      
      if (fileType === 'js') {
        // Resolve relative path for JS/TS
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        resolvedPath = path.resolve(dir, importPath);
        
        // Try to find the actual file
        if (!fileMap[resolvedPath]) {
          // Try with extensions
          const extensions = ['.js', '.jsx', '.ts', '.tsx'];
          for (const ext of extensions) {
            if (fileMap[resolvedPath + ext]) {
              resolvedPath = resolvedPath + ext;
              break;
            }
          }
          
          // Try with index files
          if (!fileMap[resolvedPath]) {
            for (const ext of extensions) {
              if (fileMap[resolvedPath + '/index' + ext]) {
                resolvedPath = resolvedPath + '/index' + ext;
                break;
              }
            }
          }
        }
      } else if (fileType === 'py') {
        // Python-specific path resolution would go here
        // This is simplified
        resolvedPath = importPath.replace('.', '/') + '.py';
      }
      
      deps.push({
        type: 'internal',
        path: resolvedPath,
        original: importPath
      });
    } else {
      // External dependency
      deps.push({
        type: 'external',
        module: importPath.split('/')[0], // Get the package name
        original: importPath
      });
    }
  }
  
  // Run the analysis
  collectFiles(structure);
  analyzeDependenciesInFiles();
  
  return dependencies;
}

// Generate HTML for dependency visualization
export function generateDependencyGraph(dependencies, options = {}) {
  const opts = {
    width: 800,
    height: 600,
    title: 'Project Dependency Graph',
    ...options
  };
  
  // Create D3.js visualization
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f8f9fa;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    h1 {
      color: #333;
      margin-bottom: 1rem;
    }
    
    .graph-container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      padding: 1rem;
      margin-bottom: 2rem;
    }
    
    .node {
      cursor: pointer;
    }
    
    .link {
      stroke: #999;
      stroke-opacity: 0.6;
    }
    
    .node text {
      font-size: 10px;
      fill: #333;
    }
    
    .external-deps {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      padding: 1rem;
    }
    
    .external-deps h2 {
      margin-top: 0;
    }
    
    .dep-item {
      margin-bottom: 0.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #eee;
    }
    
    .dep-name {
      font-weight: bold;
    }
    
    .dep-count {
      color: #666;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${opts.title}</h1>
    
    <div class="graph-container">
      <svg id="dependency-graph" width="${opts.width}" height="${opts.height}"></svg>
    </div>
    
    <div class="external-deps">
      <h2>External Dependencies</h2>
      <div id="external-deps-list">
        ${Object.entries(dependencies.externalDependencies)
          .sort((a, b) => b[1].count - a[1].count)
          .map(([name, data]) => `
            <div class="dep-item">
              <span class="dep-name">${name}</span>
              <span class="dep-count">(${data.count} imports)</span>
            </div>
          `).join('')}
      </div>
    </div>
  </div>
  
  <script>
    // Graph data
    const nodes = ${JSON.stringify(dependencies.nodes)};
    const links = ${JSON.stringify(dependencies.edges)};
    
    // Create the graph
    const svg = d3.select("#dependency-graph");
    const width = ${opts.width};
    const height = ${opts.height};
    
    // Create a force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));
    
    // Create the links
    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("class", "link")
      .attr("stroke-width", d => Math.sqrt(d.value || 1));
    
    // Create the nodes
    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));
    
    // Add circles to the nodes
    node.append("circle")
      .attr("r", d => Math.max(5, Math.min(15, Math.sqrt(d.size / 1000) || 5)))
      .attr("fill", d => {
        // Color by file type
        const colors = {
          js: "#f1e05a",
          jsx: "#f1e05a",
          ts: "#2b7489",
          tsx: "#2b7489",
          py: "#3572A5",
          java: "#b07219",
          rb: "#701516",
          go: "#00ADD8"
        };
        return colors[d.type] || "#6c757d";
      });
    
    // Add labels to the nodes
    node.append("text")
      .attr("dx", 12)
      .attr("dy", ".35em")
      .text(d => d.name);
    
    // Add titles for tooltips
    node.append("title")
      .text(d => d.path);
    
    // Update positions on each tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      
      node
        .attr("transform", d => \`translate(\${d.x},\${d.y})\`);
    });
    
    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  </script>
</body>
</html>`;

  return html;
}