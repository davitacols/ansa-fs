// Documentation Analyzer
import path from 'path';

/**
 * Analyzes a project structure and generates comprehensive documentation
 * @param {Object} structure - The project structure object
 * @param {Object} options - Configuration options
 * @returns {Object} Documentation data
 */
export function analyzeDocumentation(structure, options = {}) {
  const opts = {
    extractComments: true,
    extractJsDoc: true,
    includeReadme: true,
    includePackageInfo: true,
    includeStructure: true,
    includeComplexity: true,
    includeDependencies: true,
    maxDepth: Number.POSITIVE_INFINITY,
    ...options
  };
  
  const documentation = {
    project: {
      name: structure.name || path.basename(structure.path || 'project'),
      path: structure.path || '',
      description: '',
      version: '',
      author: '',
      license: '',
      repository: '',
      dependencies: {},
      devDependencies: {}
    },
    readme: null,
    structure: {
      directories: [],
      files: []
    },
    modules: [],
    classes: [],
    functions: [],
    dependencies: {
      internal: [],
      external: []
    },
    stats: {
      totalFiles: 0,
      totalDirectories: 0,
      totalLines: 0,
      totalCodeLines: 0,
      totalCommentLines: 0,
      languageStats: {}
    }
  };
  
  // Extract project information from package.json
  if (opts.includePackageInfo) {
    extractPackageInfo(structure, documentation);
  }
  
  // Extract README content
  if (opts.includeReadme) {
    extractReadme(structure, documentation);
  }
  
  // Extract structure information
  if (opts.includeStructure) {
    extractStructureInfo(structure, documentation, opts.maxDepth);
  }
  
  // Extract documentation from code files
  extractCodeDocumentation(structure, documentation, opts);
  
  // Calculate statistics
  calculateStats(structure, documentation);
  
  return documentation;
}

/**
 * Extracts information from package.json
 */
