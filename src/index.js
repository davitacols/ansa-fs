const fs = require("fs").promises
const path = require("path")
const { createHash } = require("crypto")

// Default options
const defaultOptions = {
  ignoreDirs: ["node_modules", ".git", "dist", "build", ".next", ".cache"],
  ignoreFiles: [".DS_Store", "Thumbs.db", ".env", ".env.local"],
  ignoreExtensions: [],
  maxDepth: Number.POSITIVE_INFINITY,
  showFiles: true,
  includeSize: false,
  includeHash: false,
  includeModTime: false,
  includeContent: false,
  contentMaxSize: 1024 * 100, // 100KB max for content analysis
  detectLanguage: false,
  analyzeComplexity: false, // Option for code complexity analysis
  complexityThreshold: "low", // Minimum complexity level to report
}

/**
 * Extract the file structure of a directory
 * @param {string} dirPath - The directory path to scan
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} - The structure object
 */
async function extractStructure(dirPath, options = {}) {
  const opts = { ...defaultOptions, ...options }
  const absolutePath = path.resolve(dirPath)

  try {
    const stats = await fs.stat(absolutePath)

    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${absolutePath}`)
    }

    return await processDirectory(absolutePath, "", opts)
  } catch (error) {
    throw new Error(`Error extracting structure: ${error.message}`)
  }
}

/**
 * Process a directory and its contents
 * @private
 */
async function processDirectory(absolutePath, relativePath, options, currentDepth = 0) {
  const dirName = path.basename(absolutePath)

  // Skip if this directory should be ignored
  if (options.ignoreDirs.includes(dirName) && currentDepth > 0) {
    return null
  }

  // Skip if we've reached max depth
  if (currentDepth > options.maxDepth) {
    return null
  }

  try {
    const entries = await fs.readdir(absolutePath)
    const children = []

    for (const entry of entries) {
      const childAbsolutePath = path.join(absolutePath, entry)
      const childRelativePath = path.join(relativePath, entry)

      try {
        const stats = await fs.stat(childAbsolutePath)

        if (stats.isDirectory()) {
          const childDir = await processDirectory(childAbsolutePath, childRelativePath, options, currentDepth + 1)

          if (childDir) {
            children.push(childDir)
          }
        } else if (options.showFiles) {
          // Skip if this file should be ignored
          if (options.ignoreFiles.includes(entry)) {
            continue
          }

          const extension = path.extname(entry).slice(1).toLowerCase()

          if (options.ignoreExtensions.includes(extension)) {
            continue
          }

          const fileNode = {
            name: entry,
            path: childAbsolutePath,
            relativePath: childRelativePath,
            type: "file",
            extension: extension || null,
          }

          // Add file size if requested
          if (options.includeSize) {
            fileNode.size = stats.size
            fileNode.sizeFormatted = formatSize(stats.size)
          }

          // Add modification time if requested
          if (options.includeModTime) {
            fileNode.modTime = stats.mtime
            fileNode.modTimeFormatted = stats.mtime.toISOString()
          }

          // Add file hash if requested
          if (options.includeHash) {
            fileNode.hash = await getFileHash(childAbsolutePath)
          }

          // Add file content if requested and file is not too large
          if ((options.includeContent || options.analyzeComplexity) && stats.size <= options.contentMaxSize) {
            try {
              const content = await fs.readFile(childAbsolutePath, "utf8")
              
              if (options.includeContent) {
                fileNode.content = content
              }

              // Detect language if requested or needed for complexity analysis
              if (options.detectLanguage || options.analyzeComplexity) {
                const language = detectLanguage(entry, extension, content)
                fileNode.language = language
                
                // Analyze code complexity if requested and language is supported
                if (options.analyzeComplexity && language) {
                  const complexityMetrics = analyzeCodeComplexity(content, language)
                  
                  // Only include complexity if it meets the threshold
                  if (complexityMetrics && shouldIncludeComplexity(complexityMetrics.complexity, options.complexityThreshold)) {
                    fileNode.complexity = complexityMetrics
                  }
                }
              }
            } catch (error) {
              // Skip content if file can't be read as text
              fileNode.contentError = `Could not read file content: ${error.message}`
            }
          }

          children.push(fileNode)
        }
      } catch (error) {
        // Skip entries that can't be accessed
        console.error(`Error processing ${childAbsolutePath}: ${error.message}`)
      }
    }

    // Sort children: directories first, then files, both alphabetically
    children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

    const result = {
      name: dirName,
      path: absolutePath,
      relativePath: relativePath || dirName,
      type: "directory",
      children,
    }

    // Add directory size if requested
    if (options.includeSize) {
      const size = children.reduce((sum, child) => sum + (child.size || 0), 0)
      result.size = size
      result.sizeFormatted = formatSize(size)
    }

    return result
  } catch (error) {
    throw new Error(`Error processing directory ${absolutePath}: ${error.message}`)
  }
}

/**
 * Format a file structure as a tree string
 * @param {Object} structure - The structure object
 * @param {Object} options - Formatting options
 * @returns {string} - The formatted tree
 */
function formatAsTree(structure, options = {}) {
  const opts = {
    showSize: false,
    showModTime: false,
    showComplexity: false, // Option to show complexity
    ...options,
  }

  let result = ""

  function traverse(node, prefix = "", isLast = true) {
    const connector = isLast ? "└── " : "├── "
    const childPrefix = isLast ? "    " : "│   "

    let line = `${prefix}${connector}${node.name}`

    if (node.type === "directory") {
      line += "/"
    } else if (node.extension) {
      // Don't add extension if it's already in the name
      if (!node.name.endsWith(`.${node.extension}`)) {
        line += `.${node.extension}`
      }
    }

    // Add size if requested and available
    if (opts.showSize && node.sizeFormatted) {
      line += ` (${node.sizeFormatted})`
    }

    // Add mod time if requested and available
    if (opts.showModTime && node.modTimeFormatted) {
      line += ` [${node.modTimeFormatted.split("T")[0]}]`
    }
    
    // Add complexity if requested and available
    if (opts.showComplexity && node.complexity) {
      line += ` - Complexity: ${node.complexity.complexity}`
      
      if (node.language) {
        line += ` (${node.language})`
      }
    }

    result += line + "\n"

    if (node.type === "directory" && node.children) {
      node.children.forEach((child, index, array) => {
        traverse(child, prefix + childPrefix, index === array.length - 1)
      })
    }
  }

  traverse(structure)
  return result
}

/**
 * Convert a structure to an array of paths
 * @param {Object} structure - The structure object
 * @param {Object} options - Options for path generation
 * @returns {string[]} - Array of paths
 */
function toPaths(structure, options = {}) {
  const opts = {
    includeFiles: true,
    includeDirs: true,
    relative: true,
    includeComplexity: false, // Option to include complexity info
    ...options,
  }

  const paths = []

  function traverse(node) {
    const nodePath = opts.relative ? node.relativePath : node.path

    if (node.type === "directory") {
      if (opts.includeDirs) {
        paths.push(nodePath)
      }

      if (node.children) {
        node.children.forEach(traverse)
      }
    } else if (node.type === "file" && opts.includeFiles) {
      let pathInfo = nodePath
      
      // Add complexity if requested and available
      if (opts.includeComplexity && node.complexity) {
        pathInfo += ` (Complexity: ${node.complexity.complexity})`
      }
      
      paths.push(pathInfo)
    }
  }

  traverse(structure)
  return paths
}

/**
 * Filter a structure based on a predicate function
 * @param {Object} structure - The structure object
 * @param {Function} predicate - Function that returns true for items to keep
 * @returns {Object} - The filtered structure
 */
function filter(structure, predicate) {
  if (!predicate(structure)) {
    return null
  }

  if (structure.type === "directory" && structure.children) {
    const filteredChildren = structure.children.map((child) => filter(child, predicate)).filter(Boolean)

    return {
      ...structure,
      children: filteredChildren,
    }
  }

  return structure
}

/**
 * Get statistics about a structure
 * @param {Object} structure - The structure object
 * @returns {Object} - Statistics object
 */
function getStats(structure) {
  const stats = {
    directories: 0,
    files: 0,
    extensions: {},
    totalSize: 0,
    largestFiles: [],
    oldestFiles: [],
    newestFiles: [],
    // Complexity stats
    complexityStats: {
      low: 0,
      medium: 0,
      high: 0,
      veryHigh: 0
    },
    mostComplexFiles: [],
    languageStats: {}, // Track files by language
    complexityByLanguage: {} // Track complexity by language
  }

  function traverse(node) {
    if (node.type === "directory") {
      stats.directories++

      if (node.children) {
        node.children.forEach(traverse)
      }
    } else if (node.type === "file") {
      stats.files++

      if (node.extension) {
        stats.extensions[node.extension] = (stats.extensions[node.extension] || 0) + 1
      }

      if (node.size) {
        stats.totalSize += node.size

        // Track largest files
        stats.largestFiles.push({
          path: node.relativePath,
          size: node.size,
          sizeFormatted: node.sizeFormatted,
        })

        // Keep only top 10 largest files
        stats.largestFiles.sort((a, b) => b.size - a.size)
        if (stats.largestFiles.length > 10) {
          stats.largestFiles.pop()
        }
      }

      if (node.modTime) {
        const fileInfo = {
          path: node.relativePath,
          modTime: node.modTime,
          modTimeFormatted: node.modTimeFormatted,
        }

        // Track oldest files
        stats.oldestFiles.push({ ...fileInfo })
        stats.oldestFiles.sort((a, b) => a.modTime - b.modTime)
        if (stats.oldestFiles.length > 10) {
          stats.oldestFiles.pop()
        }

        // Track newest files
        stats.newestFiles.push({ ...fileInfo })
        stats.newestFiles.sort((a, b) => b.modTime - a.modTime)
        if (stats.newestFiles.length > 10) {
          stats.newestFiles.pop()
        }
      }
      
      // Track language stats
      if (node.language) {
        stats.languageStats[node.language] = (stats.languageStats[node.language] || 0) + 1
      }
      
      // Track complexity stats
      if (node.complexity) {
        const complexity = node.complexity.complexity
        
        if (complexity === 'very high') {
          stats.complexityStats.veryHigh++
        } else if (complexity === 'high') {
          stats.complexityStats.high++
        } else if (complexity === 'medium') {
          stats.complexityStats.medium++
        } else {
          stats.complexityStats.low++
        }
        
        // Track complexity by language
        if (node.language) {
          if (!stats.complexityByLanguage[node.language]) {
            stats.complexityByLanguage[node.language] = {
              low: 0,
              medium: 0,
              high: 0,
              veryHigh: 0
            }
          }
          
          stats.complexityByLanguage[node.language][complexity.replace(' ', '')] = 
            (stats.complexityByLanguage[node.language][complexity.replace(' ', '')] || 0) + 1
        }
        
        // Track most complex files
        stats.mostComplexFiles.push({
          path: node.relativePath,
          language: node.language,
          complexity: node.complexity,
          size: node.size,
          sizeFormatted: node.sizeFormatted
        })
        
        // Keep only top 10 most complex files
        stats.mostComplexFiles.sort((a, b) => {
          const complexityOrder = { 'very high': 4, 'high': 3, 'medium': 2, 'low': 1 }
          return complexityOrder[b.complexity.complexity] - complexityOrder[a.complexity.complexity]
        })
        
        if (stats.mostComplexFiles.length > 10) {
          stats.mostComplexFiles.pop()
        }
      }
    }
  }

  traverse(structure)

  if (stats.totalSize > 0) {
    stats.totalSizeFormatted = formatSize(stats.totalSize)
  }

  return stats
}

/**
 * Compare two directory structures and find differences
 * @param {Object} structureA - First structure
 * @param {Object} structureB - Second structure
 * @param {Object} options - Comparison options
 * @returns {Object} - Differences object
 */
function diffStructures(structureA, structureB, options = {}) {
  const opts = {
    compareContent: false,
    compareSize: true,
    compareModTime: false,
    compareComplexity: false, // Option to compare complexity
    ...options,
  }

  const result = {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
  }

  // Convert structures to path maps for easier comparison
  const mapA = structureToPathMap(structureA)
  const mapB = structureToPathMap(structureB)

  // Find removed items (in A but not in B)
  for (const [path, nodeA] of Object.entries(mapA)) {
    if (!mapB[path]) {
      result.removed.push({
        path,
        type: nodeA.type,
      })
    }
  }

  // Find added and modified items
  for (const [path, nodeB] of Object.entries(mapB)) {
    const nodeA = mapA[path]

    if (!nodeA) {
      // Added in B
      result.added.push({
        path,
        type: nodeB.type,
      })
    } else {
      // Exists in both, check if modified
      let isModified = false
      const modifications = {}

      if (nodeA.type !== nodeB.type) {
        isModified = true
        modifications.typeChanged = {
          from: nodeA.type,
          to: nodeB.type,
        }
      } else if (nodeA.type === "file") {
        // Compare file attributes
        if (opts.compareSize && nodeA.size !== nodeB.size) {
          isModified = true
          modifications.sizeChanged = {
            from: nodeA.size,
            to: nodeB.size,
            fromFormatted: nodeA.sizeFormatted,
            toFormatted: nodeB.sizeFormatted,
          }
        }

        if (
          opts.compareModTime &&
          nodeA.modTime &&
          nodeB.modTime &&
          nodeA.modTime.getTime() !== nodeB.modTime.getTime()
        ) {
          isModified = true
          modifications.modTimeChanged = {
            from: nodeA.modTimeFormatted,
            to: nodeB.modTimeFormatted,
          }
        }

        if (opts.compareContent && nodeA.content !== nodeB.content) {
          isModified = true
          modifications.contentChanged = true
        }

        if (nodeA.hash && nodeB.hash && nodeA.hash !== nodeB.hash) {
          isModified = true
          modifications.hashChanged = {
            from: nodeA.hash,
            to: nodeB.hash,
          }
        }
        
        // Compare complexity if requested
        if (opts.compareComplexity && 
            nodeA.complexity && 
            nodeB.complexity && 
            nodeA.complexity.complexity !== nodeB.complexity.complexity) {
          isModified = true
          modifications.complexityChanged = {
            from: nodeA.complexity.complexity,
            to: nodeB.complexity.complexity,
          }
        }
      }

      if (isModified) {
        result.modified.push({
          path,
          type: nodeB.type,
          modifications,
        })
      } else {
        result.unchanged.push({
          path,
          type: nodeB.type,
        })
      }
    }
  }

  return result
}

/**
 * Export structure to Markdown format
 * @param {Object} structure - The structure object
 * @param {Object} options - Export options
 * @returns {string} - Markdown representation
 */
function exportToMarkdown(structure, options = {}) {
  const opts = {
    title: "Project Structure",
    includeStats: true,
    includeSize: true,
    includeComplexity: false, // Option to include complexity
    includeDetailedComplexity: false, // Option for detailed complexity metrics
    ...options,
  }

  let markdown = `# ${opts.title}\n\n`

  if (opts.includeStats) {
    const stats = getStats(structure)
    markdown += "## Statistics\n\n"
    markdown += `- Total directories: ${stats.directories}\n`
    markdown += `- Total files: ${stats.files}\n`

    if (stats.totalSizeFormatted) {
      markdown += `- Total size: ${stats.totalSizeFormatted}\n`
    }
    
    // Add complexity statistics if requested
    if (opts.includeComplexity) {
      markdown += "\n### Code Complexity\n\n"
      markdown += `- Low complexity: ${stats.complexityStats.low} files\n`
      markdown += `- Medium complexity: ${stats.complexityStats.medium} files\n`
      markdown += `- High complexity: ${stats.complexityStats.high} files\n`
      markdown += `- Very high complexity: ${stats.complexityStats.veryHigh} files\n`
      
      if (stats.mostComplexFiles.length > 0) {
        markdown += "\n#### Most Complex Files\n\n"
        
        stats.mostComplexFiles.forEach((file, index) => {
          markdown += `${index + 1}. **${file.path}** - ${file.complexity.complexity} (${file.language})\n`
          
          if (opts.includeDetailedComplexity) {
            markdown += `   - Lines: ${file.complexity.lines}, Code: ${file.complexity.codeLines}, Comments: ${file.complexity.commentLines}\n`
            
            if (file.complexity.functions !== undefined) {
              markdown += `   - Functions: ${file.complexity.functions}, `
            }
            
            if (file.complexity.classes !== undefined) {
              markdown += `Classes: ${file.complexity.classes}, `
            }
            
            if (file.complexity.conditionals !== undefined) {
              markdown += `Conditionals: ${file.complexity.conditionals}\n`
            } else {
              markdown += '\n'
            }
          }
        })
      }
    }

    if (Object.keys(stats.extensions).length > 0) {
      markdown += "\n### File Extensions\n\n"

      Object.entries(stats.extensions)
        .sort((a, b) => b[1] - a[1])
        .forEach(([ext, count]) => {
          markdown += `- .${ext}: ${count} files\n`
        })
    }

    if (stats.largestFiles.length > 0) {
      markdown += "\n### Largest Files\n\n"

      stats.largestFiles.forEach((file) => {
        markdown += `- ${file.path} (${file.sizeFormatted})\n`
      })
    }

    markdown += "\n"
  }

  markdown += "## Directory Structure\n\n"
  markdown += "\`\`\`\n"
  markdown += formatAsTree(structure, { 
    showSize: opts.includeSize,
    showComplexity: opts.includeComplexity 
  })
  markdown += "\`\`\`\n\n"

  return markdown
}

/**
 * Export structure to HTML format with interactive visualizations
 * @param {Object} structure - The structure object
 * @param {Object} options - Export options
 * @returns {string} - HTML representation
 */
function exportToHtml(structure, options = {}) {
  const opts = {
    title: "Project Structure Analysis",
    includeStats: true,
    includeSize: true,
    includeComplexity: true,
    includeDetailedComplexity: true,
    darkMode: false,
    ...options,
  }

  const stats = getStats(structure)
  
  // Prepare data for charts
  const complexityData = [
    stats.complexityStats.low,
    stats.complexityStats.medium,
    stats.complexityStats.high,
    stats.complexityStats.veryHigh
  ]
  
  const languageData = Object.entries(stats.languageStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // Top 10 languages
  
  const complexityByLanguageData = Object.entries(stats.complexityByLanguage)
    .sort((a, b) => {
      // Sort by total files in language
      const totalA = Object.values(a[1]).reduce((sum, count) => sum + count, 0)
      const totalB = Object.values(b[1]).reduce((sum, count) => sum + count, 0)
      return totalB - totalA
    })
    .slice(0, 5) // Top 5 languages
  
  // Generate HTML
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
  <style>
    :root {
      ${opts.darkMode ? `
      --bg-color: #1e1e1e;
      --text-color: #f0f0f0;
      --card-bg: #2d2d2d;
      --border-color: #444;
      --hover-color: #3a3a3a;
      --link-color: #58a6ff;
      --chart-grid: rgba(255, 255, 255, 0.1);
      ` : `
      --bg-color: #f8f9fa;
      --text-color: #212529;
      --card-bg: #ffffff;
      --border-color: #dee2e6;
      --hover-color: #f1f3f5;
      --link-color: #0d6efd;
      --chart-grid: rgba(0, 0, 0, 0.1);
      `}
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background-color: var(--bg-color);
      margin: 0;
      padding: 0;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    header {
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
    }
    
    h1, h2, h3, h4 {
      margin-top: 0;
      color: var(--text-color);
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    .summary-card {
      background-color: var(--card-bg);
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .summary-card h3 {
      margin-top: 0;
      font-size: 1rem;
      color: var(--text-color);
      opacity: 0.8;
    }
    
    .summary-card p {
      font-size: 1.5rem;
      font-weight: bold;
      margin: 0;
    }
    
    .chart-container {
      background-color: var(--card-bg);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 2rem;
    }
    
    .file-list {
      background-color: var(--card-bg);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }
    
    th {
      background-color: var(--bg-color);
      position: sticky;
      top: 0;
    }
    
    tr:hover {
      background-color: var(--hover-color);
    }
    
    .complexity-badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 500;
    }
    
    .complexity-low {
      background-color: #d1e7dd;
      color: #0f5132;
    }
    
    .complexity-medium {
      background-color: #fff3cd;
      color: #664d03;
    }
    
    .complexity-high {
      background-color: #f8d7da;
      color: #842029;
    }
    
    .complexity-very-high {
      background-color: #dc3545;
      color: white;
    }
    
    .tree-view {
      background-color: var(--card-bg);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      overflow: auto;
    }
    
    .tree-item {
      margin-bottom: 0.25rem;
    }
    
    .tree-directory {
      cursor: pointer;
      user-select: none;
    }
    
    .tree-directory::before {
      content: "▶";
      display: inline-block;
      margin-right: 0.5rem;
      transition: transform 0.2s;
    }
    
    .tree-directory.expanded::before {
      transform: rotate(90deg);
    }
    
    .tree-children {
      padding-left: 1.5rem;
      display: none;
    }
    
    .tree-directory.expanded + .tree-children {
      display: block;
    }
    
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    
    .filter-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    select, input {
      padding: 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--card-bg);
      color: var(--text-color);
    }
    
    button {
      padding: 0.5rem 1rem;
      background-color: var(--link-color);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    button:hover {
      opacity: 0.9;
    }
    
    .search-box {
      flex-grow: 1;
      max-width: 300px;
    }
    
    .theme-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-left: auto;
    }
    
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 60px;
      height: 34px;
    }
    
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 34px;
    }
    
    .slider:before {
      position: absolute;
      content: "";
      height: 26px;
      width: 26px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    
    input:checked + .slider {
      background-color: var(--link-color);
    }
    
    input:checked + .slider:before {
      transform: translateX(26px);
    }
    
    @media (max-width: 768px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${opts.title}</h1>
      <div class="theme-toggle">
        <span>Light</span>
        <label class="toggle-switch">
          <input type="checkbox" id="theme-toggle" ${opts.darkMode ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
        <span>Dark</span>
      </div>
    </header>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Directories</h3>
        <p>${stats.directories}</p>
      </div>
      <div class="summary-card">
        <h3>Files</h3>
        <p>${stats.files}</p>
      </div>
      ${stats.totalSizeFormatted ? `
      <div class="summary-card">
        <h3>Total Size</h3>
        <p>${stats.totalSizeFormatted}</p>
      </div>
      ` : ''}
      ${opts.includeComplexity ? `
      <div class="summary-card">
        <h3>Complex Files</h3>
        <p>${stats.complexityStats.high + stats.complexityStats.veryHigh}</p>
      </div>
      ` : ''}
    </div>
    
    ${opts.includeComplexity ? `
    <div class="charts-grid">
      <div class="chart-container">
        <h2>Complexity Distribution</h2>
        <canvas id="complexityChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2>Language Distribution</h2>
        <canvas id="languageChart"></canvas>
      </div>
      
      ${complexityByLanguageData.length > 0 ? `
      <div class="chart-container">
        <h2>Complexity by Language</h2>
        <canvas id="complexityByLanguageChart"></canvas>
      </div>
      ` : ''}
      
      ${stats.mostComplexFiles.length > 0 && opts.includeSize ? `
      <div class="chart-container">
        <h2>Complexity vs Size</h2>
        <canvas id="complexitySizeChart"></canvas>
      </div>
      ` : ''}
    </div>
    
    <div class="file-list">
      <h2>Most Complex Files</h2>
      
      <div class="filters">
        <div class="filter-group">
          <label for="complexity-filter">Complexity:</label>
          <select id="complexity-filter">
            <option value="all">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="very high">Very High</option>
          </select>
        </div>
        
        <div class="filter-group">
          <label for="language-filter">Language:</label>
          <select id="language-filter">
            <option value="all">All</option>
            ${Object.keys(stats.languageStats).sort().map(lang => 
              `<option value="${lang}">${lang}</option>`
            ).join('')}
          </select>
        </div>
        
        <div class="filter-group search-box">
          <input type="text" id="search-input" placeholder="Search files...">
        </div>
      </div>
      
      <table id="files-table">
        <thead>
          <tr>
            <th data-sort="path">File Path</th>
            <th data-sort="language">Language</th>
            <th data-sort="complexity">Complexity</th>
            ${opts.includeSize ? `<th data-sort="size">Size</th>` : ''}
            ${opts.includeDetailedComplexity ? `
            <th data-sort="lines">Lines</th>
            <th data-sort="functions">Functions</th>
            <th data-sort="conditionals">Conditionals</th>
            ` : ''}
          </tr>
        </thead>
        <tbody>
          ${getAllFilesWithComplexity(structure).map(file => `
          <tr data-complexity="${file.complexity.complexity}" data-language="${file.language || ''}">
            <td>${file.relativePath}</td>
            <td>${file.language || 'Unknown'}</td>
            <td>
              <span class="complexity-badge complexity-${file.complexity.complexity.replace(' ', '-')}">
                ${file.complexity.complexity}
              </span>
            </td>
            ${opts.includeSize ? `<td>${file.sizeFormatted || 'N/A'}</td>` : ''}
            ${opts.includeDetailedComplexity ? `
            <td>${file.complexity.lines}</td>
            <td>${file.complexity.functions !== undefined ? file.complexity.functions : 'N/A'}</td>
            <td>${file.complexity.conditionals !== undefined ? file.complexity.conditionals : 'N/A'}</td>
            ` : ''}
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
    
    <div class="tree-view">
      <h2>Directory Structure</h2>
      ${renderTreeView(structure, opts)}
    </div>
  </div>
  
  <script>
    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('change', function() {
      document.documentElement.setAttribute('data-theme', this.checked ? 'dark' : 'light');
      localStorage.setItem('theme', this.checked ? 'dark' : 'light');
    });
    
    // Initialize theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
      themeToggle.checked = savedTheme === 'dark';
    }
    
    // Tree view functionality
    document.querySelectorAll('.tree-directory').forEach(item => {
      item.addEventListener('click', event => {
        event.stopPropagation();
        item.classList.toggle('expanded');
      });
    });
    
    // Expand all / Collapse all buttons
    function expandAll() {
      document.querySelectorAll('.tree-directory').forEach(item => {
        item.classList.add('expanded');
      });
    }
    
    function collapseAll() {
      document.querySelectorAll('.tree-directory').forEach(item => {
        item.classList.remove('expanded');
      });
    }
    
    // Table filtering and sorting
    const filesTable = document.getElementById('files-table');
    const complexityFilter = document.getElementById('complexity-filter');
    const languageFilter = document.getElementById('language-filter');
    const searchInput = document.getElementById('search-input');
    
    if (filesTable && complexityFilter && languageFilter && searchInput) {
      function filterTable() {
        const complexityValue = complexityFilter.value;
        const languageValue = languageFilter.value;
        const searchValue = searchInput.value.toLowerCase();
        
        const rows = filesTable.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
          const complexity = row.getAttribute('data-complexity');
          const language = row.getAttribute('data-language');
          const text = row.textContent.toLowerCase();
          
          const complexityMatch = complexityValue === 'all' || complexity === complexityValue;
          const languageMatch = languageValue === 'all' || language === languageValue;
          const searchMatch = searchValue === '' || text.includes(searchValue);
          
          row.style.display = complexityMatch && languageMatch && searchMatch ? '' : 'none';
        });
      }
      
      complexityFilter.addEventListener('change', filterTable);
      languageFilter.addEventListener('change', filterTable);
      searchInput.addEventListener('input', filterTable);
      
      // Table sorting
      document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
          const sortBy = th.getAttribute('data-sort');
          const tbody = filesTable.querySelector('tbody');
          const rows = Array.from(tbody.querySelectorAll('tr'));
          
          // Toggle sort direction
          const ascending = th.classList.toggle('sort-asc');
          
          // Remove sort classes from other headers
          document.querySelectorAll('th[data-sort]').forEach(otherTh => {
            if (otherTh !== th) {
              otherTh.classList.remove('sort-asc', 'sort-desc');
            }
          });
          
          // Sort rows
          rows.sort((a, b) => {
            let aValue, bValue;
            
            if (sortBy === 'path') {
              aValue = a.cells[0].textContent;
              bValue = b.cells[0].textContent;
            } else if (sortBy === 'language') {
              aValue = a.cells[1].textContent;
              bValue = b.cells[1].textContent;
            } else if (sortBy === 'complexity') {
              const complexityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'very high': 4 };
              aValue = complexityOrder[a.getAttribute('data-complexity')] || 0;
              bValue = complexityOrder[b.getAttribute('data-complexity')] || 0;
            } else if (sortBy === 'size') {
              aValue = parseInt(a.cells[3].textContent) || 0;
              bValue = parseInt(b.cells[3].textContent) || 0;
            } else if (sortBy === 'lines') {
              aValue = parseInt(a.cells[4].textContent) || 0;
              bValue = parseInt(b.cells[4].textContent) || 0;
            } else if (sortBy === 'functions') {
              aValue = parseInt(a.cells[5].textContent) || 0;
              bValue = parseInt(b.cells[5].textContent) || 0;
            } else if (sortBy === 'conditionals') {
              aValue = parseInt(a.cells[6].textContent) || 0;
              bValue = parseInt(b.cells[6].textContent) || 0;
            }
            
            if (ascending) {
              return aValue > bValue ? 1 : -1;
            } else {
              return aValue < bValue ? 1 : -1;
            }
          });
          
          // Reorder rows
          rows.forEach(row => tbody.appendChild(row));
        });
      });
    }
    
    // Initialize charts if Chart.js is available
    if (typeof Chart !== 'undefined') {
      // Complexity distribution chart
      const complexityCtx = document.getElementById('complexityChart');
      if (complexityCtx) {
        new Chart(complexityCtx, {
          type: 'pie',
          data: {
            labels: ['Low', 'Medium', 'High', 'Very High'],
            datasets: [{
              data: ${JSON.stringify(complexityData)},
              backgroundColor: [
                '#d1e7dd',
                '#fff3cd',
                '#f8d7da',
                '#dc3545'
              ],
              borderColor: [
                '#0f5132',
                '#664d03',
                '#842029',
                '#b02a37'
              ],
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                position: 'right',
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const label = context.label || '';
                    const value = context.raw || 0;
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percentage = Math.round((value / total) * 100);
                    return `${label}: ${value} (${percentage}%)`;
                  }
                }
              }
            }
          }
        });
      }

      // Language distribution chart
      const languageCtx = document.getElementById('languageChart');
      if (languageCtx) {
        new Chart(languageCtx, {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(languageData.map(item => item[0]))},
            datasets: [{
              label: 'Files',
              data: ${JSON.stringify(languageData.map(item => item[1]))},
              backgroundColor: 'rgba(54, 162, 235, 0.5)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0
                }
              }
            }
          }
        });
      }
      
      // Complexity by language chart
      const complexityByLanguageCtx = document.getElementById('complexityByLanguageChart');
      if (complexityByLanguageCtx) {
        new Chart(complexityByLanguageCtx, {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(complexityByLanguageData.map(item => item[0]))},
            datasets: [
              {
                label: 'Low',
                data: ${JSON.stringify(complexityByLanguageData.map(item => item[1].low || 0))},
                backgroundColor: '#d1e7dd',
                borderColor: '#0f5132',
                borderWidth: 1
              },
              {
                label: 'Medium',
                data: ${JSON.stringify(complexityByLanguageData.map(item => item[1].medium || 0))},
                backgroundColor: '#fff3cd',
                borderColor: '#664d03',
                borderWidth: 1
              },
              {
                label: 'High',
                data: ${JSON.stringify(complexityByLanguageData.map(item => item[1].high || 0))},
                backgroundColor: '#f8d7da',
                borderColor: '#842029',
                borderWidth: 1
              },
              {
                label: 'Very High',
                data: ${JSON.stringify(complexityByLanguageData.map(item => item[1].veryHigh || 0))},
                backgroundColor: '#dc3545',
                borderColor: '#b02a37',
                borderWidth: 1
              }
            ]
          },
          options: {
            responsive: true,
            scales: {
              x: {
                stacked: true,
              },
              y: {
                stacked: true,
                beginAtZero: true,
                ticks: {
                  precision: 0
                }
              }
            }
          }
        });
      }
      
      // Complexity vs Size scatter chart
      const complexitySizeCtx = document.getElementById('complexitySizeChart');
      if (complexitySizeCtx) {
        const complexityValues = {
          'low': 1,
          'medium': 2,
          'high': 3,
          'very high': 4
        };
        
        const scatterData = ${JSON.stringify(stats.mostComplexFiles)}.map(file => ({
          x: file.size || 0,
          y: complexityValues[file.complexity.complexity] || 0,
          r: Math.min(20, Math.max(5, file.complexity.lines / 50)),
          file: file.path,
          language: file.language,
          complexity: file.complexity.complexity
        }));
        
        new Chart(complexitySizeCtx, {
          type: 'bubble',
          data: {
            datasets: [{
              label: 'Files',
              data: scatterData,
              backgroundColor: function(context) {
                const value = context.raw.y;
                if (value === 4) return 'rgba(220, 53, 69, 0.7)';
                if (value === 3) return 'rgba(248, 215, 218, 0.7)';
                if (value === 2) return 'rgba(255, 243, 205, 0.7)';
                return 'rgba(209, 231, 221, 0.7)';
              },
              borderColor: function(context) {
                const value = context.raw.y;
                if (value === 4) return '#b02a37';
                if (value === 3) return '#842029';
                if (value === 2) return '#664d03';
                return '#0f5132';
              },
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            scales: {
              x: {
                type: 'logarithmic',
                title: {
                  display: true,
                  text: 'File Size (bytes)'
                }
              },
              y: {
                min: 0.5,
                max: 4.5,
                ticks: {
                  callback: function(value) {
                    if (value === 1) return 'Low';
                    if (value === 2) return 'Medium';
                    if (value === 3) return 'High';
                    if (value === 4) return 'Very High';
                    return '';
                  }
                },
                title: {
                  display: true,
                  text: 'Complexity'
                }
              }
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const data = context.raw;
                    return [
                      `File: \${data.file}`,
                      `Language: \${data.language}`,
                      `Complexity: \${data.complexity}`,
                      `Size: \${formatBytes(data.x)}`
                    ];
                  }
                }
              }
            }
          }
        });
      }
    }
    
    // Helper function to format bytes
    function formatBytes(bytes, decimals = 2) {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
  </script>
</body>
</html>`;

  return html;
}

/**
 * Helper function to get all files with complexity metrics
 * @private
 */
function getAllFilesWithComplexity(structure) {
  const files = [];
  
  function traverse(node) {
    if (node.type === 'file' && node.complexity) {
      files.push(node);
    } else if (node.type === 'directory' && node.children) {
      node.children.forEach(traverse);
    }
  }
  
  traverse(structure);
  return files;
}

/**
 * Helper function to render tree view HTML
 * @private
 */
function renderTreeView(structure, options) {
  let html = '<div class="tree-controls">';
  html += '<button onclick="expandAll()">Expand All</button>';
  html += '<button onclick="collapseAll()">Collapse All</button>';
  html += '</div>';
  
  function traverse(node, level = 0) {
    const indent = '  '.repeat(level);
    
    if (node.type === 'directory') {
      html += `<div class="tree-item">`;
      html += `<div class="tree-directory">${node.name}/</div>`;
      html += `<div class="tree-children">`;
      
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => traverse(child, level + 1));
      }
      
      html += `</div>`;
      html += `</div>`;
    } else {
      let fileInfo = node.name;
      
      if (options.includeSize && node.sizeFormatted) {
        fileInfo += ` (${node.sizeFormatted})`;
      }
      
      if (options.includeComplexity && node.complexity) {
        fileInfo += ` <span class="complexity-badge complexity-${node.complexity.complexity.replace(' ', '-')}">${node.complexity.complexity}</span>`;
      }
      
      html += `<div class="tree-item tree-file">${fileInfo}</div>`;
    }
  }
  
  traverse(structure);
  return html;
}

/**
 * Watch a directory for changes and call a callback when changes are detected
 * @param {string} dirPath - The directory path to watch
 * @param {Function} callback - Function to call when changes are detected
 * @param {Object} options - Watch options
 * @returns {Object} - Watcher object with stop() method
 */
function watchStructure(dirPath, callback, options = {}) {
  const fs = require("fs")
  const chokidar = require("chokidar")

  const opts = {
    ...defaultOptions,
    ...options,
    debounceTime: options.debounceTime || 300,
  }

  let timeout = null
  let initialScan = true

  // Create a watcher
  const watcher = chokidar.watch(dirPath, {
    ignored: [
      ...opts.ignoreDirs.map((dir) => `**/${dir}/**`),
      ...opts.ignoreFiles,
      ...opts.ignoreExtensions.map((ext) => `**/*.${ext}`),
    ],
    persistent: true,
    ignoreInitial: false,
    depth: opts.maxDepth === Number.POSITIVE_INFINITY ? undefined : opts.maxDepth,
  })

  // Debounced callback to avoid multiple rapid updates
  const updateStructure = () => {
    clearTimeout(timeout)
    timeout = setTimeout(async () => {
      try {
        const structure = await extractStructure(dirPath, opts)
        callback(null, structure, { initialScan })
        initialScan = false
      } catch (error) {
        callback(error)
      }
    }, opts.debounceTime)
  }

  // Watch for changes
  watcher.on("all", (event, path) => {
    updateStructure()
  })

  // Handle errors
  watcher.on("error", (error) => {
    callback(error)
  })

  // Return control object
  return {
    stop: () => {
      watcher.close()
      clearTimeout(timeout)
    },
  }
}

// Helper functions

/**
 * Format a size in bytes to a human-readable string
 * @private
 */
function formatSize(bytes) {
  if (bytes === 0) return "0 B"

  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

/**
 * Calculate MD5 hash of a file
 * @private
 */
async function getFileHash(filePath) {
  try {
    const content = await fs.readFile(filePath)
    return createHash("md5").update(content).digest("hex")
  } catch (error) {
    return null
  }
}

/**
 * Convert a structure to a flat path map
 * @private
 */
function structureToPathMap(structure) {
  const map = {}

  function traverse(node) {
    map[node.relativePath] = node

    if (node.type === "directory" && node.children) {
      node.children.forEach(traverse)
    }
  }

  traverse(structure)
  return map
}

/**
 * Detect programming language based on file extension and content
 * @private
 */
function detectLanguage(filename, extension, content) {
  // Simple language detection based on extension
  const extensionMap = {
    js: "JavaScript",
    jsx: "JavaScript (React)",
    ts: "TypeScript",
    tsx: "TypeScript (React)",
    py: "Python",
    rb: "Ruby",
    java: "Java",
    php: "PHP",
    c: "C",
    cpp: "C++",
    cs: "C#",
    go: "Go",
    rs: "Rust",
    swift: "Swift",
    kt: "Kotlin",
    dart: "Dart",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    less: "Less",
    json: "JSON",
    md: "Markdown",
    yml: "YAML",
    yaml: "YAML",
    xml: "XML",
    sh: "Shell",
    bat: "Batch",
    ps1: "PowerShell",
  }

  // Check for specific file patterns
  if (filename === "Dockerfile") return "Dockerfile"
  if (filename === "Makefile") return "Makefile"
  if (filename.endsWith(".config.js")) return "JavaScript (Config)"
  if (filename.endsWith(".test.js") || filename.endsWith(".spec.js")) return "JavaScript (Test)"

  // Check content for shebang
  if (content && content.startsWith("#!/")) {
    if (content.startsWith("#!/usr/bin/env node")) return "JavaScript"
    if (content.startsWith("#!/usr/bin/env python")) return "Python"
    if (content.startsWith("#!/bin/bash") || content.startsWith("#!/bin/sh")) return "Shell"
    if (content.startsWith("#!/usr/bin/perl")) return "Perl"
    if (content.startsWith("#!/usr/bin/ruby")) return "Ruby"
  }

  return extensionMap[extension] || null
}

/**
 * Analyze code complexity based on file content
 * @param {string} content - File content
 * @param {string} language - Detected language
 * @returns {Object} - Complexity metrics
 */
function analyzeCodeComplexity(content, language) {
  if (!content) return null;

  const metrics = {
    lines: 0,
    codeLines: 0,
    commentLines: 0,
    blankLines: 0,
    complexity: "low",
  };

  // Count lines
  const lines = content.split("\n");
  metrics.lines = lines.length;

  // Count blank lines
  metrics.blankLines = lines.filter((line) => line.trim() === "").length;

  // Language-specific analysis
  switch (language) {
    case "JavaScript":
    case "JavaScript (React)":
    case "JavaScript (Config)":
    case "JavaScript (Test)":
    case "TypeScript":
    case "TypeScript (React)":
      return analyzeJavaScript(content, metrics);
    case "Python":
      return analyzePython(content, metrics);
    case "Java":
    case "C":
    case "C++":
    case "C#":
      return analyzeCStyle(content, metrics);
    default:
      // Basic analysis for other languages
      metrics.codeLines = metrics.lines - metrics.blankLines;
      return calculateComplexity(metrics);
  }
}

/**
 * Analyze JavaScript/TypeScript code
 * @private
 */
function analyzeJavaScript(content, metrics) {
  let inBlockComment = false;
  let commentLines = 0;
  let codeLines = 0;

  // Count functions and classes
  const functionMatches = content.match(/function\s+\w+\s*$$|\(\s*$$\s*=>|\w+\s*$$\s*$$\s*{/g) || [];
  const classMatches = content.match(/class\s+\w+/g) || [];
  let complexityFactors = functionMatches.length + classMatches.length;

  // Analyze lines
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === "") continue;

    if (inBlockComment) {
      commentLines++;
      if (trimmedLine.includes("*/")) {
        inBlockComment = false;
      }
    } else if (trimmedLine.startsWith("//")) {
      commentLines++;
    } else if (trimmedLine.startsWith("/*")) {
      commentLines++;
      if (!trimmedLine.includes("*/")) {
        inBlockComment = true;
      }
    } else {
      codeLines++;

      // Check for inline comments
      if (trimmedLine.includes("//")) {
        commentLines++;
      }
    }
  }

  metrics.commentLines = commentLines;
  metrics.codeLines = codeLines;
  metrics.functions = functionMatches.length;
  metrics.classes = classMatches.length;

  // Calculate cyclomatic complexity (simplified)
  const conditionalsCount = (content.match(/if\s*\(|else|switch|case|for\s*\(|while\s*\(|catch\s*\(/g) || []).length;
  metrics.conditionals = conditionalsCount;

  // Calculate complexity score
  const complexityScore = complexityFactors * 2 + conditionalsCount;

  if (complexityScore > 50) {
    metrics.complexity = "very high";
  } else if (complexityScore > 30) {
    metrics.complexity = "high";
  } else if (complexityScore > 15) {
    metrics.complexity = "medium";
  } else {
    metrics.complexity = "low";
  }

  return metrics;
}

/**
 * Analyze Python code
 * @private
 */
function analyzePython(content, metrics) {
  let commentLines = 0;
  let codeLines = 0;
  let inMultilineString = false;

  // Count functions and classes
  const functionMatches = content.match(/def\s+\w+\s*\(/g) || [];
  const classMatches = content.match(/class\s+\w+/g) || [];
  let complexityFactors = functionMatches.length + classMatches.length;

  // Analyze  || [];
  // Analyze lines
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === "") continue;

    if (inMultilineString) {
      if (trimmedLine.includes('"""') || trimmedLine.includes("'''")) {
        inMultilineString = false;
        commentLines++;
      } else {
        commentLines++;
      }
    } else if (trimmedLine.startsWith("#")) {
      commentLines++;
    } else if (
      (trimmedLine.startsWith('"""') || trimmedLine.startsWith("'''")) &&
      !(trimmedLine.endsWith('"""') && trimmedLine.length > 3) &&
      !(trimmedLine.endsWith("'''") && trimmedLine.length > 3)
    ) {
      commentLines++;
      inMultilineString = true;
    } else {
      codeLines++;

      // Check for inline comments
      if (trimmedLine.includes("#")) {
        commentLines++;
      }
    }
  }

  metrics.commentLines = commentLines;
  metrics.codeLines = codeLines;
  metrics.functions = functionMatches.length;
  metrics.classes = classMatches.length;

  // Calculate cyclomatic complexity (simplified)
  const conditionalsCount = (content.match(/if\s+|elif\s+|else:|for\s+|while\s+|except\s+/g) || []).length;
  metrics.conditionals = conditionalsCount;

  // Calculate complexity score
  const complexityScore = complexityFactors * 2 + conditionalsCount;

  if (complexityScore > 50) {
    metrics.complexity = "very high";
  } else if (complexityScore > 30) {
    metrics.complexity = "high";
  } else if (complexityScore > 15) {
    metrics.complexity = "medium";
  } else {
    metrics.complexity = "low";
  }

  return metrics;
}

/**
 * Analyze C-style code (C, C++, Java, C#)
 * @private
 */
function analyzeCStyle(content, metrics) {
  let inBlockComment = false;
  let commentLines = 0;
  let codeLines = 0;

  // Count functions and classes
  const functionMatches = content.match(/\w+\s+\w+\s*$$[^)]*$$\s*{/g) || [];
  const classMatches = content.match(/class\s+\w+/g) || [];
  let complexityFactors = functionMatches.length + classMatches.length;

  // Analyze lines
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === "") continue;

    if (inBlockComment) {
      commentLines++;
      if (trimmedLine.includes("*/")) {
        inBlockComment = false;
      }
    } else if (trimmedLine.startsWith("//")) {
      commentLines++;
    } else if (trimmedLine.startsWith("/*")) {
      commentLines++;
      if (!trimmedLine.includes("*/")) {
        inBlockComment = true;
      }
    } else {
      codeLines++;

      // Check for inline comments
      if (trimmedLine.includes("//")) {
        commentLines++;
      }
    }
  }

  metrics.commentLines = commentLines;
  metrics.codeLines = codeLines;
  metrics.functions = functionMatches.length;
  metrics.classes = classMatches.length;

  // Calculate cyclomatic complexity (simplified)
  const conditionalsCount = (content.match(/if\s*\(|else|switch|case|for\s*\(|while\s*\(|catch\s*\(/g) || []).length;
  metrics.conditionals = conditionalsCount;

  // Calculate complexity score
  const complexityScore = complexityFactors * 2 + conditionalsCount;

  if (complexityScore > 50) {
    metrics.complexity = "very high";
  } else if (complexityScore > 30) {
    metrics.complexity = "high";
  } else if (complexityScore > 15) {
    metrics.complexity = "medium";
  } else {
    metrics.complexity = "low";
  }

  return metrics;
}

/**
 * Calculate complexity based on metrics
 * @private
 */
function calculateComplexity(metrics) {
  // Simple complexity calculation for unknown languages
  if (metrics.lines > 500) {
    metrics.complexity = "high";
  } else if (metrics.lines > 200) {
    metrics.complexity = "medium";
  } else {
    metrics.complexity = "low";
  }

  return metrics;
}

/**
 * Check if complexity level meets the threshold
 * @private
 */
function shouldIncludeComplexity(complexity, threshold) {
  const levels = {
    'low': 1,
    'medium': 2,
    'high': 3,
    'very high': 4
  };
  
  return levels[complexity] >= levels[threshold];
}

module.exports = {
  extractStructure,
  formatAsTree,
  toPaths,
  filter,
  getStats,
  diffStructures,
  exportToMarkdown,
  exportToHtml, // Export the new HTML function
  watchStructure,
  analyzeCodeComplexity,
}