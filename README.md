# ansa-fs

A lightweight and flexible Node.js package to extract and visualize file system structures with advanced code analysis.

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
  - Analyze code complexity across multiple languages
  - Generate interactive HTML reports with visualizations

- **Advanced Analysis**
  - **Code Duplication Detection**: Find duplicate or similar code blocks
  - **Dependency Graph Visualization**: Analyze and visualize project dependencies
  - **Technical Debt Analysis**: Identify TODOs, complex files, and outdated patterns
  - **Git History Analysis**: Understand file evolution and contributor patterns
  - **NEW: Automatic Documentation Generation**: Create comprehensive project documentation

- **Output Options**
  - Export structures to Markdown
  - Export to interactive HTML with charts and visualizations
  - Watch directories for changes in real-time
  - Use as a CLI tool or programmatically in your Node.js projects

## Installation

### Global Installation (for CLI usage)

```bash
npm install -g ansa-fs
```
### Adding Automatic Project Documentation Feature

Let's add a powerful documentation generator to automatically document projects in both Markdown and HTML formats. This feature will help users quickly understand the projects they're working on.

## 1. Create the Documentation Analyzer

First, let's create a new analyzer module for documentation generation:

```javascript project="File System Analyzer" file="src/analyzers/documentation-analyzer.js"
...
```

I found some issues in the code block.

- unexpected token `\`


I will fix them.

```javascript project="File System Analyzer" file="src/analyzers/documentation-analyzer.js"
...
```

I found some issues in the code block.

- Expected an expression but instead found '<'.


I will fix them.

```javascript project="File System Analyzer" file="src/analyzers/documentation-analyzer.js"
...
```

## 2. Update the CLI to Support Documentation Generation

Now, let's update the CLI to support the new documentation generation feature:

```javascript project="File System Analyzer" file="src/cli.js"
...
```

I found some issues in the code block.

- The program variable is undeclared.
- The options variable is undeclared.
- The spinner variable is undeclared.
- The structure variable is undeclared.
- The fs variable is undeclared.


I will fix them.

```javascript project="File System Analyzer" file="src/cli.js"
...
```

## 3. Update the index.js to Export the Documentation Analyzer

```javascript project="File System Analyzer" file="src/index.js"
...
```

## 4. Update the README.md with Documentation Feature

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

# Export as interactive HTML
ansa-fs --html

# Export as interactive HTML with dark mode
ansa-fs --html --dark-mode

# Write output to a file
ansa-fs --output structure.json --json

# Generate HTML report
ansa-fs --html --output report.html
```

### Advanced Analysis Features

```shellscript
# Analyze code complexity
ansa-fs --analyze-complexity

# Set complexity threshold
ansa-fs --analyze-complexity --complexity-threshold medium

# Include detailed complexity metrics
ansa-fs --analyze-complexity --detailed-complexity

# Detect code duplication
ansa-fs --analyze-duplication --output duplication-report.html --html

# Analyze project dependencies
ansa-fs --analyze-dependencies --output dependency-graph.html --html

# Analyze technical debt
ansa-fs --analyze-tech-debt --output tech-debt-report.html --html

# Analyze git history
ansa-fs --analyze-git --output git-report.html --html

# NEW: Generate project documentation
ansa-fs --generate-docs

# NEW: Generate documentation in specific format
ansa-fs --generate-docs --docs-format html

# NEW: Customize documentation output
ansa-fs --generate-docs --docs-title "My Project Docs" --docs-output-dir "./project-docs"

# Compare two directories
ansa-fs --diff ./other-dir

# Watch for changes
ansa-fs --watch
```

## Programmatic Usage

### Basic Usage

```javascript
import { extractStructure, formatAsTree } from 'ansa-fs';

async function example() {
  // Extract the structure of a directory
  const structure = await extractStructure('./my-project');
  
  // Format and print as a tree
  console.log(formatAsTree(structure));
}

example();
```

### Using Advanced Analysis Features