function extractPackageInfo(structure, documentation) {
  function findPackageJson(node) {
    if (node.type === 'file' && node.name === 'package.json' && node.content) {
      try {
        const packageData = JSON.parse(node.content);
        
        documentation.project.name = packageData.name || documentation.project.name;
        documentation.project.description = packageData.description || '';
        documentation.project.version = packageData.version || '';
        documentation.project.author = packageData.author || '';
        documentation.project.license = packageData.license || '';
        
        if (packageData.repository) {
          documentation.project.repository = typeof packageData.repository === 'string' 
            ? packageData.repository 
            : packageData.repository.url || '';
        }
        
        documentation.project.dependencies = packageData.dependencies || {};
        documentation.project.devDependencies = packageData.devDependencies || {};
        
        return true;
      } catch (error) {
        // Ignore JSON parsing errors
      }
    }
    
    if (node.children) {
      for (const child of node.children) {
        if (findPackageJson(child)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  findPackageJson(structure);
}

/**
 * Extracts content from README files
 */
function extractReadme(structure, documentation) {
  function findReadme(node) {
    if (node.type === 'file' && 
        node.name.toLowerCase().startsWith('readme.') && 
        node.content) {
      documentation.readme = {
        name: node.name,
        content: node.content,
        path: node.path
      };
      return true;
    }
    
    if (node.children) {
      for (const child of node.children) {
        if (findReadme(child)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  findReadme(structure);
}

/**
 * Extracts structure information (directories and files)
 */
function extractStructureInfo(structure, documentation, maxDepth) {
  function traverseStructure(node, depth = 0) {
    if (depth > maxDepth) return;
    
    if (node.type === 'directory') {
      documentation.structure.directories.push({
        name: node.name,
        path: node.path,
        children: node.children ? node.children.length : 0
      });
      
      documentation.stats.totalDirectories++;
      
      if (node.children) {
        node.children.forEach(child => traverseStructure(child, depth + 1));
      }
    } else if (node.type === 'file') {
      documentation.structure.files.push({
        name: node.name,
        path: node.path,
        extension: node.extension,
        language: node.language,
        size: node.size,
        sizeFormatted: node.sizeFormatted
      });
      
      documentation.stats.totalFiles++;
    }
  }
  
  traverseStructure(structure);
}

/**
 * Extracts documentation from code files
 */
function extractCodeDocumentation(structure, documentation, options) {
  function traverseFiles(node) {
    if (node.type === 'file' && node.content && node.language) {
      const docInfo = extractFileDocumentation(node, options);
      
      // Add modules
      if (docInfo.module) {
        documentation.modules.push({
          name: docInfo.module.name || node.name,
          description: docInfo.module.description || '',
          path: node.path,
          language: node.language
        });
      }
      
      // Add classes
      docInfo.classes.forEach(cls => {
        documentation.classes.push({
          name: cls.name,
          description: cls.description || '',
          methods: cls.methods || [],
          properties: cls.properties || [],
          path: node.path,
          language: node.language
        });
      });
      
      // Add functions
      docInfo.functions.forEach(func => {
        documentation.functions.push({
          name: func.name,
          description: func.description || '',
          params: func.params || [],
          returns: func.returns || null,
          path: node.path,
          language: node.language
        });
      });
      
      // Add dependencies
      docInfo.dependencies.forEach(dep => {
        if (dep.type === 'internal') {
          documentation.dependencies.internal.push(dep);
        } else {
          documentation.dependencies.external.push(dep);
        }
      });
      
      // Add to stats
      documentation.stats.totalLines += docInfo.stats.lines;
      documentation.stats.totalCodeLines += docInfo.stats.codeLines;
      documentation.stats.totalCommentLines += docInfo.stats.commentLines;
      
      // Add to language stats
      if (node.language) {
        if (!documentation.stats.languageStats[node.language]) {
          documentation.stats.languageStats[node.language] = {
            files: 0,
            lines: 0,
            codeLines: 0,
            commentLines: 0
          };
        }
        
        documentation.stats.languageStats[node.language].files++;
        documentation.stats.languageStats[node.language].lines += docInfo.stats.lines;
        documentation.stats.languageStats[node.language].codeLines += docInfo.stats.codeLines;
        documentation.stats.languageStats[node.language].commentLines += docInfo.stats.commentLines;
      }
    }
    
    if (node.children) {
      node.children.forEach(traverseFiles);
    }
  }
  
  traverseFiles(structure);
}

/**
 * Extracts documentation from a single file
 */
function extractFileDocumentation(file, options) {
  const result = {
    module: null,
    classes: [],
    functions: [],
    dependencies: [],
    stats: {
      lines: 0,
      codeLines: 0,
      commentLines: 0
    }
  };
  
  if (!file.content) return result;
  
  const lines = file.content.split('\n');
  result.stats.lines = lines.length;
  
  // Extract based on language
  switch (file.language) {
    case 'JavaScript':
    case 'TypeScript':
      extractJavaScriptDocumentation(file, lines, result, options);
      break;
    case 'Python':
      extractPythonDocumentation(file, lines, result, options);
      break;
    case 'Java':
      extractJavaDocumentation(file, lines, result, options);
      break;
    // Add more languages as needed
    default:
      // Basic extraction for other languages
      extractBasicDocumentation(file, lines, result, options);
  }
  
  return result;
}

/**
 * Extracts documentation from JavaScript/TypeScript files
 */
function extractJavaScriptDocumentation(file, lines, result, options) {
  // Track comment blocks
  let inBlockComment = false;
  let currentComment = '';
  let currentJsDoc = null;
  
  // Import/require detection for dependencies
  const importRegex = /import\s+(?:[\w*\s{},]*)\s+from\s+['"]([^'"]+)['"]/g;
  const requireRegex = /(?:const|let|var)\s+(?:[\w*\s{},]*)\s+=\s+require\s*$$\s*['"]([^'"]+)['"]\s*$$/g;
  
  // Function and class detection
  const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?$$?(?:[^)]*)$$?\s*=>|(?:const|let|var)\s+(\w+)\s*=\s*function\s*\()/;
  const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?/;
  const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/;
  const moduleExportRegex = /module\.exports\s*=\s*(?:class|function)?\s*(\w+)?/;
  
  // Process each line
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Count code and comment lines
    if (trimmedLine === '' || trimmedLine === '}' || trimmedLine === ');') {
      // Empty lines or closing brackets
    } else if (trimmedLine.startsWith('//')) {
      result.stats.commentLines++;
      
      if (options.extractComments) {
        currentComment += trimmedLine.substring(2).trim() + '\n';
      }
    } else if (trimmedLine.startsWith('/*') || inBlockComment) {
      result.stats.commentLines++;
      inBlockComment = true;
      
      if (options.extractComments) {
        if (trimmedLine.startsWith('/**') && options.extractJsDoc) {
          // Start of JSDoc comment
          currentJsDoc = {
            description: '',
            params: [],
            returns: null,
            example: null
          };
        } else if (trimmedLine.startsWith('/*')) {
          // Start of regular block comment
          currentComment += trimmedLine.substring(2).trim() + '\n';
        } else {
          // Inside a comment block
          const commentLine = trimmedLine.replace(/^\*\s?/, '').trim();
          
          if (currentJsDoc) {
            // Process JSDoc tags
            if (commentLine.startsWith('@param')) {
              const paramMatch = commentLine.match(/@param\s+(?:{([^}]+)})?\s*(?:\[?(\w+)\]?)\s*(?:-\s*)?(.+)?/);
              if (paramMatch) {
                currentJsDoc.params.push({
                  type: paramMatch[1] || '',
                  name: paramMatch[2] || '',
                  description: (paramMatch[3] || '').trim()
                });
              }
            } else if (commentLine.startsWith('@returns') || commentLine.startsWith('@return')) {
              const returnMatch = commentLine.match(/@returns?\s+(?:{([^}]+)})?\s*(?:-\s*)?(.+)?/);
              if (returnMatch) {
                currentJsDoc.returns = {
                  type: returnMatch[1] || '',
                  description: (returnMatch[2] || '').trim()
                };
              }
            } else if (commentLine.startsWith('@example')) {
              currentJsDoc.example = '';
            } else if (currentJsDoc.example !== null && commentLine !== '') {
              currentJsDoc.example += commentLine + '\n';
            } else if (!commentLine.startsWith('@')) {
              currentJsDoc.description += commentLine + '\n';
            }
          } else {
            // Regular comment
            currentComment += commentLine + '\n';
          }
        }
      }
      
      // Check for end of comment block
      if (trimmedLine.endsWith('*/')) {
        inBlockComment = false;
      }
    } else {
      result.stats.codeLines++;
      
      // Check for dependencies
      let match;
      
      // Process import statements
      while ((match = importRegex.exec(line)) !== null) {
        const importPath = match[1];
        processDependency(importPath, file.path, result.dependencies);
      }
      
      // Process require statements
      while ((match = requireRegex.exec(line)) !== null) {
        const importPath = match[1];
        processDependency(importPath, file.path, result.dependencies);
      }
      
      // Check for class definitions
      const classMatch = line.match(classRegex);
      if (classMatch) {
        const className = classMatch[1];
        const parentClass = classMatch[2];
        
        const classDoc = {
          name: className,
          description: currentJsDoc ? currentJsDoc.description.trim() : currentComment.trim(),
          extends: parentClass,
          methods: [],
          properties: []
        };
        
        result.classes.push(classDoc);
        
        // Reset comments
        currentComment = '';
        currentJsDoc = null;
      }
      
      // Check for function definitions
      const functionMatch = line.match(functionRegex);
      if (functionMatch) {
        const functionName = functionMatch[1] || functionMatch[2] || functionMatch[3];
        
        if (functionName) {
          const functionDoc = {
            name: functionName,
            description: currentJsDoc ? currentJsDoc.description.trim() : currentComment.trim(),
            params: currentJsDoc ? currentJsDoc.params : [],
            returns: currentJsDoc ? currentJsDoc.returns : null,
            example: currentJsDoc ? currentJsDoc.example : null
          };
          
          result.functions.push(functionDoc);
          
          // Reset comments
          currentComment = '';
          currentJsDoc = null;
        }
      }
      
      // Check for module exports
      const exportMatch = line.match(exportRegex);
      const moduleExportMatch = line.match(moduleExportRegex);
      
      if (exportMatch || moduleExportMatch) {
        const exportName = exportMatch ? exportMatch[1] : (moduleExportMatch ? moduleExportMatch[1] : null);
        
        if (!result.module) {
          result.module = {
            name: path.basename(file.path, path.extname(file.path)),
            description: currentComment.trim()
          };
        }
        
        // Reset comments
        currentComment = '';
      }
    }
  });
  
  // If no module was detected but file has a description at the top, use it as module description
  if (!result.module && currentComment.trim()) {
    result.module = {
      name: path.basename(file.path, path.extname(file.path)),
      description: currentComment.trim()
    };
  }
}

/**
 * Extracts documentation from Python files
 */
function extractPythonDocumentation(file, lines, result, options) {
  let inDocstring = false;
  let docstringQuote = '';
  let currentDocstring = '';
  let indentLevel = 0;
  
  // Import detection for dependencies
  const importRegex = /(?:from\s+([^\s]+)\s+import|import\s+([^\s]+))/g;
  
  // Function and class detection
  const functionRegex = /def\s+(\w+)\s*\(/;
  const classRegex = /class\s+(\w+)(?:\s*$$([^)]+)$$)?:/;
  
  // Process each line
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Count code and comment lines
    if (trimmedLine === '') {
      // Empty line
    } else if (trimmedLine.startsWith('#')) {
      result.stats.commentLines++;
      
      if (options.extractComments) {
        currentDocstring += trimmedLine.substring(1).trim() + '\n';
      }
    } else if (inDocstring) {
      result.stats.commentLines++;
      
      if (options.extractComments) {
        // Check for end of docstring
        if (trimmedLine.endsWith(docstringQuote) && 
            (trimmedLine === docstringQuote || 
             trimmedLine.endsWith(docstringQuote + docstringQuote + docstringQuote))) {
          inDocstring = false;
          
          // Remove the closing quotes
          if (trimmedLine === docstringQuote) {
            // Single quote on its own line
          } else if (trimmedLine.endsWith(docstringQuote + docstringQuote + docstringQuote)) {
            // Triple quote
            currentDocstring += trimmedLine.substring(0, trimmedLine.length - 3).trim();
          } else {
            // Single quote at the end of a line
            currentDocstring += trimmedLine.substring(0, trimmedLine.length - 1).trim();
          }
        } else {
          currentDocstring += trimmedLine + '\n';
        }
      }
    } else if ((trimmedLine.startsWith('"""') || trimmedLine.startsWith("'''")) && 
               !inDocstring) {
      result.stats.commentLines++;
      inDocstring = true;
      docstringQuote = trimmedLine.substring(0, 3);
      
      if (options.extractComments) {
        // Remove the opening quotes
        currentDocstring = trimmedLine.substring(3).trim();
        
        // Check if docstring ends on the same line
        if (currentDocstring.endsWith(docstringQuote)) {
          inDocstring = false;
          currentDocstring = currentDocstring.substring(0, currentDocstring.length - 3).trim();
        }
      }
    } else {
      result.stats.codeLines++;
      
      // Calculate indent level
      const currentIndent = line.search(/\S/);
      if (currentIndent >= 0) {
        indentLevel = currentIndent;
      }
      
      // Check for dependencies
      let match;
      
      // Process import statements
      while ((match = importRegex.exec(line)) !== null) {
        const importPath = match[1] || match[2];
        processDependency(importPath, file.path, result.dependencies, 'py');
      }
      
      // Check for class definitions
      const classMatch = line.match(classRegex);
      if (classMatch) {
        const className = classMatch[1];
        const parentClasses = classMatch[2] ? classMatch[2].split(',').map(c => c.trim()) : [];
        
        const classDoc = {
          name: className,
          description: currentDocstring.trim(),
          extends: parentClasses.length > 0 ? parentClasses : null,
          methods: [],
          properties: []
        };
        
        result.classes.push(classDoc);
        
        // Reset docstring
        currentDocstring = '';
      }
      
      // Check for function definitions
      const functionMatch = line.match(functionRegex);
      if (functionMatch) {
        const functionName = functionMatch[1];
        
        // Parse docstring for parameters and return value
        const params = [];
        let returns = null;
        
        if (currentDocstring) {
          // Simple parsing for parameters and returns in docstring
          const lines = currentDocstring.split('\n');
          let inParams = false;
          let inReturns = false;
          let description = '';
          
          lines.forEach(line => {
            const trimmed = line.trim();
            
            if (trimmed.toLowerCase().startsWith('parameters:') || 
                trimmed.toLowerCase().startsWith('args:') || 
                trimmed.toLowerCase().startsWith('arguments:')) {
              inParams = true;
              inReturns = false;
            } else if (trimmed.toLowerCase().startsWith('returns:') || 
                       trimmed.toLowerCase().startsWith('return:')) {
              inParams = false;
              inReturns = true;
            } else if (inParams) {
              const paramMatch = trimmed.match(/(\w+)(?:\s*$$([^)]+)$$)?\s*:\s*(.+)/);
              if (paramMatch) {
                params.push({
                  name: paramMatch[1],
                  type: paramMatch[2] || '',
                  description: paramMatch[3].trim()
                });
              }
            } else if (inReturns) {
              if (!returns) {
                const returnMatch = trimmed.match(/(?:(\w+)(?:\s*$$([^)]+)$$)?\s*:)?\s*(.+)/);
                if (returnMatch) {
                  returns = {
                    type: returnMatch[2] || returnMatch[1] || '',
                    description: returnMatch[3].trim()
                  };
                } else {
                  returns = {
                    type: '',
                    description: trimmed
                  };
                }
              } else {
                returns.description += ' ' + trimmed;
              }
            } else if (trimmed && !description) {
              description = trimmed;
            }
          });
          
          const functionDoc = {
            name: functionName,
            description: description || currentDocstring.trim(),
            params: params,
            returns: returns
          };
          
          result.functions.push(functionDoc);
        } else {
          const functionDoc = {
            name: functionName,
            description: '',
            params: [],
            returns: null
          };
          
          result.functions.push(functionDoc);
        }
        
        // Reset docstring
        currentDocstring = '';
      }
      
      // Check for module docstring (at the beginning of the file)
      if (index < 5 && currentDocstring && !result.module) {
        result.module = {
          name: path.basename(file.path, path.extname(file.path)),
          description: currentDocstring.trim()
        };
        
        // Reset docstring
        currentDocstring = '';
      }
    }
  });
}

