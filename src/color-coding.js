// colorCoding.js
const chalk = require('chalk');

/**
 * Maps file extensions to colors
 * @type {Object}
 */
const extensionColorMap = {
  // Configuration files
  json: chalk.yellow,
  yaml: chalk.yellow,
  yml: chalk.yellow,
  toml: chalk.yellow,
  ini: chalk.yellow,
  
  // Web files
  html: chalk.magenta,
  css: chalk.cyan,
  scss: chalk.cyan,
  less: chalk.cyan,
  
  // JavaScript ecosystem
  js: chalk.green,
  jsx: chalk.green,
  ts: chalk.blue,
  tsx: chalk.blue,
  
  // Server-side
  php: chalk.magenta,
  py: chalk.blue,
  rb: chalk.red,
  java: chalk.red,
  go: chalk.cyan,
  rs: chalk.red,
  
  // Documentation
  md: chalk.white,
  txt: chalk.white,
  
  // Images
  png: chalk.magenta,
  jpg: chalk.magenta,
  jpeg: chalk.magenta,
  gif: chalk.magenta,
  svg: chalk.magenta,
  
  // Compiled/binary
  exe: chalk.red,
  dll: chalk.red,
  so: chalk.red,
  class: chalk.red,
  
  // Default
  default: chalk.white
};

/**
 * Maps file size ranges to colors
 * @param {Number} size - File size in bytes
 * @returns {Function} - Chalk color function
 */
const getSizeColor = (size) => {
  if (size === undefined) return chalk.white;
  
  const kb = size / 1024;
  
  if (kb < 10) return chalk.green;        // < 10KB (small)
  if (kb < 100) return chalk.blue;        // 10-100KB (medium)
  if (kb < 1024) return chalk.yellow;     // 100KB-1MB (large)
  if (kb < 10 * 1024) return chalk.red;   // 1MB-10MB (very large)
  return chalk.bgRed.white;               // > 10MB (huge)
};

/**
 * Gets color function for a directory
 * @param {Object} dir - Directory node
 * @returns {Function} - Chalk color function
 */
const getDirectoryColor = (dir) => {
  if (!dir || dir.type !== 'directory') return chalk.blue.bold;
  
  // If we have size information, we can color based on directory size
  if (dir.size !== undefined) {
    const mb = dir.size / (1024 * 1024);
    
    if (mb < 0.1) return chalk.blue.bold;        // < 100KB
    if (mb < 1) return chalk.cyan.bold;          // 100KB-1MB
    if (mb < 10) return chalk.green.bold;        // 1MB-10MB
    if (mb < 100) return chalk.yellow.bold;      // 10MB-100MB
    if (mb < 1000) return chalk.magenta.bold;    // 100MB-1GB
    return chalk.red.bold;                       // > 1GB
  }
  
  return chalk.blue.bold;
};

/**
 * Gets color function for a file based on extension
 * @param {Object} file - File node
 * @returns {Function} - Chalk color function
 */
const getFileColor = (file) => {
  if (!file || file.type !== 'file') return extensionColorMap.default;
  
  const extension = file.extension ? file.extension.toLowerCase() : '';
  return extensionColorMap[extension] || extensionColorMap.default;
};

/**
 * Applies color to node name based on config
 * @param {Object} node - Structure node (file or directory)
 * @param {Object} options - Color options
 * @returns {string} - Colored string
 */
const colorize = (node, options = {}) => {
  if (!node) return '';
  
  const {
    colorBy = 'type', // 'type', 'size', or 'none'
    useColors = true
  } = options;
  
  if (!useColors) return node.name;
  
  if (colorBy === 'size' && node.size !== undefined) {
    return getSizeColor(node.size)(node.name);
  }
  
  if (colorBy === 'type') {
    if (node.type === 'directory') {
      return getDirectoryColor(node)(node.name);
    } else {
      return getFileColor(node)(node.name);
    }
  }
  
  return node.name;
};

module.exports = {
  colorize,
  getFileColor,
  getDirectoryColor,
  getSizeColor,
  extensionColorMap
};