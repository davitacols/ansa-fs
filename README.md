I'll update the README to include the new HTML visualization functionality we added to the CLI tool.

```markdown project="File System Analyzer" file="README.md"
...
```

### Local Installation (for programmatic usage)

```shellscript
npm install ansa-fs
```

## CLI Usage

### Basic Usage

```shellscript
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

```shellscript
# Output as JSON
ansa-fs --json

# Output as a list of paths
ansa-fs --paths

# Show statistics
ansa-fs --stats

# Export as Markdown
ansa-fs --markdown

# NEW: Export as interactive HTML
ansa-fs --html

# NEW: Export as interactive HTML with dark mode
ansa-fs --html --dark-mode

# Write output to a file
ansa-fs --output structure.json --json

# Generate HTML report
ansa-fs --html --output report.html
```

### Advanced Features

```shellscript
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

# NEW: Analyze code complexity
ansa-fs --analyze-complexity

# NEW: Set complexity threshold
ansa-fs --analyze-complexity --complexity-threshold medium

# NEW: Include detailed complexity metrics
ansa-fs --analyze-complexity --detailed-complexity

# Compare two directories
ansa-fs --diff ./other-dir

# Watch for changes
ansa-fs --watch
```

### Code Complexity Analysis

The new code complexity analysis feature examines source code files and provides metrics on:

```shellscript
# Generate a complete code complexity report in HTML format
ansa-fs --analyze-complexity --html --output complexity-report.html

# Show only high complexity files in the terminal
ansa-fs --analyze-complexity --complexity-threshold high --stats
```

The complexity analysis supports:

- JavaScript/TypeScript (including React)
- Python
- Java
- C/C++/C#
- And more languages with basic analysis


## Programmatic Usage

### Basic Usage

```javascript
const { extractStructure, formatAsTree } = require('ansa-fs');

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
const { extractStructure } = require('ansa-fs');

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
    analyzeComplexity: true,                   // NEW: Analyze code complexity
    complexityThreshold: "medium",             // NEW: Minimum complexity level to report
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
  exportToHtml,  // NEW: HTML export function
  watchStructure
} = require('ansa-fs');

async function example() {
  const structure = await extractStructure('./my-project', {
    analyzeComplexity: true,
    includeSize: true
  });
  
  // Get statistics
  const stats = getStats(structure);
  console.log(`Total directories: ${stats.directories}`);
  console.log(`Total files: ${stats.files}`);
  console.log(`Total size: ${stats.totalSizeFormatted}`);
  
  // NEW: Get complexity statistics
  console.log(`Low complexity files: ${stats.complexityStats.low}`);
  console.log(`Medium complexity files: ${stats.complexityStats.medium}`);
  console.log(`High complexity files: ${stats.complexityStats.high}`);
  console.log(`Very high complexity files: ${stats.complexityStats.veryHigh}`);
  
  // Filter the structure
  const complexFiles = filter(structure, (node) => {
    if (node.type === 'directory') return true; // Keep all directories
    return node.complexity && 
      (node.complexity.complexity === 'high' || 
       node.complexity.complexity === 'very high'); // Only keep complex files
  });
  
  // Get paths
  const paths = toPaths(structure, { includeComplexity: true });
  paths.forEach(path => console.log(path));
  
  // Compare with another directory
  const otherStructure = await extractStructure('./other-project', { analyzeComplexity: true });
  const diff = diffStructures(structure, otherStructure, { compareComplexity: true });
  console.log(`Added: ${diff.added.length}`);
  console.log(`Removed: ${diff.removed.length}`);
  console.log(`Modified: ${diff.modified.length}`);
  
  // Export to Markdown
  const markdown = exportToMarkdown(structure, {
    title: 'My Project Structure',
    includeStats: true,
    includeSize: true,
    includeComplexity: true,
    includeDetailedComplexity: true
  });
  
  // NEW: Export to HTML
  const html = exportToHtml(structure, {
    title: 'Code Complexity Analysis',
    includeStats: true,
    includeSize: true,
    includeComplexity: true,
    includeDetailedComplexity: true,
    darkMode: false
  });
  
  // Save HTML report
  const fs = require('fs');
  fs.writeFileSync('complexity-report.html', html);
  
  // Watch for changes
  const watcher = watchStructure('./my-project', (error, updatedStructure) => {
    if (error) {
      console.error('Error:', error.message);
      return;
    }
    
    console.log('Directory structure updated!');
    console.log(formatAsTree(updatedStructure, { showComplexity: true }));
  }, { analyzeComplexity: true });
  
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

| Function | Description
|-----|-----
| `extractStructure(dirPath, options)` | Extract the file structure of a directory
| `formatAsTree(structure, options)` | Format the structure as a tree string
| `toPaths(structure, options)` | Convert the structure to an array of paths
| `filter(structure, predicate)` | Filter the structure based on a predicate function
| `getStats(structure)` | Get statistics about the structure
| `diffStructures(structureA, structureB, options)` | Compare two directory structures
| `exportToMarkdown(structure, options)` | Export the structure to Markdown
| `exportToHtml(structure, options)` | NEW: Export the structure to interactive HTML
| `watchStructure(dirPath, callback, options)` | Watch a directory for changes
| `analyzeCodeComplexity(content, language)` | NEW: Analyze code complexity of a file


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
          language: "JavaScript",          // If detectLanguage is true
          complexity: {                    // NEW: If analyzeComplexity is true
            complexity: "medium",          // Overall complexity rating
            lines: 120,                    // Total lines
            codeLines: 100,                // Lines of code
            commentLines: 15,              // Lines of comments
            blankLines: 5,                 // Blank lines
            functions: 5,                  // Number of functions
            classes: 1,                    // Number of classes
            conditionals: 8                // Number of conditional statements
          }
        }
      ]
    }
  ]
}
```

### HTML Report Features

The new HTML report includes:

- Interactive file browser with expandable directories
- Complexity distribution chart
- Language distribution chart
- Complexity by language chart
- Complexity vs file size visualization
- Sortable and filterable table of complex files
- Dark/light mode toggle
- Responsive design for desktop and mobile


## License

MIT

## Author

David Ansa `<davitacols@gmail.com>`

```plaintext

The updated README now includes comprehensive information about the new HTML visualization and code complexity analysis features we added to the CLI tool. I've highlighted these new features with "NEW" labels to make them stand out, and I've added detailed sections explaining how to use them both from the CLI and programmatically.

<Actions>
  <Action name="Add screenshots to README" description="Add screenshots of the HTML report to make the README more visual" />
  <Action name="Create a demo website" description="Create a simple demo website showcasing the HTML reports" />
  <Action name="Add examples directory" description="Create an examples directory with sample code" />
  <Action name="Write a blog post" description="Write a blog post introducing the tool and its features" />
  <Action name="Create video tutorial" description="Create a short video tutorial demonstrating the tool" />
</Actions>


```