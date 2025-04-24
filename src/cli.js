#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import chokidar from 'chokidar';

// Add code complexity analyzer
const analyzeCodeComplexity = (content, language) => {
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
};

// Analyze JavaScript/TypeScript code
function analyzeJavaScript(content, metrics) {
  let inBlockComment = false;
  let commentLines = 0;
  let codeLines = 0;

  // Count functions and classes
  const functionMatches = content.match(/function\s+\w+\s*$$|\(\s*$$\s*=>|\w+\s*$$\s*$$\s*{/g) || [];
  const classMatches = content.match(/class\s+\w+/g) || [];
  const complexityFactors = functionMatches.length + classMatches.length;

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
  const conditionals = (content.match(/if\s*\(|else|switch|case|for\s*\(|while\s*\(|catch\s*\(/g) || []).length;
  metrics.conditionals = conditionals;

  // Calculate complexity score
  const complexityScore = complexityFactors * 2 + conditionals;

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

// Analyze Python code
function analyzePython(content, metrics) {
  let commentLines = 0;
  let codeLines = 0;
  let inMultilineString = false;

  // Count functions and classes
  const functionMatches = content.match(/def\s+\w+\s*\(/g) || [];
  const classMatches = content.match(/class\s+\w+/g) || [];
  const complexityFactors = functionMatches.length + classMatches.length;

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
  const conditionals = (content.match(/if\s+|elif\s+|else:|for\s+|while\s+|except\s+/g) || []).length;
  metrics.conditionals = conditionals;

  // Calculate complexity score
  const complexityScore = complexityFactors * 2 + conditionals;

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

// Analyze C-style code (C, C++, Java, C#)
function analyzeCStyle(content, metrics) {
  let inBlockComment = false;
  let commentLines = 0;
  let codeLines = 0;

  // Count functions and classes
  const functionMatches = content.match(/\w+\s+\w+\s*$$[^)]*$$\s*{/g) || [];
  const classMatches = content.match(/class\s+\w+/g) || [];
  const complexityFactors = functionMatches.length + classMatches.length;

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
  const conditionals = (content.match(/if\s*\(|else|switch|case|for\s*\(|while\s*\(|catch\s*\(/g) || []).length;
  metrics.conditionals = conditionals;

  // Calculate complexity score
  const complexityScore = complexityFactors * 2 + conditionals;

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

// Calculate complexity based on metrics
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

// Detect programming language based on file extension
function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.js':
      return 'JavaScript';
    case '.jsx':
      return 'JavaScript (React)';
    case '.ts':
      return 'TypeScript';
    case '.tsx':
      return 'TypeScript (React)';
    case '.py':
      return 'Python';
    case '.java':
      return 'Java';
    case '.c':
      return 'C';
    case '.cpp':
    case '.cc':
    case '.cxx':
      return 'C++';
    case '.cs':
      return 'C#';
    case '.php':
      return 'PHP';
    case '.rb':
      return 'Ruby';
    case '.go':
      return 'Go';
    case '.rs':
      return 'Rust';
    case '.swift':
      return 'Swift';
    case '.kt':
    case '.kts':
      return 'Kotlin';
    default:
      return 'Unknown';
  }
}

// Mock implementation of the required functions for demonstration
const extractStructure = async (directory, options) => {
  // Simplified implementation for demo purposes
  const structure = {
    name: path.basename(directory),
    path: directory,
    type: 'directory',
    children: []
  };
  
  try {
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      const fullPath = path.join(directory, file);
      const stats = fs.statSync(fullPath);
      
      // Skip if it should be ignored
      if (options.ignoreDirs && options.ignoreDirs.includes(file)) continue;
      if (options.ignoreFiles && options.ignoreFiles.includes(file)) continue;
      
      const isDirectory = stats.isDirectory();
      
      // Skip based on file/directory options
      if (isDirectory && !options.showDirs) continue;
      if (!isDirectory && !options.showFiles) continue;
      
      const item = {
        name: file,
        path: fullPath,
        type: isDirectory ? 'directory' : 'file',
      };
      
      // Add optional properties
      if (options.includeSize) {
        item.size = stats.size;
        item.sizeFormatted = formatSize(stats.size);
      }
      
      if (options.includeModTime) {
        item.modTime = stats.mtime;
        item.modTimeFormatted = stats.mtime.toISOString();
      }
      
      // Add code complexity analysis for source files
      if (!isDirectory && options.analyzeComplexity) {
        const language = detectLanguage(fullPath);
        if (language !== 'Unknown') {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            item.complexity = analyzeCodeComplexity(content, language);
            item.language = language;
          } catch (error) {
            console.error(`Error analyzing ${fullPath}: ${error.message}`);
          }
        }
      }
      
      if (isDirectory && options.maxDepth > 1) {
        const subOptions = { ...options, maxDepth: options.maxDepth - 1 };
        const subStructure = await extractStructure(fullPath, subOptions);
        item.children = subStructure.children;
      }
      
      structure.children.push(item);
    }
  } catch (error) {
    console.error(`Error reading directory ${directory}: ${error.message}`);
  }
  
  return structure;
};

const formatAsTree = (structure, options) => {
  // Simplified tree formatting
  const formatNode = (node, prefix = '', isLast = true) => {
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    
    let output = prefix + connector + node.name;
    
    // Add size if requested
    if (options.showSize && node.sizeFormatted) {
      output += ` (${node.sizeFormatted})`;
    }
    
    // Add mod time if requested
    if (options.showModTime && node.modTimeFormatted) {
      output += ` [${node.modTimeFormatted}]`;
    }
    
    // Add complexity if available
    if (options.showComplexity && node.complexity) {
      output += ` - Complexity: ${node.complexity.complexity}`;
      if (node.language) {
        output += ` (${node.language})`;
      }
    }
    
    output += '\n';
    
    if (node.children && node.children.length > 0) {
      node.children.forEach((child, index) => {
        const isChildLast = index === node.children.length - 1;
        output += formatNode(child, prefix + childPrefix, isChildLast);
      });
    }
    
    return output;
  };
  
  return formatNode(structure);
};

const toPaths = (structure, options) => {
  // Convert structure to list of paths
  const paths = [];
  
  const traverse = (node, currentPath) => {
    const nodePath = path.join(currentPath, node.name);
    
    if (node.type === 'directory' && options.includeDirs) {
      paths.push(nodePath);
    } else if (node.type === 'file' && options.includeFiles) {
      let pathInfo = nodePath;
      
      // Add complexity if available
      if (options.includeComplexity && node.complexity) {
        pathInfo += ` (Complexity: ${node.complexity.complexity})`;
      }
      
      paths.push(pathInfo);
    }
    
    if (node.children) {
      node.children.forEach(child => traverse(child, nodePath));
    }
  };
  
  traverse(structure, '');
  return paths;
};

const getStats = (structure) => {
  // Calculate statistics
  const stats = {
    directories: 0,
    files: 0,
    totalSize: 0,
    totalSizeFormatted: '',
    extensions: {},
    largestFiles: [],
    newestFiles: [],
    // Add complexity stats
    complexityStats: {
      low: 0,
      medium: 0,
      high: 0,
      veryHigh: 0
    },
    mostComplexFiles: [],
    languageStats: {}, // Track files by language
    complexityByLanguage: {} // Track complexity by language
  };
  
  const traverse = (node) => {
    if (node.type === 'directory') {
      stats.directories++;
    } else if (node.type === 'file') {
      stats.files++;
      
      if (node.size) {
        stats.totalSize += node.size;
      }
      
      // Track file extension
      const ext = path.extname(node.name).slice(1);
      if (ext) {
        stats.extensions[ext] = (stats.extensions[ext] || 0) + 1;
      }
      
      // Track for largest files
      if (node.size) {
        stats.largestFiles.push({
          path: node.path,
          size: node.size,
          sizeFormatted: node.sizeFormatted
        });
      }
      
      // Track for newest files
      if (node.modTime) {
        stats.newestFiles.push({
          path: node.path,
          modTime: node.modTime,
          modTimeFormatted: node.modTimeFormatted
        });
      }
      
      // Track language stats
      if (node.language) {
        stats.languageStats[node.language] = (stats.languageStats[node.language] || 0) + 1;
      }
      
      // Track complexity stats
      if (node.complexity) {
        const complexity = node.complexity.complexity;
        
        if (complexity === 'very high') {
          stats.complexityStats.veryHigh++;
        } else if (complexity === 'high') {
          stats.complexityStats.high++;
        } else if (complexity === 'medium') {
          stats.complexityStats.medium++;
        } else {
          stats.complexityStats.low++;
        }
        
        // Track complexity by language
        if (node.language) {
          if (!stats.complexityByLanguage[node.language]) {
            stats.complexityByLanguage[node.language] = {
              low: 0,
              medium: 0,
              high: 0,
              veryHigh: 0
            };
          }
          
          const complexityKey = complexity.replace(' ', '');
          stats.complexityByLanguage[node.language][complexityKey] = 
            (stats.complexityByLanguage[node.language][complexityKey] || 0) + 1;
        }
        
        // Track most complex files
        stats.mostComplexFiles.push({
          path: node.path,
          language: node.language,
          complexity: node.complexity,
          size: node.size,
          sizeFormatted: node.sizeFormatted
        });
      }
    }
    
    if (node.children) {
      node.children.forEach(traverse);
    }
  };
  
  traverse(structure);
  
  // Sort and limit arrays
  stats.largestFiles.sort((a, b) => b.size - a.size).slice(0, 10);
  stats.newestFiles.sort((a, b) => b.modTime - a.modTime).slice(0, 10);
  
  // Sort most complex files
  stats.mostComplexFiles.sort((a, b) => {
    const complexityOrder = { 'very high': 4, 'high': 3, 'medium': 2, 'low': 1 };
    return complexityOrder[b.complexity.complexity] - complexityOrder[a.complexity.complexity];
  }).slice(0, 10);
  
  // Format total size
  stats.totalSizeFormatted = formatSize(stats.totalSize);
  
  return stats;
};

const diffStructures = (structure1, structure2, options) => {
  // Compare two structures
  const diff = {
    added: [],
    removed: [],
    modified: [],
    unchanged: []
  };
  
  // Simplified implementation for demo
  console.log("Comparing structures (demo implementation)");
  
  return diff;
};

const exportToMarkdown = (structure, options) => {
  // Export to markdown
  let markdown = `# ${options.title || 'Directory Structure'}\n\n`;
  
  const formatNode = (node, level = 0) => {
    const indent = '  '.repeat(level);
    const prefix = node.type === 'directory' ? '📁 ' : '📄 ';
    
    let line = `${indent}- ${prefix}**${node.name}**`;
    
    if (options.includeSize && node.sizeFormatted) {
      line += ` (${node.sizeFormatted})`;
    }
    
    // Add complexity if available
    if (options.includeComplexity && node.complexity) {
      line += ` - Complexity: **${node.complexity.complexity}**`;
      if (node.language) {
        line += ` (${node.language})`;
      }
      
      // Add detailed complexity metrics
      if (options.includeDetailedComplexity) {
        line += `\n${indent}  - Lines: ${node.complexity.lines}`;
        line += `\n${indent}  - Code Lines: ${node.complexity.codeLines}`;
        line += `\n${indent}  - Comment Lines: ${node.complexity.commentLines}`;
        
        if (node.complexity.functions !== undefined) {
          line += `\n${indent}  - Functions: ${node.complexity.functions}`;
        }
        
        if (node.complexity.classes !== undefined) {
          line += `\n${indent}  - Classes: ${node.complexity.classes}`;
        }
        
        if (node.complexity.conditionals !== undefined) {
          line += `\n${indent}  - Conditionals: ${node.complexity.conditionals}`;
        }
      }
    }
    
    markdown += line + '\n';
    
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => formatNode(child, level + 1));
    }
  };
  
  formatNode(structure);
  
  if (options.includeStats) {
    const stats = getStats(structure);
    markdown += '\n## Statistics\n\n';
    markdown += `- Total directories: ${stats.directories}\n`;
    markdown += `- Total files: ${stats.files}\n`;
    
    if (stats.totalSizeFormatted) {
      markdown += `- Total size: ${stats.totalSizeFormatted}\n`;
    }
    
    // Add complexity statistics
    if (options.includeComplexity) {
      markdown += '\n### Code Complexity\n\n';
      markdown += `- Low complexity: ${stats.complexityStats.low} files\n`;
      markdown += `- Medium complexity: ${stats.complexityStats.medium} files\n`;
      markdown += `- High complexity: ${stats.complexityStats.high} files\n`;
      markdown += `- Very high complexity: ${stats.complexityStats.veryHigh} files\n`;
      
      if (stats.mostComplexFiles.length > 0) {
        markdown += '\n#### Most Complex Files\n\n';
        
        stats.mostComplexFiles.forEach((file, index) => {
          markdown += `${index + 1}. **${file.path}** - ${file.complexity.complexity} (${file.language})\n`;
          markdown += `   - Lines: ${file.complexity.lines}, Code: ${file.complexity.codeLines}, Comments: ${file.complexity.commentLines}\n`;
          
          if (file.complexity.functions !== undefined) {
            markdown += `   - Functions: ${file.complexity.functions}, `;
          }
          
          if (file.complexity.classes !== undefined) {
            markdown += `Classes: ${file.complexity.classes}, `;
          }
          
          if (file.complexity.conditionals !== undefined) {
            markdown += `Conditionals: ${file.complexity.conditionals}\n`;
          } else {
            markdown += '\n';
          }
        });
      }
    }
  }
  
  return markdown;
};

// Add HTML export functionality
const exportToHtml = (structure, options) => {
  const opts = {
    title: "Project Structure Analysis",
    includeStats: true,
    includeSize: true,
    includeComplexity: true,
    includeDetailedComplexity: true,
    darkMode: false,
    ...options,
  };

  const stats = getStats(structure);
  
  // Prepare data for charts
  const complexityData = [
    stats.complexityStats.low,
    stats.complexityStats.medium,
    stats.complexityStats.high,
    stats.complexityStats.veryHigh
  ];
  
  const languageData = Object.entries(stats.languageStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10 languages
  
  const complexityByLanguageData = Object.entries(stats.complexityByLanguage)
    .sort((a, b) => {
      // Sort by total files in language
      const totalA = Object.values(a[1]).reduce((sum, count) => sum + count, 0);
      const totalB = Object.values(b[1]).reduce((sum, count) => sum + count, 0);
      return totalB - totalA;
    })
    .slice(0, 5); // Top 5 languages
  
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
            <td>${file.relativePath || file.path}</td>
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
                    return \`\${label}: \${value} (\${percentage}%)\`;
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
                      \`File: \${data.file}\`,
                      \`Language: \${data.language}\`,
                      \`Complexity: \${data.complexity}\`,
                      \`Size: \${formatBytes(data.x)}\`
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
};

// Helper function to get all files with complexity metrics
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

// Helper function to render tree view HTML
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

const watchStructure = (dirPath, callback, options = {}) => {
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

// Helper function to format file size
const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
};

// Configure CLI
program
  .name("ansa-fs")
  .description("Extract and visualize file system structures")
  .version("1.0.0")
  .argument("[directory]", "directory to scan", ".")
  .option("-d, --depth <number>", "maximum depth to traverse", Number.POSITIVE_INFINITY)
  .option("-i, --ignore <paths...>", "directories or files to ignore")
  .option("-e, --ignore-ext <extensions...>", "file extensions to ignore")
  .option("-f, --files-only", "show only files (no directories)")
  .option("-D, --dirs-only", "show only directories (no files)")
  .option("-j, --json", "output as JSON")
  .option("-p, --paths", "output as a list of paths")
  .option("-s, --stats", "show statistics about the structure")
  .option("--size", "include file and directory sizes")
  .option("--mod-time", "include file modification times")
  .option("--hash", "include file hashes (MD5)")
  .option("--content", "include file contents (for small text files)")
  .option("--detect-language", "detect programming language of files")
  .option("--markdown", "export as Markdown")
  .option("--html", "export as interactive HTML report") // New HTML option
  .option("--dark-mode", "use dark mode for HTML report") // New dark mode option
  .option("--diff <directory>", "compare with another directory")
  .option("--watch", "watch for changes")
  .option("--output <file>", "write output to a file")
  .option("--no-color", "disable colored output")
  // Add new options for code complexity analysis
  .option("--analyze-complexity", "analyze code complexity in source files")
  .option("--complexity-threshold <level>", "minimum complexity level to report (low, medium, high, very high)", "low")
  .option("--detailed-complexity", "include detailed complexity metrics")
  .parse(process.argv);

// Main function
async function main() {
  const options = program.opts();
  const directory = program.args[0] || ".";

  // Configure extraction options
  const extractOptions = {
    maxDepth:
      options.depth === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Number.parseInt(options.depth, 10),
    showFiles: !options.dirsOnly,
    showDirs: !options.filesOnly,
    includeSize: options.size,
    includeHash: options.hash,
    includeModTime: options.modTime,
    includeContent: options.content,
    detectLanguage: options.detectLanguage || options.analyzeComplexity,
    analyzeComplexity: options.analyzeComplexity,
    complexityThreshold: options.complexityThreshold || "low",
    ignoreDirs: ['.git', 'node_modules'],
    ignoreFiles: ['.DS_Store'],
  };

  // Add custom ignore paths
  if (options.ignore) {
    extractOptions.ignoreDirs = [...extractOptions.ignoreDirs, ...options.ignore];
    extractOptions.ignoreFiles = [...extractOptions.ignoreFiles, ...options.ignore];
  }

  // Add custom ignore extensions
  if (options.ignoreExt) {
    extractOptions.ignoreExtensions = options.ignoreExt;
  }

  // Handle watch mode
  if (options.watch) {
    console.log(chalk.cyan(`Watching ${directory} for changes...`));
    console.log(chalk.gray("Press Ctrl+C to stop"));

    const watcher = watchStructure(
      directory,
      (error, structure, meta) => {
        if (error) {
          console.error(chalk.red(`Error: ${error.message}`));
          return;
        }

        // Clear console and show updated structure
        process.stdout.write("\x1Bc");
        console.log(chalk.cyan(`Watching ${directory} for changes...`));
        console.log(chalk.gray("Press Ctrl+C to stop"));

        if (meta.initialScan) {
          console.log(chalk.green("Initial scan complete"));
        } else {
          console.log(chalk.green("Changes detected, updated structure:"));
        }

        outputStructure(structure, options);
      },
      extractOptions,
    );

    // Handle exit
    process.on("SIGINT", () => {
      watcher.stop();
      console.log(chalk.yellow("\nWatcher stopped"));
      process.exit(0);
    });

    return;
  }

  // Handle normal mode
  const spinner = ora("Scanning directory...").start();

  try {
    // Extract structure
    const structure = await extractStructure(directory, extractOptions);
    spinner.succeed("Directory scanned successfully");

    // Handle diff mode
    if (options.diff) {
      spinner.text = "Comparing directories...";
      spinner.start();

      const otherStructure = await extractStructure(options.diff, extractOptions);
      spinner.succeed("Comparison complete");

      const diff = diffStructures(structure, otherStructure, {
        compareContent: options.content,
        compareSize: options.size,
        compareModTime: options.modTime,
        compareComplexity: options.analyzeComplexity,
      });

      outputDiff(diff, options);
    } else {
      // Normal output
      outputStructure(structure, options);
    }
  } catch (error) {
    spinner.fail(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// Output structure based on options
function outputStructure(structure, options) {
  let output = "";

  if (options.json) {
    // JSON output
    output = JSON.stringify(structure, null, 2);
  } else if (options.paths) {
    // Paths output
    const paths = toPaths(structure, {
      includeFiles: !options.dirsOnly,
      includeDirs: !options.filesOnly,
      includeComplexity: options.analyzeComplexity,
    });
    output = paths.join("\n");
  } else if (options.stats) {
    // Stats output
    const stats = getStats(structure);
    output = formatStats(stats, options);
  } else if (options.markdown) {
    // Markdown output
    output = exportToMarkdown(structure, {
      title: `Directory Structure: ${structure.name}`,
      includeStats: true,
      includeSize: options.size,
      includeComplexity: options.analyzeComplexity,
      includeDetailedComplexity: options.detailedComplexity,
    });
  } else if (options.html) {
    // HTML output - new option
    output = exportToHtml(structure, {
      title: `Code Analysis: ${structure.name}`,
      includeStats: true,
      includeSize: options.size,
      includeComplexity: options.analyzeComplexity,
      includeDetailedComplexity: options.detailedComplexity,
      darkMode: options.darkMode,
    });
  } else {
    // Tree output
    output = formatAsTree(structure, {
      showSize: options.size,
      showModTime: options.modTime,
      showComplexity: options.analyzeComplexity,
    });
  }

  // Write to file or stdout
  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(chalk.green(`Output written to ${options.output}`));
  } else {
    console.log(output);
  }
}

// Format stats for display
function formatStats(stats, options) {
  let output = chalk.bold("Directory Statistics:\n\n");

  output += `Total directories: ${stats.directories}\n`;
  output += `Total files: ${stats.files}\n`;

  if (stats.totalSizeFormatted) {
    output += `Total size: ${stats.totalSizeFormatted}\n`;
  }

  // Add complexity statistics if requested
  if (options.analyzeComplexity) {
    output += chalk.bold("\nCode Complexity Statistics:\n");
    output += `Low complexity: ${stats.complexityStats.low} files\n`;
    output += `Medium complexity: ${stats.complexityStats.medium} files\n`;
    output += `High complexity: ${stats.complexityStats.high} files\n`;
    output += `Very high complexity: ${stats.complexityStats.veryHigh} files\n`;
    
    if (stats.mostComplexFiles.length > 0) {
      output += chalk.bold("\nMost Complex Files:\n");
      
      stats.mostComplexFiles.forEach((file, index) => {
        output += `  ${index + 1}. ${file.path} (${file.complexity.complexity})\n`;
        
        if (options.detailedComplexity) {
          output += `     Language: ${file.language}\n`;
          output += `     Lines: ${file.complexity.lines}, Code: ${file.complexity.codeLines}, Comments: ${file.complexity.commentLines}\n`;
          
          if (file.complexity.functions !== undefined) {
            output += `     Functions: ${file.complexity.functions}, `;
          }
          
          if (file.complexity.classes !== undefined) {
            output += `Classes: ${file.complexity.classes}, `;
          }
          
          if (file.complexity.conditionals !== undefined) {
            output += `Conditionals: ${file.complexity.conditionals}\n`;
          } else {
            output += '\n';
          }
        }
      });
    }
  }

  if (Object.keys(stats.extensions).length > 0) {
    output += chalk.bold("\nFile Extensions:\n");

    Object.entries(stats.extensions)
      .sort((a, b) => b[1] - a[1])
      .forEach(([ext, count]) => {
        output += `  .${ext}: ${count} files\n`;
      });
  }

  if (stats.largestFiles.length > 0) {
    output += chalk.bold("\nLargest Files:\n");

    stats.largestFiles.forEach((file, index) => {
      output += `  ${index + 1}. ${file.path} (${file.sizeFormatted})\n`;
    });
  }

  if (stats.newestFiles.length > 0) {
    output += chalk.bold("\nMost Recently Modified Files:\n");

    stats.newestFiles.forEach((file, index) => {
      output += `  ${index + 1}. ${file.path} (${file.modTimeFormatted})\n`;
    });
  }

  return output;
}

// Output diff results
function outputDiff(diff, options) {
  console.log(chalk.bold("\nDirectory Comparison Results:"));

  console.log(chalk.green(`\nAdded (${diff.added.length}):`));
  if (diff.added.length > 0) {
    diff.added.forEach((item) => {
      console.log(`  + ${item.path} (${item.type})`);
    });
  } else {
    console.log("  None");
  }

  console.log(chalk.red(`\nRemoved (${diff.removed.length}):`));
  if (diff.removed.length > 0) {
    diff.removed.forEach((item) => {
      console.log(`  - ${item.path} (${item.type})`);
    });
  } else {
    console.log("  None");
  }

  console.log(chalk.yellow(`\nModified (${diff.modified.length}):`));
  if (diff.modified.length > 0) {
    diff.modified.forEach((item) => {
      console.log(`  ~ ${item.path} (${item.type})`);

      if (item.modifications) {
        Object.entries(item.modifications).forEach(([key, value]) => {
          switch (key) {
            case "typeChanged":
              console.log(`    Type changed: ${value.from} → ${value.to}`);
              break;
            case "sizeChanged":
              console.log(`    Size changed: ${value.fromFormatted} → ${value.toFormatted}`);
              break;
            case "modTimeChanged":
              console.log(`    Modified time changed: ${value.from} → ${value.to}`);
              break;
            case "contentChanged":
              console.log(`    Content changed`);
              break;
            case "hashChanged":
              console.log(`    Hash changed: ${value.from.substring(0, 8)} → ${value.to.substring(0, 8)}`);
              break;
            case "complexityChanged":
              console.log(`    Complexity changed: ${value.from} → ${value.to}`);
              break;
          }
        });
      }
    });
  } else {
    console.log("  None");
  }

  console.log(chalk.cyan(`\nUnchanged: ${diff.unchanged.length} items`));

  // Write to file if requested
  if (options.output) {
    const output = JSON.stringify(diff, null, 2);
    fs.writeFileSync(options.output, output);
    console.log(chalk.green(`\nDetailed diff written to ${options.output}`));
  }
}

// Run the CLI
console.log(chalk.bold("Enhanced File System Analyzer"));
console.log(chalk.gray("File system analyzer with code complexity visualization"));

// Run with current directory

// Default options for watching
const defaultOptions = {
  maxDepth: Number.POSITIVE_INFINITY,
  showFiles: true,
  showDirs: true,
  includeSize: false,
  includeHash: false,
  includeModTime: false,
  includeContent: false,
  detectLanguage: false,
  analyzeComplexity: false,
  complexityThreshold: "low",
  ignoreDirs: [".git", "node_modules"],
  ignoreFiles: [".DS_Store"],
  ignoreExtensions: [],
  debounceTime: 300,
}

main().catch((error) => {
  console.error(chalk.red(`Error: ${error.message}`));
  process.exit(1);
});