/**
 * Extracts documentation from Java files
 */
function extractJavaDocumentation(file, lines, result, options) {
  // Similar to JavaScript but with Java-specific patterns
  let inBlockComment = false;
  let currentComment = '';
  let currentJavaDoc = null;
  
  // Import detection for dependencies
  const importRegex = /import\s+([^;]+);/g;
  
  // Function and class detection
  const methodRegex = /(?:public|private|protected)(?:\s+static)?\s+(?:<[^>]+>\s+)?(\w+)\s+(\w+)\s*\(/;
  const classRegex = /(?:public|private|protected)?\s+class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/;
  
  // Process each line
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Count code and comment lines
    if (trimmedLine === '' || trimmedLine === '}' || trimmedLine === ');') {
      // Empty lines or closing brackets
    } else if (trimmedLine.startsWith('//')) {
      result.stats.commentLines++;
      
      if (options.extractComments) {
        currentComment += trimmedLine.substring(2).trim() + '\n';
      }
    } else if (trimmedLine.startsWith('/*') || inBlockComment) {
      result.stats.commentLines++;
      inBlockComment = true;
      
      if (options.extractComments) {
        if (trimmedLine.startsWith('/**') && options.extractJsDoc) {
          // Start of JavaDoc comment
          currentJavaDoc = {
            description: '',
            params: [],
            returns: null
          };
        } else if (trimmedLine.startsWith('/*')) {
          // Start of regular block comment
          currentComment += trimmedLine.substring(2).trim() + '\n';
        } else {
          // Inside a comment block
          const commentLine = trimmedLine.replace(/^\*\s?/, '').trim();
          
          if (currentJavaDoc) {
            // Process JavaDoc tags
            if (commentLine.startsWith('@param')) {
              const paramMatch = commentLine.match(/@param\s+(\w+)\s+(.+)/);
              if (paramMatch) {
                currentJavaDoc.params.push({
                  name: paramMatch[1] || '',
                  description: (paramMatch[2] || '').trim()
                });
              }
            } else if (commentLine.startsWith('@return')) {
              const returnMatch = commentLine.match(/@return\s+(.+)/);
              if (returnMatch) {
                currentJavaDoc.returns = {
                  description: (returnMatch[1] || '').trim()
                };
              }
            } else if (!commentLine.startsWith('@')) {
              currentJavaDoc.description += commentLine + '\n';
            }
          } else {
            // Regular comment
            currentComment += commentLine + '\n';
          }
        }
      }
      
      // Check for end of comment block
      if (trimmedLine.endsWith('*/')) {
        inBlockComment = false;
      }
    } else {
      result.stats.codeLines++;
      
      // Check for dependencies
      let match;
      
      // Process import statements
      while ((match = importRegex.exec(line)) !== null) {
        const importPath = match[1].trim();
        processDependency(importPath, file.path, result.dependencies, 'java');
      }
      
      // Check for class definitions
      const classMatch = line.match(classRegex);
      if (classMatch) {
        const className = classMatch[1];
        const parentClass = classMatch[2];
        const interfaces = classMatch[3] ? classMatch[3].split(',').map(i => i.trim()) : [];
        
        const classDoc = {
          name: className,
          description: currentJavaDoc ? currentJavaDoc.description.trim() : currentComment.trim(),
          extends: parentClass,
          implements: interfaces.length > 0 ? interfaces : null,
          methods: [],
          properties: []
        };
        
        result.classes.push(classDoc);
        
        // Reset comments
        currentComment = '';
        currentJavaDoc = null;
      }
      
      // Check for method definitions
      const methodMatch = line.match(methodRegex);
      if (methodMatch) {
        const returnType = methodMatch[1];
        const methodName = methodMatch[2];
        
        const methodDoc = {
          name: methodName,
          returnType: returnType,
          description: currentJavaDoc ? currentJavaDoc.description.trim() : currentComment.trim(),
          params: currentJavaDoc ? currentJavaDoc.params : [],
          returns: currentJavaDoc ? currentJavaDoc.returns : null
        };
        
        // Add to the last class if we're inside a class
        if (result.classes.length > 0) {
          result.classes[result.classes.length - 1].methods.push(methodDoc);
        } else {
          // Or add as a standalone function
          result.functions.push(methodDoc);
        }
        
        // Reset comments
        currentComment = '';
        currentJavaDoc = null;
      }
    }
  });
  
  // If no module was detected but file has a description at the top, use it as module description
  if (!result.module && currentComment.trim()) {
    result.module = {
      name: path.basename(file.path, path.extname(file.path)),
      description: currentComment.trim()
    };
  }
}

