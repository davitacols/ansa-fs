// Technical Debt Analyzer
export function analyzeTechDebt(structure, options = {}) {
    const opts = {
      todoKeywords: ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG', 'REFACTOR'],
      includeComments: true,
      includeComplexity: true,
      includeOutdatedDeps: true,
      ...options
    };
    
    const techDebt = {
      todos: [],
      complexFiles: [],
      outdatedPatterns: [],
      summary: {
        todoCount: 0,
        complexFileCount: 0,
        outdatedPatternCount: 0,
        debtScore: 0
      }
    };
    
    // Find TODOs and FIXMEs in comments
    function findTodos(node) {
      if (node.type === 'file' && node.content) {
        const lines = node.content.split('\n');
        
        lines.forEach((line, index) => {
          opts.todoKeywords.forEach(keyword => {
            if (line.includes(keyword)) {
              const match = line.match(new RegExp(`.*?(${keyword}:?\\s*)(.*?)$`));
              
              if (match) {
                const todo = {
                  file: node.path,
                  line: index + 1,
                  type: match[1].trim(),
                  message: match[2].trim(),
                  context: line.trim()
                };
                
                techDebt.todos.push(todo);
                techDebt.summary.todoCount++;
              }
            }
          });
        });
      }
      
      if (node.children) {
        node.children.forEach(findTodos);
      }
    }
    
    // Find complex files
    function findComplexFiles(node) {
      if (node.type === 'file' && node.complexity) {
        if (node.complexity.complexity === 'high' || node.complexity.complexity === 'very high') {
          techDebt.complexFiles.push({
            file: node.path,
            language: node.language,
            complexity: node.complexity.complexity,
            metrics: {
              lines: node.complexity.lines,
              functions: node.complexity.functions,
              classes: node.complexity.classes,
              conditionals: node.complexity.conditionals
            }
          });
          
          techDebt.summary.complexFileCount++;
        }
      }
      
      if (node.children) {
        node.children.forEach(findComplexFiles);
      }
    }
    
    // Find outdated patterns and practices
    function findOutdatedPatterns(node) {
      if (node.type === 'file' && node.content) {
        const patterns = [
          {
            name: 'var declarations',
            language: 'JavaScript',
            pattern: /\bvar\s+\w+/g,
            suggestion: 'Use let or const instead of var'
          },
          {
            name: 'jQuery usage',
            language: 'JavaScript',
            pattern: /\$$$.*?$$/g,
            suggestion: 'Consider using modern DOM APIs instead of jQuery'
          },
          {
            name: 'setTimeout with strings',
            language: 'JavaScript',
            pattern: /setTimeout\s*\(\s*["'].*?["']/g,
            suggestion: 'Use function references instead of strings with setTimeout'
          },
          {
            name: 'Python 2 print statements',
            language: 'Python',
            pattern: /^\s*print\s+[^(]/g,
            suggestion: 'Use print() function (Python 3 style)'
          },
          {
            name: 'Old-style Python class',
            language: 'Python',
            pattern: /class\s+\w+\s*$$object$$:/g,
            suggestion: 'In Python 3, classes inherit from object by default'
          }
          // Add more patterns as needed
        ];
        
        if (!node.language) return;
        
        patterns.forEach(pattern => {
          if (pattern.language === node.language) {
            const matches = [...node.content.matchAll(pattern.pattern)];
            
            matches.forEach(match => {
              const lineNumber = node.content.substring(0, match.index).split('\n').length;
              
              techDebt.outdatedPatterns.push({
                file: node.path,
                line: lineNumber,
                pattern: pattern.name,
                match: match[0],
                suggestion: pattern.suggestion
              });
              
              techDebt.summary.outdatedPatternCount++;
            });
          }
        });
      }
      
      if (node.children) {
        node.children.forEach(findOutdatedPatterns);
      }
    }
    
    // Calculate overall technical debt score
    function calculateDebtScore() {
      // Simple scoring algorithm - can be refined
      const todoScore = techDebt.summary.todoCount * 1;
      const complexityScore = techDebt.summary.complexFileCount * 5;
      const outdatedScore = techDebt.summary.outdatedPatternCount * 2;
      
      techDebt.summary.debtScore = todoScore + complexityScore + outdatedScore;
      
      // Add qualitative assessment
      if (techDebt.summary.debtScore < 10) {
        techDebt.summary.assessment = 'Low technical debt';
      } else if (techDebt.summary.debtScore < 50) {
        techDebt.summary.assessment = 'Moderate technical debt';
      } else if (techDebt.summary.debtScore < 100) {
        techDebt.summary.assessment = 'Significant technical debt';
      } else {
        techDebt.summary.assessment = 'High technical debt';
      }
    }
    
    // Run the analysis
    if (opts.includeComments) {
      findTodos(structure);
    }
    
    if (opts.includeComplexity) {
      findComplexFiles(structure);
    }
    
    if (opts.includeOutdatedDeps) {
      findOutdatedPatterns(structure);
    }
    
    calculateDebtScore();
    
    return techDebt;
  }
  
  // Generate HTML report for technical debt
  export function generateTechDebtReport(techDebt, options = {}) {
    const opts = {
      title: 'Technical Debt Report',
      ...options
    };
    
    const html = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${opts.title}</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f8f9fa;
        margin: 0;
        padding: 0;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
      }
      
      h1, h2, h3 {
        color: #333;
      }
      
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }
      
      .summary-card {
        background-color: white;
        border-radius: 8px;
        padding: 1.5rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      
      .summary-card h3 {
        margin-top: 0;
        font-size: 1rem;
        color: #666;
      }
      
      .summary-card p {
        font-size: 1.5rem;
        font-weight: bold;
        margin: 0;
      }
      
      .debt-score {
        font-size: 2.5rem !important;
        color: ${techDebt.summary.debtScore < 10 ? '#28a745' : 
                 techDebt.summary.debtScore < 50 ? '#ffc107' : 
                 techDebt.summary.debtScore < 100 ? '#fd7e14' : '#dc3545'};
      }
      
      .assessment {
        font-size: 1rem !important;
        font-weight: normal;
        margin-top: 0.5rem !important;
      }
      
      .section {
        background-color: white;
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
        border-bottom: 1px solid #dee2e6;
      }
      
      th {
        background-color: #f8f9fa;
      }
      
      tr:hover {
        background-color: #f8f9fa;
      }
      
      .badge {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      .badge-todo {
        background-color: #cff4fc;
        color: #055160;
      }
      
      .badge-fixme {
        background-color: #f8d7da;
        color: #842029;
      }
      
      .badge-hack {
        background-color: #fff3cd;
        color: #664d03;
      }
      
      .badge-high {
        background-color: #f8d7da;
        color: #842029;
      }
      
      .badge-very-high {
        background-color: #dc3545;
        color: white;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>${opts.title}</h1>
      
      <div class="summary">
        <div class="summary-card">
          <h3>Technical Debt Score</h3>
          <p class="debt-score">${techDebt.summary.debtScore}</p>
          <p class="assessment">${techDebt.summary.assessment}</p>
        </div>
        
        <div class="summary-card">
          <h3>TODOs & FIXMEs</h3>
          <p>${techDebt.summary.todoCount}</p>
        </div>
        
        <div class="summary-card">
          <h3>Complex Files</h3>
          <p>${techDebt.summary.complexFileCount}</p>
        </div>
        
        <div class="summary-card">
          <h3>Outdated Patterns</h3>
          <p>${techDebt.summary.outdatedPatternCount}</p>
        </div>
      </div>
      
      ${techDebt.todos.length > 0 ? `
      <div class="section">
        <h2>TODOs & FIXMEs</h2>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>File</th>
              <th>Line</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            ${techDebt.todos.map(todo => `
            <tr>
              <td>
                <span class="badge badge-${todo.type.toLowerCase().includes('todo') ? 'todo' : 
                                           todo.type.toLowerCase().includes('fixme') ? 'fixme' : 'hack'}">
                  ${todo.type}
                </span>
              </td>
              <td>${todo.file}</td>
              <td>${todo.line}</td>
              <td>${todo.message}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${techDebt.complexFiles.length > 0 ? `
      <div class="section">
        <h2>Complex Files</h2>
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Language</th>
              <th>Complexity</th>
              <th>Lines</th>
              <th>Functions</th>
              <th>Conditionals</th>
            </tr>
          </thead>
          <tbody>
            ${techDebt.complexFiles.map(file => `
            <tr>
              <td>${file.file}</td>
              <td>${file.language}</td>
              <td>
                <span class="badge badge-${file.complexity === 'high' ? 'high' : 'very-high'}">
                  ${file.complexity}
                </span>
              </td>
              <td>${file.metrics.lines}</td>
              <td>${file.metrics.functions !== undefined ? file.metrics.functions : 'N/A'}</td>
              <td>${file.metrics.conditionals !== undefined ? file.metrics.conditionals : 'N/A'}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${techDebt.outdatedPatterns.length > 0 ? `
      <div class="section">
        <h2>Outdated Patterns</h2>
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Line</th>
              <th>Pattern</th>
              <th>Suggestion</th>
            </tr>
          </thead>
          <tbody>
            ${techDebt.outdatedPatterns.map(pattern => `
            <tr>
              <td>${pattern.file}</td>
              <td>${pattern.line}</td>
              <td>${pattern.pattern}</td>
              <td>${pattern.suggestion}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
    </div>
  </body>
  </html>`;
  
    return html;
  }