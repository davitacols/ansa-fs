# ansa-fs

A lightweight and flexible Node.js package to extract and visualize file system structures.

## Features

- **Core Functionality**
  - Extract file and directory structures from any directory
  - Visualize as a tree, JSON, or list of paths
  - Configurable depth and filtering options
  - Ignore specific files, directories, or extensions

- **Analysis Tools**
  - Get statistics about your project structure
  - Compare two directory structures and find differences
  - Analyze file content and detect programming languages
  - Calculate file hashes and track modification times

- **Output Options**
  - Export structures to Markdown
  - Watch directories for changes in real-time
  - Use as a CLI tool or programmatically in your Node.js projects

## Installation

### Global Installation (for CLI usage)

```bash
npm install -g ansa-fs
```

### Local Installation (for programmatic usage)

```bash
npm install ansa-fs
```

## CLI Usage

### Basic Usage

```bash
# Scan current directory
ansa-fs

# Scan specific directory
ansa-fs ./src

# Limit depth to 2 levels
ansa-fs --depth 2 ./my-project

# Ignore specific directories
ansa-fs --ignore node_modules --ignore .git
```

### Output Options

```bash
# Output as JSON
ansa-fs --json

# Output as a list of paths
ansa-fs --paths

# Show statistics
ansa-fs --stats

# Export as Markdown
ansa-fs --markdown

# Write output to a file
ansa-fs --output structure.json --json
```

### Advanced Features

```bash
# Include file sizes
ansa-fs --size

# Include modification times
ansa-fs --mod-time

# Include file hashes
ansa-fs --hash

# Include file contents (for small text files)
ansa-fs --content

# Detect programming languages
ansa-fs --detect-language

# Compare two directories
ansa-fs --diff ./other-dir

# Watch for changes
ansa-fs --watch
```

## Programmatic Usage

### Basic Usage

```javascript
const { extractStructure, formatAsTree } = require('@davitacols/ansa-fs');

async function example() {
  // Extract the structure of a directory
  const structure = await extractStructure('./my-project');
  
  // Format and print as a tree
  console.log(formatAsTree(structure));
}

example();
```

### With Custom Options

```javascript
const { extractStructure } = require('@davitacols/ansa-fs');

async function example() {
  const structure = await extractStructure('./my-project', {
    maxDepth: 3,                               // Only go 3 levels deep
    ignoreDirs: ['node_modules', '.git', 'dist'], // Directories to ignore
    ignoreFiles: ['.DS_Store'],                // Files to ignore
    ignoreExtensions: ['log', 'tmp'],          // Extensions to ignore
    showFiles: true,                           // Include files (not just directories)
    includeSize: true,                         // Include file and directory sizes
    includeHash: true,                         // Include file hashes
    includeModTime: true,                      // Include modification times
    includeContent: true,                      // Include file contents
    detectLanguage: true,                      // Detect programming languages
  });
  
  console.log(JSON.stringify(structure, null, 2));
}

example();
```

### Working with the Structure

```javascript
const { 
  extractStructure, 
  getStats, 
  filter, 
  toPaths, 
  diffStructures,
  exportToMarkdown,
  watchStructure
} = require('@davitacols/ansa-fs');

async function example() {
  const structure = await extractStructure('./my-project');
  
  // Get statistics
  const stats = getStats(structure);
  console.log(`Total directories: ${stats.directories}`);
  console.log(`Total files: ${stats.files}`);
  console.log(`Total size: ${stats.totalSizeFormatted}`);
  
  // Filter the structure
  const jsFiles = filter(structure, (node) => {
    if (node.type === 'directory') return true; // Keep all directories
    return node.extension === 'js'; // Only keep .js files
  });
  
  // Get paths
  const paths = toPaths(structure);
  paths.forEach(path => console.log(path));
  
  // Compare with another directory
  const otherStructure = await extractStructure('./other-project');
  const diff = diffStructures(structure, otherStructure);
  console.log(`Added: ${diff.added.length}`);
  console.log(`Removed: ${diff.removed.length}`);
  console.log(`Modified: ${diff.modified.length}`);
  
  // Export to Markdown
  const markdown = exportToMarkdown(structure, {
    title: 'My Project Structure',
    includeStats: true,
    includeSize: true,
  });
  
  // Watch for changes
  const watcher = watchStructure('./my-project', (error, updatedStructure) => {
    if (error) {
      console.error('Error:', error.message);
      return;
    }
    
    console.log('Directory structure updated!');
    console.log(formatAsTree(updatedStructure));
  });
  
  // Stop watching after 1 minute
  setTimeout(() => {
    watcher.stop();
    console.log('Stopped watching');
  }, 60000);
}

example();
```

## API Reference

### Main Functions

| Function | Description |
|----------|-------------|
| `extractStructure(dirPath, options)` | Extract the file structure of a directory |
| `formatAsTree(structure, options)` | Format the structure as a tree string |
| `toPaths(structure, options)` | Convert the structure to an array of paths |
| `filter(structure, predicate)` | Filter the structure based on a predicate function |
| `getStats(structure)` | Get statistics about the structure |
| `diffStructures(structureA, structureB, options)` | Compare two directory structures |
| `exportToMarkdown(structure, options)` | Export the structure to Markdown |
| `watchStructure(dirPath, callback, options)` | Watch a directory for changes |

### Structure Object Format

```javascript
{
  name: "project-name",
  path: "/absolute/path/to/project-name",
  relativePath: "project-name",
  type: "directory",
  children: [
    {
      name: "src",
      path: "/absolute/path/to/project-name/src",
      relativePath: "project-name/src",
      type: "directory",
      children: [
        {
          name: "index.js",
          path: "/absolute/path/to/project-name/src/index.js",
          relativePath: "project-name/src/index.js",
          type: "file",
          extension: "js",
          size: 1024,                      // If includeSize is true
          sizeFormatted: "1.00 KB",        // If includeSize is true
          modTime: Date,                   // If includeModTime is true
          modTimeFormatted: "2023-01-01T...", // If includeModTime is true
          hash: "d41d8cd98f00b204e9800998ecf8427e", // If includeHash is true
          content: "...",                  // If includeContent is true
          language: "JavaScript"           // If detectLanguage is true
        }
      ]
    }
  ]
}
```

## License

MIT

## Author

David Ansa <davitacols@gmail.com>