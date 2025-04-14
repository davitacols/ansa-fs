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
          if (options.includeContent && stats.size <= options.contentMaxSize) {
            try {
              const content = await fs.readFile(childAbsolutePath, "utf8")
              fileNode.content = content

              // Detect language if requested
              if (options.detectLanguage) {
                fileNode.language = detectLanguage(entry, extension, content)
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
      paths.push(nodePath)
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
  markdown += "```\n"
  markdown += formatAsTree(structure, { showSize: opts.includeSize })
  markdown += "```\n\n"

  return markdown
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

module.exports = {
  extractStructure,
  formatAsTree,
  toPaths,
  filter,
  getStats,
  diffStructures,
  exportToMarkdown,
  watchStructure,
}
