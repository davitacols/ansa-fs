#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { 
  extractStructure, 
  formatAsTree, 
  toPaths, 
  getStats, 
  diffStructures, 
  exportToMarkdown, 
  exportToHtml, 
  watchStructure,
  analyzeCodeComplexity
} from './core.js';
import { 
  analyzeDuplication, 
  generateDuplicationReport 
} from './analyzers/duplication-analyzer.js';
import { 
  analyzeDependencies, 
  generateDependencyGraph 
} from './analyzers/dependency-analyzer.js';
import { 
  analyzeTechDebt, 
  generateTechDebtReport 
} from './analyzers/tech-debt-analyzer.js';
import { 
  analyzeGitHistory, 
  generateGitReport 
} from './analyzers/git-analyzer.js';
import { 
  analyzeDocumentation, 
  generateMarkdownDocumentation, 
  generateHtmlDocumentation 
} from './analyzers/documentation-analyzer.js';

// Package info
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

// Configure the CLI
program
  .name('ansa-fs')
  .description('A lightweight and flexible file system analyzer with advanced code analysis')
  .version(packageJson.version)
  
  // Basic options
  .option('-d, --depth <number>', 'maximum depth to traverse', 'Infinity')
  .option('-i, --ignore <dirs...>', 'directories to ignore', ['node_modules', '.git'])
  .option('--ignore-files <files...>', 'files to ignore', ['.DS_Store'])
  .option('-j, --json', 'output as JSON')
  .option('-p, --paths', 'output as a list of paths')
  .option('-s, --stats', 'show statistics')
  .option('-o, --output <file>', 'write output to a file')
  .option('-m, --markdown', 'export as Markdown')
  .option('--html', 'export as HTML')
  .option('--dark-mode', 'use dark mode for HTML output')
  .option('-w, --watch', 'watch for changes')
  
  // Complexity analysis
  .option('--analyze-complexity', 'analyze code complexity')
  .option('--complexity-threshold <threshold>', 'complexity threshold (low, medium, high)', 'medium')
  .option('--detailed-complexity', 'include detailed complexity metrics')
  
  // Duplication analysis
  .option('--analyze-duplication', 'detect code duplication')
  .option('--duplication-threshold <number>', 'minimum lines for duplication detection', '5')
  .option('--duplication-ignore <patterns...>', 'patterns to ignore in duplication detection', [])
  
  // Dependency analysis
  .option('--analyze-dependencies', 'analyze project dependencies')
  .option('--dependency-types <types...>', 'dependency types to analyze', ['js', 'ts', 'jsx', 'tsx'])
  .option('--include-external-deps', 'include external dependencies in analysis')
  
  // Technical debt analysis
  .option('--analyze-tech-debt', 'analyze technical debt')
  .option('--tech-debt-patterns <patterns...>', 'custom patterns to detect', ['TODO', 'FIXME', 'HACK'])
  .option('--tech-debt-threshold <number>', 'complexity threshold for tech debt', '15')
  
  // Git analysis
  .option('--analyze-git', 'analyze git history')
  .option('--git-depth <number>', 'number of commits to analyze', '100')
  .option('--git-since <date>', 'analyze commits since date')
  .option('--git-authors', 'include author statistics')
  
  // Documentation generation
  .option('--generate-docs', 'generate project documentation')
  .option('--docs-format <format>', 'documentation format (markdown, html, or both)', 'both')
  .option('--docs-title <title>', 'title for the documentation', 'Project Documentation')
  .option('--docs-output-dir <directory>', 'output directory for documentation files', './docs')
  .option('--docs-extract-comments', 'extract comments from code files', true)
  .option('--docs-extract-jsdoc', 'extract JSDoc/docstring comments', true)
  .option('--docs-include-readme', 'include README in documentation', true)
  .option('--docs-include-package-info', 'include package.json information', true)
  .option('--docs-include-structure', 'include project structure', true)
  .option('--docs-include-complexity', 'include code complexity information', true)
  .option('--docs-include-dependencies', 'include dependency information', true)
  
  // Comparison
  .option('--diff <directory>', 'compare with another directory')
  
  // Parse arguments
  .argument('[directory]', 'directory to analyze', '.')
  .parse(process.argv);

