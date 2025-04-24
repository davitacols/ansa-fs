/**
 * Content analyzer for ansa-fs
 * Provides utilities for analyzing file contents
 */

/**
 * Detect code complexity based on file content
 * @param {string} content - File content
 * @param {string} language - Detected language
 * @returns {Object} - Complexity metrics
 */
export function analyzeCodeComplexity(content, language) {
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
 * Detect dependencies in code files
 * @param {string} content - File content
 * @param {string} filename - File name
 * @param {string} language - Detected language
 * @returns {string[]} - Array of detected dependencies
 */
export function detectDependencies(content, filename, language) {
  if (!content) return [];

  const dependencies = [];

  switch (language) {
    case "JavaScript":
    case "JavaScript (React)":
    case "TypeScript":
    case "TypeScript (React)":
      // Detect import statements
      const importMatches = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g) || [];
      const requireMatches = content.match(/require\s*$$\s*['"]([^'"]+)['"]\s*$$/g) || [];

      // Extract package names
      importMatches.forEach((match) => {
        const packageMatch = match.match(/from\s+['"]([^'"]+)['"]/)
        if (packageMatch && packageMatch[1]) {
          const packageName = packageMatch[1].split("/")[0]
          if (!packageName.startsWith(".") && !dependencies.includes(packageName)) {
            dependencies.push(packageName)
          }
        }
      });

      requireMatches.forEach((match) => {
        const packageMatch = match.match(/require\s*$$\s*['"]([^'"]+)['"]\s*$$/)
        if (packageMatch && packageMatch[1]) {
          const packageName = packageMatch[1].split("/")[0]
          if (!packageName.startsWith(".") && !dependencies.includes(packageName)) {
            dependencies.push(packageName)
          }
        }
      });
      break;

    case "Python":
      // Detect import statements
      const pythonImports = content.match(/import\s+(\w+)|from\s+(\w+)\s+import/g) || [];

      pythonImports.forEach((match) => {
        const importMatch = match.match(/import\s+(\w+)/)
        const fromMatch = match.match(/from\s+(\w+)\s+import/)

        if (importMatch && importMatch[1]) {
          const packageName = importMatch[1]
          if (!dependencies.includes(packageName)) {
            dependencies.push(packageName)
          }
        } else if (fromMatch && fromMatch[1]) {
          const packageName = fromMatch[1]
          if (!dependencies.includes(packageName)) {
            dependencies.push(packageName)
          }
        }
      });
      break;

    case "Java":
      // Detect import statements
      const javaImports = content.match(/import\s+([^;]+);/g) || [];

      javaImports.forEach((match) => {
        const importMatch = match.match(/import\s+([^;]+);/)
        if (importMatch && importMatch[1]) {
          const packageParts = importMatch[1].split(".")
          if (packageParts.length > 1) {
            const packageName = packageParts[0]
            if (!dependencies.includes(packageName)) {
              dependencies.push(packageName)
            }
          }
        }
      });
      break;
  }

  return dependencies;
}