/**
 * Basic documentation extraction for other languages
 */
function extractBasicDocumentation(file, lines, result, options) {
  let inBlockComment = false;
  let currentComment = '';
  
  // Simple comment patterns
  const lineCommentStarters = {
    'HTML': '<!--',
    'CSS': '/*',
    'Ruby': '#',
    'Go': '//',
    'C': '//',
    'C++': '//',
    'C#': '//',
    'PHP': '//',
    'Swift': '//',
    'Kotlin': '//',
    'Rust': '//'
  };
  
  const blockCommentStarters = {
    'HTML': '<!--',
    'CSS': '/*',
    'C': '/*',
    'C++': '/*',
    'C#': '/*',
    'PHP': '/*',
    'Swift': '/*',
    'Kotlin': '/*',
    'Rust': '/*'
  };
  
  const blockCommentEnders = {
    'HTML': '-->',
    'CSS': '*/',
    'C': '*/',
    'C++': '*/',
    'C#': '*/',
    'PHP': '*/',
    'Swift': '*/',
    'Kotlin': '*/',
    'Rust': '*/'
  };
  
  const lineCommentStart = lineCommentStarters[file.language] || '//';
  const blockCommentStart = blockCommentStarters[file.language] || '/*';
  const blockCommentEnd = blockCommentEnders[file.language] || '*/';
  
  // Process each line
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // Count code and comment lines
    if (trimmedLine === '') {
      // Empty line
    } else if (trimmedLine.startsWith(lineCommentStart)) {
      result.stats.commentLines++;
      
      if (options.extractComments) {
      
        currentComment += trimmedLine.substring(lineCommentStart.length).trim() + '\n';
      }
    } else if (trimmedLine.startsWith(blockCommentStart) || inBlockComment) {
      result.stats.commentLines++;
      inBlockComment = true;
      
      if (options.extractComments) {
        if (trimmedLine.startsWith(blockCommentStart)) {
          // Start of block comment
          currentComment += trimmedLine.substring(blockCommentStart.length).trim() + '\n';
        } else {
          // Inside a comment block
          currentComment += trimmedLine + '\n';
        }
      }
      
      // Check for end of comment block
      if (trimmedLine.endsWith(blockCommentEnd)) {
        inBlockComment = false;
        
        if (options.extractComments) {
          // Remove the end marker
          currentComment = currentComment.substring(0, currentComment.length - blockCommentEnd.length - 1).trim() + '\n';
        }
      }
    } else {
      result.stats.codeLines++;
    }
  });
  
  // If file has a description at the top, use it as module description
  if (currentComment.trim()) {
    result.module = {
      name: path.basename(file.path, path.extname(file.path)),
      description: currentComment.trim()
    };
  }
}

/**
 * Process dependency paths
 */
function processDependency(importPath, filePath, dependencies, fileType = 'js') {
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    // Internal dependency
    dependencies.push({
      type: 'internal',
      path: importPath,
      source: filePath
    });
  } else {
    // External dependency
    dependencies.push({
      type: 'external',
      module: importPath.split('/')[0], // Get the package name
      path: importPath,
      source: filePath
    });
  }
}

/**
 * Calculate overall statistics
 */
function calculateStats(structure, documentation) {
  // Most of the stats are already calculated during extraction
  // This function can be used for additional calculations
  
  // Calculate language distribution percentages
  const totalLines = documentation.stats.totalLines;
  
  if (totalLines > 0) {
    Object.keys(documentation.stats.languageStats).forEach(language => {
      const langStats = documentation.stats.languageStats[language];
      langStats.percentage = Math.round((langStats.lines / totalLines) * 100);
    });
  }
}

/**
 * Generate Markdown documentation
 */