// Main function
async function main() {
  const options = program.opts();
  const directory = program.args[0] || '.';
  
  // Create a spinner for loading indication
  const spinner = ora('Analyzing file system...').start();
  
  try {
    // Configure extraction options
    const extractionOptions = {
      maxDepth: options.depth === 'Infinity' ? Number.POSITIVE_INFINITY : Number.parseInt(options.depth, 10),
      ignoreDirs: options.ignore,
      ignoreFiles: options.ignoreFiles,
      includeContent: options.analyzeComplexity || options.analyzeDuplication || options.analyzeDependencies || 
                     options.analyzeTechDebt || options.generateDocs,
      detectLanguage: options.analyzeComplexity || options.analyzeDuplication || options.analyzeDependencies || 
                     options.analyzeTechDebt || options.generateDocs,
      analyzeComplexity: options.analyzeComplexity,
      includeSize: true,
      complexityThreshold: options.complexityThreshold,
      detailedComplexity: options.detailedComplexity
    };
    
    // Extract the structure
    spinner.text = 'Extracting file system structure...';
    const structure = await extractStructure(directory, extractionOptions);
    structure.name = path.basename(path.resolve(directory));
    
    // Handle diff mode
    if (options.diff) {
      spinner.text = `Comparing with ${options.diff}...`;
      const otherStructure = await extractStructure(options.diff, extractionOptions);
      otherStructure.name = path.basename(path.resolve(options.diff));
      
      const diff = diffStructures(structure, otherStructure);
      
      spinner.succeed('Comparison completed');
      
      if (options.json) {
        outputResult(diff, options);
      } else {
        console.log(chalk.bold('\nComparison Results:'));
        console.log(chalk.bold('\nAdded:'));
        console.log(diff.added.length ? formatAsTree({ name: 'Added', children: diff.added }) : 'None');
        
        console.log(chalk.bold('\nRemoved:'));
        console.log(diff.removed.length ? formatAsTree({ name: 'Removed', children: diff.removed }) : 'None');
        
        console.log(chalk.bold('\nModified:'));
        console.log(diff.modified.length ? formatAsTree({ name: 'Modified', children: diff.modified }) : 'None');
      }
    }
    // Handle watch mode
    else if (options.watch) {
      spinner.succeed('Initial analysis completed');
      console.log(chalk.bold('\nWatching for changes...'));
      
      watchStructure(directory, (event, filename) => {
        console.log(chalk.bold(`\n${event}: ${filename}`));
        
        // Re-extract the structure
        extractStructure(directory, extractionOptions).then(newStructure => {
          newStructure.name = path.basename(path.resolve(directory));
          
          if (options.json) {
            console.log(JSON.stringify(newStructure, null, 2));
          } else if (options.paths) {
            console.log(toPaths(newStructure).join('\n'));
          } else {
            console.log(formatAsTree(newStructure));
          }
          
          if (options.stats) {
            const stats = getStats(newStructure);
            console.log(chalk.bold('\nStatistics:'));
            console.log(`Directories: ${stats.directories}`);
            console.log(`Files: ${stats.files}`);
            console.log(`Total Size: ${stats.totalSizeFormatted}`);
            
            if (stats.languageStats) {
              console.log(chalk.bold('\nLanguage Statistics:'));
              Object.entries(stats.languageStats).forEach(([language, count]) => {
                console.log(`${language}: ${count} files`);
              });
            }
          }
        });
      }, { ignoreDirs: options.ignore, ignoreFiles: options.ignoreFiles });
    }
    // Handle normal mode
    else {
      spinner.succeed('Analysis completed');
      
      // Perform additional analyses if requested
      let duplicationResults, dependencyResults, techDebtResults, gitResults, documentation;
      
      // Code duplication analysis
      if (options.analyzeDuplication) {
        spinner.text = 'Analyzing code duplication...';
        spinner.start();
        
        duplicationResults = analyzeDuplication(structure, {
          threshold: Number.parseInt(options.duplicationThreshold, 10),
          ignorePatterns: options.duplicationIgnore
        });
        
        spinner.succeed('Code duplication analysis completed');
        
        if (!options.output && !options.html && !options.markdown) {
          console.log(chalk.bold('\nDuplication Analysis Results:'));
          console.log(`Found ${duplicationResults.duplications.length} potential code duplications`);
          
          duplicationResults.duplications.forEach((dup, index) => {
            console.log(chalk.bold(`\nDuplication #${index + 1} (${dup.lines} lines):`));
            dup.instances.forEach(instance => {
              console.log(`- ${instance.file}:${instance.lineStart}-${instance.lineEnd}`);
            });
          });
        }
      }
      
      // Dependency analysis
      if (options.analyzeDependencies) {
        spinner.text = 'Analyzing project dependencies...';
        spinner.start();
        
        dependencyResults = analyzeDependencies(structure, {
          types: options.dependencyTypes,
          includeExternal: options.includeExternalDeps
        });
        
        spinner.succeed('Dependency analysis completed');
        
        if (!options.output && !options.html && !options.markdown) {
          console.log(chalk.bold('\nDependency Analysis Results:'));
          console.log(`Found ${dependencyResults.nodes.length} modules and ${dependencyResults.links.length} dependencies`);
          
          if (dependencyResults.externalDependencies && dependencyResults.externalDependencies.length > 0) {
            console.log(chalk.bold('\nExternal Dependencies:'));
            dependencyResults.externalDependencies.forEach(dep => {
              console.log(`- ${dep.name} (used by ${dep.usedBy.length} files)`);
            });
          }
        }
      }
      
      // Technical debt analysis
      if (options.analyzeTechDebt) {
        spinner.text = 'Analyzing technical debt...';
        spinner.start();
        
        techDebtResults = analyzeTechDebt(structure, {
          patterns: options.techDebtPatterns,
          complexityThreshold: Number.parseInt(options.techDebtThreshold, 10)
        });
        
        spinner.succeed('Technical debt analysis completed');
        
        if (!options.output && !options.html && !options.markdown) {
          console.log(chalk.bold('\nTechnical Debt Analysis Results:'));
          console.log(`Found ${techDebtResults.todos.length} TODOs/FIXMEs and ${techDebtResults.complexFiles.length} complex files`);
          
          if (techDebtResults.todos.length > 0) {
            console.log(chalk.bold('\nTODOs and FIXMEs:'));
            techDebtResults.todos.forEach(todo => {
              console.log(`- ${todo.file}:${todo.line} - ${todo.text}`);
            });
          }
          
          if (techDebtResults.complexFiles.length > 0) {
            console.log(chalk.bold('\nComplex Files:'));
            techDebtResults.complexFiles.forEach(file => {
              console.log(`- ${file.path} (Complexity: ${file.complexity})`);
            });
          }
        }
      }
      
      // Git history analysis
      if (options.analyzeGit) {
        spinner.text = 'Analyzing git history...';
        spinner.start();
        
        gitResults = await analyzeGitHistory(structure, {
          depth: Number.parseInt(options.gitDepth, 10),
          since: options.gitSince,
          includeAuthors: options.gitAuthors
        });
        
        spinner.succeed('Git history analysis completed');
        
        if (!options.output && !options.html && !options.markdown) {
          console.log(chalk.bold('\nGit History Analysis Results:'));
          console.log(`Analyzed ${gitResults.totalCommits} commits from ${gitResults.authors.length} authors`);
          
          if (gitResults.authors.length > 0) {
            console.log(chalk.bold('\nTop Contributors:'));
            gitResults.authors.slice(0, 5).forEach(author => {
              console.log(`- ${author.name}: ${author.commits} commits`);
            });
          }
          
          if (gitResults.hotFiles.length > 0) {
            console.log(chalk.bold('\nMost Changed Files:'));
            gitResults.hotFiles.slice(0, 5).forEach(file => {
              console.log(`- ${file.path}: ${file.changes} changes`);
            });
          }
        }
      }
      
      // Documentation generation
      if (options.generateDocs) {
        spinner.text = 'Generating project documentation...';
        spinner.start();
        
        // Configure documentation options
        const docsOptions = {
          title: options.docsTitle,
          extractComments: options.docsExtractComments !== false,
          extractJsDoc: options.docsExtractJsdoc !== false,
          includeReadme: options.docsIncludeReadme !== false,
          includePackageInfo: options.docsIncludePackageInfo !== false,
          includeStructure: options.docsIncludeStructure !== false,
          includeComplexity: options.docsIncludeComplexity !== false,
          includeDependencies: options.docsIncludeDependencies !== false,
          maxDepth: options.depth === 'Infinity' ? Number.POSITIVE_INFINITY : Number.parseInt(options.depth, 10),
          darkMode: options.darkMode
        };
        
        // Analyze documentation
        documentation = analyzeDocumentation(structure, docsOptions);
        
        // Create output directory if it doesn't exist
        const outputDir = options.docsOutputDir;
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Generate documentation in the specified format(s)
        const format = options.docsFormat.toLowerCase();
        
        if (format === 'markdown' || format === 'both') {
          const markdown = generateMarkdownDocumentation(documentation, docsOptions);
          fs.writeFileSync(`${outputDir}/documentation.md`, markdown);
        }
        
        if (format === 'html' || format === 'both') {
          const html = generateHtmlDocumentation(documentation, docsOptions);
          fs.writeFileSync(`${outputDir}/documentation.html`, html);
        }
        
        spinner.succeed('Project documentation generated successfully');
        console.log(chalk.green(`Documentation files written to ${outputDir}`));
      }
      
      // Output basic results if no specific analysis was requested
      if (!options.analyzeDuplication && !options.analyzeDependencies && 
          !options.analyzeTechDebt && !options.analyzeGit && !options.generateDocs) {
        
        // Output the structure
        if (options.json || options.paths || (!options.markdown && !options.html && !options.output)) {
          if (options.json) {
            outputResult(structure, options);
          } else if (options.paths) {
            outputResult(toPaths(structure).join('\n'), options);
          } else {
            console.log(formatAsTree(structure));
          }
        }
        
        // Output statistics if requested
        if (options.stats) {
          const stats = getStats(structure);
          console.log(chalk.bold('\nStatistics:'));
          console.log(`Directories: ${stats.directories}`);
          console.log(`Files: ${stats.files}`);
          console.log(`Total Size: ${stats.totalSizeFormatted}`);
          
          if (stats.languageStats) {
            console.log(chalk.bold('\nLanguage Statistics:'));
            Object.entries(stats.languageStats).forEach(([language, count]) => {
              console.log(`${language}: ${count} files`);
            });
          }
          
          if (options.analyzeComplexity && stats.complexityStats) {
            console.log(chalk.bold('\nComplexity Statistics:'));
            console.log(`Average Complexity: ${stats.complexityStats.average.toFixed(2)}`);
            console.log(`Max Complexity: ${stats.complexityStats.max} (${stats.complexityStats.maxFile})`);
            
            console.log(chalk.bold('\nComplexity Distribution:'));
            Object.entries(stats.complexityStats.distribution).forEach(([level, count]) => {
              console.log(`${level}: ${count} files`);
            });
          }
        }
        
        // Export to Markdown if requested
        if (options.markdown) {
          const markdown = exportToMarkdown(structure, {
            includeStats: options.stats,
            darkMode: options.darkMode
          });
          
          if (options.output) {
            fs.writeFileSync(options.output, markdown);
            console.log(chalk.green(`Markdown exported to ${options.output}`));
          } else {
            console.log(markdown);
          }
        }
        
        // Export to HTML if requested
        if (options.html) {
          const html = exportToHtml(structure, {
            includeStats: options.stats,
            darkMode: options.darkMode,
            includeComplexity: options.analyzeComplexity
          });
          
          if (options.output) {
            fs.writeFileSync(options.output, html);
            console.log(chalk.green(`HTML exported to ${options.output}`));
          } else {
            const tempFile = path.join(process.cwd(), 'ansa-fs-report.html');
            fs.writeFileSync(tempFile, html);
            console.log(chalk.green(`HTML exported to ${tempFile}`));
          }
        }
      } else {
        // Generate HTML reports for advanced analyses
        if (options.html) {
          if (options.analyzeDuplication && duplicationResults) {
            const htmlReport = generateDuplicationReport(duplicationResults, {
              darkMode: options.darkMode,
              title: `${structure.name} - Code Duplication Report`
            });
            
            const outputFile = options.output || 'duplication-report.html';
            fs.writeFileSync(outputFile, htmlReport);
            console.log(chalk.green(`Duplication report exported to ${outputFile}`));
          }
          
          if (options.analyzeDependencies && dependencyResults) {
            const htmlReport = generateDependencyGraph(dependencyResults, {
              darkMode: options.darkMode,
              title: `${structure.name} - Dependency Graph`
            });
            
            const outputFile = options.output || 'dependency-graph.html';
            fs.writeFileSync(outputFile, htmlReport);
            console.log(chalk.green(`Dependency graph exported to ${outputFile}`));
          }
          
          if (options.analyzeTechDebt && techDebtResults) {
            const htmlReport = generateTechDebtReport(techDebtResults, {
              darkMode: options.darkMode,
              title: `${structure.name} - Technical Debt Report`
            });
            
            const outputFile = options.output || 'tech-debt-report.html';
            fs.writeFileSync(outputFile, htmlReport);
            console.log(chalk.green(`Technical debt report exported to ${outputFile}`));
          }
          
          if (options.analyzeGit && gitResults) {
            const htmlReport = generateGitReport(gitResults, {
              darkMode: options.darkMode,
              title: `${structure.name} - Git History Report`
            });
            
            const outputFile = options.output || 'git-report.html';
            fs.writeFileSync(outputFile, htmlReport);
            console.log(chalk.green(`Git history report exported to ${outputFile}`));
          }
        }
      }
    }
  } catch (error) {
    spinner.fail('Analysis failed');
    console.error(chalk.red(`Error: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Helper function to output results
function outputResult(result, options) {
  const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  
  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(chalk.green(`Output written to ${options.output}`));
  } else {
    console.log(output);
  }
}

// Run the main function
main();