```javascript
import { 
  extractStructure,
  analyzeDuplication,
  analyzeDependencies,
  analyzeTechDebt,
  analyzeGitHistory,
  analyzeDocumentation,
  generateMarkdownDocumentation,
  generateHtmlDocumentation
} from 'ansa-fs';
import fs from 'fs';

async function analyzeProject() {
  // Extract structure with content and complexity analysis
  const structure = await extractStructure('./my-project', {
    includeContent: true,
    detectLanguage: true,
    analyzeComplexity: true,
    includeSize: true
  });
  
  // Generate project documentation
  const documentation = analyzeDocumentation(structure, {
    title: 'My Project Documentation',
    extractComments: true,
    extractJsDoc: true
  });
  
  // Generate documentation in Markdown format
  const markdown = generateMarkdownDocumentation(documentation);
  fs.writeFileSync('docs/documentation.md', markdown);
  
  // Generate documentation in HTML format
  const html = generateHtmlDocumentation(documentation, {
    darkMode: false
  });
  fs.writeFileSync('docs/documentation.html', html);
  
  console.log('Documentation generated successfully!');
}

analyzeProject();
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
| `exportToHtml(structure, options)` | Export the structure to interactive HTML
| `watchStructure(dirPath, callback, options)` | Watch a directory for changes
| `analyzeCodeComplexity(content, language)` | Analyze code complexity of a file


### Advanced Analysis Functions

| Function | Description
|-----|-----
| `analyzeDuplication(structure, options)` | Detect code duplication in the project
| `generateDuplicationReport(results, options)` | Generate HTML report for code duplication
| `analyzeDependencies(structure, options)` | Analyze project dependencies
| `generateDependencyGraph(results, options)` | Generate HTML visualization of dependencies
| `analyzeTechDebt(structure, options)` | Analyze technical debt in the project
| `generateTechDebtReport(results, options)` | Generate HTML report for technical debt
| `analyzeGitHistory(structure, options)` | Analyze git history of the project
| `generateGitReport(results, options)` | Generate HTML report for git history
| `analyzeDocumentation(structure, options)` | Analyze and extract documentation from project
| `generateMarkdownDocumentation(documentation, options)` | Generate Markdown documentation
| `generateHtmlDocumentation(documentation, options)` | Generate HTML documentation with interactive features


## Documentation Generator

The new documentation generator automatically creates comprehensive project documentation by:

1. **Extracting information from:**

1. Code comments and docstrings
2. JSDoc/JavaDoc annotations
3. README files
4. package.json metadata
5. Project structure and statistics



2. **Generating documentation in multiple formats:**

1. Markdown for easy viewing on GitHub/GitLab
2. Interactive HTML with navigation and visualizations



3. **Documenting key project components:**

1. Modules and files
2. Classes and methods
3. Functions and parameters
4. Dependencies and relationships





## License

MIT

## Author

David Ansa `<davitacols@gmail.com>`

```plaintext

## 5. Example Usage

Here's how users can use the new documentation feature:

```javascript project="File System Analyzer" file="examples/generate-documentation.js" type="code"
import { 
  extractStructure, 
  analyzeDocumentation, 
  generateMarkdownDocumentation, 
  generateHtmlDocumentation 
} from 'ansa-fs';
import fs from 'fs';
import path from 'path';

async function generateProjectDocumentation() {
  console.log('Analyzing project structure...');
  
  // Extract the structure of the project
  const structure = await extractStructure('./', {
    includeContent: true,
    detectLanguage: true,
    analyzeComplexity: true,
    includeSize: true,
    maxDepth: Number.POSITIVE_INFINITY,
    ignoreDirs: ['.git', 'node_modules', 'dist', 'build'],
    ignoreFiles: ['.DS_Store']
  });
  
  console.log('Generating documentation...');
  
  // Analyze and extract documentation
  const documentation = analyzeDocumentation(structure, {
    title: 'Project Documentation',
    extractComments: true,
    extractJsDoc: true,
    includeReadme: true,
    includePackageInfo: true,
    includeStructure: true,
    includeComplexity: true,
    includeDependencies: true
  });
  
  // Create docs directory if it doesn't exist
  const docsDir = './docs';
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  // Generate Markdown documentation
  console.log('Generating Markdown documentation...');
  const markdown = generateMarkdownDocumentation(documentation);
  fs.writeFileSync(path.join(docsDir, 'documentation.md'), markdown);
  
  // Generate HTML documentation
  console.log('Generating HTML documentation...');
  const html = generateHtmlDocumentation(documentation, {
    darkMode: false
  });
  fs.writeFileSync(path.join(docsDir, 'documentation.html'), html);
  
  // Generate dark mode HTML documentation
  console.log('Generating dark mode HTML documentation...');
  const darkHtml = generateHtmlDocumentation(documentation, {
    darkMode: true
  });
  fs.writeFileSync(path.join(docsDir, 'documentation-dark.html'), darkHtml);
  
  console.log('Documentation generated successfully!');
  console.log(`Documentation files are available in the ${docsDir} directory.`);
}

// Run the documentation generator
generateProjectDocumentation().catch(error => {
  console.error('Error generating documentation:', error);
});
```