export function generateMarkdownDocumentation(documentation, options = {}) {
  const opts = {
    title: 'Project Documentation',
    includeTableOfContents: true,
    includeStats: true,
    includeStructure: true,
    includeModules: true,
    includeClasses: true,
    includeFunctions: true,
    ...options
  };
  
  let markdown = `# ${opts.title}\n\n`;
  
  // Add project information
  markdown += `## Project Overview\n\n`;
  markdown += `- **Name:** ${documentation.project.name}\n`;
  
  if (documentation.project.description) {
    markdown += `- **Description:** ${documentation.project.description}\n`;
  }
  
  if (documentation.project.version) {
    markdown += `- **Version:** ${documentation.project.version}\n`;
  }
  
  if (documentation.project.author) {
    markdown += `- **Author:** ${documentation.project.author}\n`;
  }
  
  if (documentation.project.license) {
    markdown += `- **License:** ${documentation.project.license}\n`;
  }
  
  markdown += '\n';
  
  // Add table of contents if requested
  if (opts.includeTableOfContents) {
    markdown += `## Table of Contents\n\n`;
    markdown += `1. [Project Overview](#project-overview)\n`;
    
    if (documentation.readme) {
      markdown += `2. [README](#readme)\n`;
    }
    
    if (opts.includeStats) {
      markdown += `${documentation.readme ? '3' : '2'}. [Statistics](#statistics)\n`;
    }
    
    if (opts.includeStructure) {
      markdown += `${documentation.readme ? (opts.includeStats ? '4' : '3') : (opts.includeStats ? '3' : '2')}. [Project Structure](#project-structure)\n`;
    }
    
    if (opts.includeModules && documentation.modules.length > 0) {
      markdown += `${getNextNumber()}. [Modules](#modules)\n`;
    }
    
    if (opts.includeClasses && documentation.classes.length > 0) {
      markdown += `${getNextNumber()}. [Classes](#classes)\n`;
    }
    
    if (opts.includeFunctions && documentation.functions.length > 0) {
      markdown += `${getNextNumber()}. [Functions](#functions)\n`;
    }
    
    markdown += '\n';
    
    // Helper function to get the next number for TOC
    function getNextNumber() {
      let num = 2; // Start at 2 (after Project Overview)
      if (documentation.readme) num++;
      if (opts.includeStats) num++;
      if (opts.includeStructure) num++;
      if (opts.includeModules && documentation.modules.length > 0) num++;
      if (opts.includeClasses && documentation.classes.length > 0) num++;
      return num;
    }
  }
  
  // Add README content if available
  if (documentation.readme) {
    markdown += `## README\n\n`;
    markdown += `${documentation.readme.content}\n\n`;
  }
  
  // Add statistics if requested
  if (opts.includeStats) {
    markdown += `## Statistics\n\n`;
    markdown += `- **Total Files:** ${documentation.stats.totalFiles}\n`;
    markdown += `- **Total Directories:** ${documentation.stats.totalDirectories}\n`;
    markdown += `- **Total Lines of Code:** ${documentation.stats.totalCodeLines}\n`;
    markdown += `- **Total Comment Lines:** ${documentation.stats.totalCommentLines}\n`;
    markdown += `- **Total Lines:** ${documentation.stats.totalLines}\n\n`;
    
    if (Object.keys(documentation.stats.languageStats).length > 0) {
      markdown += `### Language Distribution\n\n`;
      markdown += `| Language | Files | Lines | Code Lines | Comment Lines | Percentage |\n`;
      markdown += `|----------|-------|-------|------------|--------------|------------|\n`;
      
      Object.entries(documentation.stats.languageStats)
        .sort((a, b) => b[1].lines - a[1].lines)
        .forEach(([language, stats]) => {
          markdown += `| ${language} | ${stats.files} | ${stats.lines} | ${stats.codeLines} | ${stats.commentLines} | ${stats.percentage}% |\n`;
        });
      
      markdown += '\n';
    }
    
    if (Object.keys(documentation.project.dependencies).length > 0) {
      markdown += `### Dependencies\n\n`;
      markdown += `| Package | Version |\n`;
      markdown += `|---------|--------|\n`;
      
      Object.entries(documentation.project.dependencies)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([pkg, version]) => {
          markdown += `| ${pkg} | ${version} |\n`;
        });
      
      markdown += '\n';
    }
  }
  
  // Add structure if requested
  if (opts.includeStructure) {
    markdown += `## Project Structure\n\n`;
    markdown += `\`\`\`\n`;
    
    // Generate a tree representation
    function generateTree(structure, prefix = '') {
      let tree = '';
      
      // Add directories first
      const directories = documentation.structure.directories
        .filter(dir => dir.path.split('/').length === 2) // Top-level directories
        .sort((a, b) => a.name.localeCompare(b.name));
      
      directories.forEach((dir, index) => {
        const isLast = index === directories.length - 1 && documentation.structure.files.filter(f => !f.path.includes('/')).length === 0;
        tree += `${prefix}${isLast ? '└── ' : '├── '}${dir.name}/\n`;
        
        // Add subdirectories and files
        tree += generateSubtree(dir, `${prefix}${isLast ? '    ' : '│   '}`);
      });
      
      // Add top-level files
      const files = documentation.structure.files
        .filter(file => !file.path.includes('/'))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      files.forEach((file, index) => {
        const isLast = index === files.length - 1;
        tree += `${prefix}${isLast ? '└── ' : '├── '}${file.name}\n`;
      });
      
      return tree;
    }
    
    function generateSubtree(dir, prefix) {
      let tree = '';
      
      // Find subdirectories
      const subdirs = documentation.structure.directories
        .filter(d => {
          const parts = d.path.split('/');
          return parts.length > 2 && parts[0] === dir.name;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      
      // Find files in this directory
      const files = documentation.structure.files
        .filter(f => {
          const parts = f.path.split('/');
          return parts.length > 1 && parts[0] === dir.name && parts.length === 2;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      
      // Add subdirectories
      subdirs.forEach((subdir, index) => {
        const isLast = index === subdirs.length - 1 && files.length === 0;
        const name = subdir.path.split('/').pop();
        tree += `${prefix}${isLast ? '└── ' : '├── '}${name}/\n`;
        
        // Recursively add subdirectory content
        tree += generateSubtree(subdir, `${prefix}${isLast ? '    ' : '│   '}`);
      });
      
      // Add files
      files.forEach((file, index) => {
        const isLast = index === files.length - 1;
        tree += `${prefix}${isLast ? '└── ' : '├── '}${file.name}\n`;
      });
      
      return tree;
    }
    
    markdown += generateTree(documentation.structure);
    markdown += `\`\`\`\n\n`;
  }
  
  // Add modules if requested
  if (opts.includeModules && documentation.modules.length > 0) {
    markdown += `## Modules\n\n`;
    
    documentation.modules.forEach(module => {
      markdown += `### ${module.name}\n\n`;
      
      if (module.description) {
        markdown += `${module.description}\n\n`;
      }
      
      markdown += `**File:** \`${module.path}\`\n\n`;
      markdown += `**Language:** ${module.language}\n\n`;
    });
  }
  
  // Add classes if requested
  if (opts.includeClasses && documentation.classes.length > 0) {
    markdown += `## Classes\n\n`;
    
    documentation.classes.forEach(cls => {
      markdown += `### ${cls.name}\n\n`;
      
      if (cls.description) {
        markdown += `${cls.description}\n\n`;
      }
      
      markdown += `**File:** \`${cls.path}\`\n\n`;
      
      if (cls.extends) {
        markdown += `**Extends:** ${cls.extends}\n\n`;
      }
      
      if (cls.implements) {
        markdown += `**Implements:** ${cls.implements.join(', ')}\n\n`;
      }
      
      if (cls.methods && cls.methods.length > 0) {
        markdown += `#### Methods\n\n`;
        
        cls.methods.forEach(method => {
          markdown += `##### ${method.name}()\n\n`;
          
          if (method.description) {
            markdown += `${method.description}\n\n`;
          }
          
          if (method.params && method.params.length > 0) {
            markdown += `**Parameters:**\n\n`;
            
            method.params.forEach(param => {
              markdown += `- \`${param.name}\`${param.type ? ` (${param.type})` : ''}: ${param.description || 'No description'}\n`;
            });
            
            markdown += '\n';
          }
          
          if (method.returns) {
            markdown += `**Returns:** ${method.returns.type ? `(${method.returns.type}) ` : ''}${method.returns.description || 'No description'}\n\n`;
          }
        });
      }
      
      if (cls.properties && cls.properties.length > 0) {
        markdown += `#### Properties\n\n`;
        
        cls.properties.forEach(prop => {
          markdown += `- \`${prop.name}\`${prop.type ? ` (${prop.type})` : ''}: ${prop.description || 'No description'}\n`;
        });
        
        markdown += '\n';
      }
    });
  }
  
  // Add functions if requested
  if (opts.includeFunctions && documentation.functions.length > 0) {
    markdown += `## Functions\n\n`;
    
    documentation.functions.forEach(func => {
      markdown += `### ${func.name}()\n\n`;
      
      if (func.description) {
        markdown += `${func.description}\n\n`;
      }
      
      markdown += `**File:** \`${func.path}\`\n\n`;
      
      if (func.params && func.params.length > 0) {
        markdown += `**Parameters:**\n\n`;
        
        func.params.forEach(param => {
          markdown += `- \`${param.name}\`${param.type ? ` (${param.type})` : ''}: ${param.description || 'No description'}\n`;
        });
        
        markdown += '\n';
      }
      
      if (func.returns) {
        markdown += `**Returns:** ${func.returns.type ? `(${func.returns.type}) ` : ''}${func.returns.description || 'No description'}\n\n`;
      }
      
      if (func.example) {
        markdown += `**Example:**\n\n`;
        markdown += `\`\`\`\n${func.example}\n\`\`\`\n\n`;
      }
    });
  }
  
  return markdown;
}

/**
 * Generate HTML documentation
 */
export function generateHtmlDocumentation(documentation, options = {}) {
  const opts = {
    title: 'Project Documentation',
    darkMode: false,
    includeStats: true,
    includeStructure: true,
    includeModules: true,
    includeClasses: true,
    includeFunctions: true,
    ...options
  };
  
  // Convert markdown sections to HTML
  const markdownConverter = text => {
    if (!text) return '';
    
    // Simple markdown to HTML conversion
    return text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]$$([^)]+)$$/g, '<a href="$2">$1</a>');
  };
  
  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
  <style>
    :root {
      --bg-color: ${opts.darkMode ? '#1e1e1e' : '#ffffff'};
      --text-color: ${opts.darkMode ? '#e0e0e0' : '#333333'};
      --link-color: ${opts.darkMode ? '#61dafb' : '#0366d6'};
      --header-bg: ${opts.darkMode ? '#252526' : '#f6f8fa'};
      --border-color: ${opts.darkMode ? '#444444' : '#e1e4e8'};
      --code-bg: ${opts.darkMode ? '#2d2d2d' : '#f6f8fa'};
      --sidebar-bg: ${opts.darkMode ? '#252526' : '#f6f8fa'};
      --card-bg: ${opts.darkMode ? '#2d2d2d' : '#ffffff'};
      --card-border: ${opts.darkMode ? '#444444' : '#e1e4e8'};
      --hover-bg: ${opts.darkMode ? '#383838' : '#f0f0f0'};
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background-color: var(--bg-color);
      margin: 0;
      padding: 0;
      display: flex;
      min-height: 100vh;
    }
    
    a {
      color: var(--link-color);
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    code {
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      background-color: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-size: 85%;
    }
    
    pre {
      background-color: var(--code-bg);
      padding: 1em;
      border-radius: 5px;
      overflow-x: auto;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
    }
    
    .sidebar {
      width: 280px;
      background-color: var(--sidebar-bg);
      border-right: 1px solid var(--border-color);
      padding: 1.5rem;
      overflow-y: auto;
      position: fixed;
      height: 100vh;
      box-sizing: border-box;
    }
    
    .sidebar h1 {
      font-size: 1.5rem;
      margin-top: 0;
    }
    
    .sidebar ul {
      list-style-type: none;
      padding: 0;
      margin: 0;
    }
    
    .sidebar li {
      margin-bottom: 0.5rem;
    }
    
    .sidebar li a {
      display: block;
      padding: 0.5rem;
      border-radius: 5px;
    }
    
    .sidebar li a:hover {
      background-color: var(--hover-bg);
      text-decoration: none;
    }
    
    .sidebar .section-title {
      font-weight: bold;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
      color: var(--text-color);
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .content {
      flex: 1;
      padding: 2rem;
      margin-left: 280px;
      max-width: 900px;
    }
    
    .section {
      margin-bottom: 3rem;
    }
    
    .section h2 {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
    }
    
    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 5px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    
    .card h3 {
      margin-top: 0;
      margin-bottom: 1rem;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    
    .stat-card {
      background-color: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 5px;
      padding: 1rem;
      text-align: center;
    }
    
    .stat-card h4 {
      margin: 0;
      font-size: 0.9rem;
      color: var(--text-color);
      opacity: 0.8;
    }
    
    .stat-card p {
      margin: 0.5rem 0 0;
      font-size: 1.5rem;
      font-weight: bold;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1.5rem;
    }
    
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }
    
    th {
      background-color: var(--header-bg);
    }
    
    .method, .property {
      margin-bottom: 1.5rem;
    }
    
    .method h4, .property h4 {
      margin-bottom: 0.5rem;
    }
    
    .param, .return {
      margin-bottom: 0.5rem;
    }
    
    .param-name, .return-type {
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      font-weight: bold;
    }
    
    .param-type, .return-type {
      color: var(--text-color);
      opacity: 0.7;
    }
    
    .tree {
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      white-space: pre;
      overflow-x: auto;
      background-color: var(--code-bg);
      padding: 1rem;
      border-radius: 5px;
    }
    
    .chart-container {
      margin-bottom: 2rem;
    }
    
    .toggle-theme {
      position: fixed;
      top: 1rem;
      right: 1rem;
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 5px;
      padding: 0.5rem 1rem;
      cursor: pointer;
      z-index: 100;
    }
  </style>
</head>
<body>
  <div class="sidebar">
    <h1>${documentation.project.name}</h1>
    <p>${documentation.project.description || ''}</p>
    
    <div class="section-title">Navigation</div>
    <ul>
      <li><a href="#overview">Project Overview</a></li>
      ${documentation.readme ? '<li><a href="#readme">README</a></li>' : ''}
      ${opts.includeStats ? '<li><a href="#statistics">Statistics</a></li>' : ''}
      ${opts.includeStructure ? '<li><a href="#structure">Project Structure</a></li>' : ''}
      ${opts.includeModules && documentation.modules.length > 0 ? '<li><a href="#modules">Modules</a></li>' : ''}
      ${opts.includeClasses && documentation.classes.length > 0 ? '<li><a href="#classes">Classes</a></li>' : ''}
      ${opts.includeFunctions && documentation.functions.length > 0 ? '<li><a href="#functions">Functions</a></li>' : ''}
    </ul>
    
    ${opts.includeModules && documentation.modules.length > 0 ? `
    <div class="section-title">Modules</div>
    <ul>
      ${documentation.modules.map(module => `
        <li><a href="#module-${module.name.replace(/[^a-zA-Z0-9]/g, '-')}">${module.name}</a></li>
      `).join('')}
    </ul>
    ` : ''}
    
    ${opts.includeClasses && documentation.classes.length > 0 ? `
    <div class="section-title">Classes</div>
    <ul>
      ${documentation.classes.map(cls => `
        <li><a href="#class-${cls.name.replace(/[^a-zA-Z0-9]/g, '-')}">${cls.name}</a></li>
      `).join('')}
    </ul>
    ` : ''}
    
    ${opts.includeFunctions && documentation.functions.length > 0 ? `
    <div class="section-title">Functions</div>
    <ul>
      ${documentation.functions.map(func => `
        <li><a href="#function-${func.name.replace(/[^a-zA-Z0-9]/g, '-')}">${func.name}</a></li>
      `).join('')}
    </ul>
    ` : ''}
  </div>
  
  <div class="content">
    <button class="toggle-theme" onclick="toggleTheme()">Toggle Theme</button>
    
    <div class="section" id="overview">
      <h2>Project Overview</h2>
      
      <div class="card">
        <h3>${documentation.project.name}</h3>
        ${documentation.project.description ? `<p>${documentation.project.description}</p>` : ''}
        
        <table>
          <tr>
            <th>Property</th>
            <th>Value</th>
          </tr>
          ${documentation.project.version ? `
          <tr>
            <td>Version</td>
            <td>${documentation.project.version}</td>
          </tr>
          ` : ''}
          ${documentation.project.author ? `
          <tr>
            <td>Author</td>
            <td>${documentation.project.author}</td>
          </tr>
          ` : ''}
          ${documentation.project.license ? `
          <tr>
            <td>License</td>
            <td>${documentation.project.license}</td>
          </tr>
          ` : ''}
          ${documentation.project.repository ? `
          <tr>
            <td>Repository</td>
            <td><a href="${documentation.project.repository}" target="_blank">${documentation.project.repository}</a></td>
          </tr>
          ` : ''}
        </table>
      </div>
    </div>
    
    ${documentation.readme ? `
    <div class="section" id="readme">
      <h2>README</h2>
      
      <div class="card">
        <p>${markdownConverter(documentation.readme.content)}</p>
      </div>
    </div>
    ` : ''}
    
    ${opts.includeStats ? `
    <div class="section" id="statistics">
      <h2>Statistics</h2>
      
      <div class="stats-grid">
        <div class="stat-card">
          <h4>Files</h4>
          <p>${documentation.stats.totalFiles}</p>
        </div>
        
        <div class="stat-card">
          <h4>Directories</h4>
          <p>${documentation.stats.totalDirectories}</p>
        </div>
        
        <div class="stat-card">
          <h4>Lines of Code</h4>
          <p>${documentation.stats.totalCodeLines}</p>
        </div>
        
        <div class="stat-card">
          <h4>Comment Lines</h4>
          <p>${documentation.stats.totalCommentLines}</p>
        </div>
        
        <div class="stat-card">
          <h4>Total Lines</h4>
          <p>${documentation.stats.totalLines}</p>
        </div>
      </div>
      
      ${Object.keys(documentation.stats.languageStats).length > 0 ? `
      <div class="card">
        <h3>Language Distribution</h3>
        
        <div class="chart-container">
          <canvas id="languageChart"></canvas>
        </div>
        
        <table>
          <tr>
            <th>Language</th>
            <th>Files</th>
            <th>Lines</th>
            <th>Code Lines</th>
            <th>Comment Lines</th>
            <th>Percentage</th>
          </tr>
          ${Object.entries(documentation.stats.languageStats)
            .sort((a, b) => b[1].lines - a[1].lines)
            .map(([language, stats]) => `
            <tr>
              <td>${language}</td>
              <td>${stats.files}</td>
              <td>${stats.lines}</td>
              <td>${stats.codeLines}</td>
              <td>${stats.commentLines}</td>
              <td>${stats.percentage}%</td>
            </tr>
          `).join('')}
        </table>
      </div>
      ` : ''}
      
      ${Object.keys(documentation.project.dependencies).length > 0 ? `
      <div class="card">
        <h3>Dependencies</h3>
        
        <table>
          <tr>
            <th>Package</th>
            <th>Version</th>
          </tr>
          ${Object.entries(documentation.project.dependencies)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([pkg, version]) => `
            <tr>
              <td>${pkg}</td>
              <td>${version}</td>
            </tr>
          `).join('')}
        </table>
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    ${opts.includeStructure ? `
    <div class="section" id="structure">
      <h2>Project Structure</h2>
      
      <div class="card">
        <div class="tree">
${generateTreeHtml(documentation.structure)}
        </div>
      </div>
    </div>
    ` : ''}
    
    ${opts.includeModules && documentation.modules.length > 0 ? `
    <div class="section" id="modules">
      <h2>Modules</h2>
      
      ${documentation.modules.map(module => `
      <div class="card" id="module-${module.name.replace(/[^a-zA-Z0-9]/g, '-')}">
        <h3>${module.name}</h3>
        
        ${module.description ? `<p>${markdownConverter(module.description)}</p>` : ''}
        
        <p><strong>File:</strong> <code>${module.path}</code></p>
        <p><strong>Language:</strong> ${module.language}</p>
      </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${opts.includeClasses && documentation.classes.length > 0 ? `
    <div class="section" id="classes">
      <h2>Classes</h2>
      
      ${documentation.classes.map(cls => `
      <div class="card" id="class-${cls.name.replace(/[^a-zA-Z0-9]/g, '-')}">
        <h3>${cls.name}</h3>
        
        ${cls.description ? `<p>${markdownConverter(cls.description)}</p>` : ''}
        
        <p><strong>File:</strong> <code>${cls.path}</code></p>
        
        ${cls.extends ? `<p><strong>Extends:</strong> ${cls.extends}</p>` : ''}
        
        ${cls.implements ? `<p><strong>Implements:</strong> ${cls.implements.join(', ')}</p>` : ''}
        
        ${cls.methods && cls.methods.length > 0 ? `
        <h4>Methods</h4>
        
        ${cls.methods.map(method => `
        <div class="method">
          <h5>${method.name}()</h5>
          
          ${method.description ? `<p>${markdownConverter(method.description)}</p>` : ''}
          
          ${method.params && method.params.length > 0 ? `
          <div class="params">
            <strong>Parameters:</strong>
            
            ${method.params.map(param => `
            <div class="param">
              <span class="param-name">${param.name}</span>
              ${param.type ? `<span class="param-type">(${param.type})</span>` : ''}
              ${param.description ? `: ${param.description}` : ''}
            </div>
            `).join('')}
          </div>
          ` : ''}
          
          ${method.returns ? `
          <div class="return">
            <strong>Returns:</strong>
            ${method.returns.type ? `<span class="return-type">(${method.returns.type})</span>` : ''}
            ${method.returns.description ? `: ${method.returns.description}` : ''}
          </div>
          ` : ''}
        </div>
        `).join('')}
        ` : ''}
        
        ${cls.properties && cls.properties.length > 0 ? `
        <h4>Properties</h4>
        
        ${cls.properties.map(prop => `
        <div class="property">
          <h5>${prop.name}</h5>
          
          ${prop.type ? `<p><strong>Type:</strong> ${prop.type}</p>` : ''}
          ${prop.description ? `<p>${markdownConverter(prop.description)}</p>` : ''}
        </div>
        `).join('')}
        ` : ''}
      </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${opts.includeFunctions && documentation.functions.length > 0 ? `
    <div class="section" id="functions">
      <h2>Functions</h2>
      
      ${documentation.functions.map(func => `
      <div class="card" id="function-${func.name.replace(/[^a-zA-Z0-9]/g, '-')}">
        <h3>${func.name}()</h3>
        
        ${func.description ? `<p>${markdownConverter(func.description)}</p>` : ''}
        
        <p><strong>File:</strong> <code>${func.path}</code></p>
        
        ${func.params && func.params.length > 0 ? `
        <div class="params">
          <strong>Parameters:</strong>
          
          ${func.params.map(param => `
          <div class="param">
            <span class="param-name">${param.name}</span>
            ${param.type ? `<span class="param-type">(${param.type})</span>` : ''}
            ${param.description ? `: ${param.description}` : ''}
          </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${func.returns ? `
        <div class="return">
          <strong>Returns:</strong>
          ${func.returns.type ? `<span class="return-type">(${func.returns.type})</span>` : ''}
          ${func.returns.description ? `: ${func.returns.description}` : ''}
        </div>
        ` : ''}
        
        ${func.example ? `
        <div class="example">
          <strong>Example:</strong>
          <pre><code>${func.example}</code></pre>
        </div>
        ` : ''}
      </div>
      `).join('')}
    </div>
    ` : ''}
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
  <script>
    // Toggle theme function
    function toggleTheme() {
      document.body.classList.toggle('dark-mode');
      const isDarkMode = document.body.classList.contains('dark-mode');
      localStorage.setItem('darkMode', isDarkMode);
    }
    
    // Check for saved theme preference
    if (localStorage.getItem('darkMode') === 'true') {
      document.body.classList.add('dark-mode');
    }
    
    // Language distribution chart
    ${Object.keys(documentation.stats.languageStats).length > 0 ? `
    const languageCtx = document.getElementById('languageChart');
    new Chart(languageCtx, {
      type: 'pie',
      data: {
        labels: [${Object.keys(documentation.stats.languageStats).map(lang => `'${lang}'`).join(', ')}],
        datasets: [{
          data: [${Object.values(documentation.stats.languageStats).map(stats => stats.lines).join(', ')}],
          backgroundColor: [
            '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
            '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
          },
          title: {
            display: true,
            text: 'Language Distribution (by lines)'
          }
        }
      }
    });
    ` : ''}
  </script>
</body>
</html>`;

  return html;
}

/**
 * Generate HTML tree representation
 */
function generateTreeHtml(structure) {
  // Generate a tree representation
  function generateTree(structure, prefix = '') {
    let tree = '';
    
    // Add directories first
    const directories = structure.directories
      .filter(dir => dir.path.split('/').length === 2) // Top-level directories
      .sort((a, b) => a.name.localeCompare(b.name));
    
    directories.forEach((dir, index) => {
      const isLast = index === directories.length - 1 && structure.files.filter(f => !f.path.includes('/')).length === 0;
      tree += `${prefix}${isLast ? '└── ' : '├── '}${dir.name}/\n`;
      
      // Add subdirectories and files
      tree += generateSubtree(dir, `${prefix}${isLast ? '    ' : '│   '}`);
    });
    
    // Add top-level files
    const files = structure.files
      .filter(file => !file.path.includes('/'))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    files.forEach((file, index) => {
      const isLast = index === files.length - 1;
      tree += `${prefix}${isLast ? '└── ' : '├── '}${file.name}\n`;
    });
    
    return tree;
  }
  
  function generateSubtree(dir, prefix) {
    let tree = '';
    
    // Find subdirectories
    const subdirs = structure.directories
      .filter(d => {
        const parts = d.path.split('/');
        return parts.length > 2 && parts[0] === dir.name;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Find files in this directory
    const files = structure.files
      .filter(f => {
        const parts = f.path.split('/');
        return parts.length > 1 && parts[0] === dir.name && parts.length === 2;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Add subdirectories
    subdirs.forEach((subdir, index) => {
      const isLast = index === subdirs.length - 1 && files.length === 0;
      const name = subdir.path.split('/').pop();
      tree += `${prefix}${isLast ? '└── ' : '├── '}${name}/\n`;
      
      // Recursively add subdirectory content
      tree += generateSubtree(subdir, `${prefix}${isLast ? '    ' : '│   '}`);
    });
    
    // Add files
    files.forEach((file, index) => {
      const isLast = index === files.length - 1;
      tree += `${prefix}${isLast ? '└── ' : '├── '}${file.name}\n`;
    });
    
    return tree;
  }
  
  return generateTree(structure);
}