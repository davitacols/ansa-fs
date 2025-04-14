#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { program } = require("commander")
const chalk = require("chalk")
const ora = require("ora")
const chokidar = require("chokidar")
const {
  extractStructure,
  formatAsTree,
  toPaths,
  getStats,
  diffStructures,
  exportToMarkdown,
  watchStructure,
} = require("./index")

// Package info
const packageJson = require("../package.json")

// Configure CLI
program
  .name("ansa-fs")
  .description("Extract and visualize file system structures")
  .version(packageJson.version)
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
  .option("--diff <directory>", "compare with another directory")
  .option("--watch", "watch for changes")
  .option("--output <file>", "write output to a file")
  .option("--no-color", "disable colored output")
  .parse(process.argv)

// Main function
async function main() {
  const options = program.opts()
  const directory = program.args[0] || "."

  // Configure extraction options
  const extractOptions = {
    maxDepth:
      options.depth === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Number.parseInt(options.depth, 10),
    showFiles: !options.dirsOnly,
    includeSize: options.size,
    includeHash: options.hash,
    includeModTime: options.modTime,
    includeContent: options.content,
    detectLanguage: options.detectLanguage,
  }

  // Add custom ignore paths
  if (options.ignore) {
    extractOptions.ignoreDirs = [...extractOptions.ignoreDirs, ...options.ignore]
    extractOptions.ignoreFiles = [...extractOptions.ignoreFiles, ...options.ignore]
  }

  // Add custom ignore extensions
  if (options.ignoreExt) {
    extractOptions.ignoreExtensions = options.ignoreExt
  }

  // Handle watch mode
  if (options.watch) {
    console.log(chalk.cyan(`Watching ${directory} for changes...`))
    console.log(chalk.gray("Press Ctrl+C to stop"))

    const watcher = watchStructure(
      directory,
      (error, structure, meta) => {
        if (error) {
          console.error(chalk.red(`Error: ${error.message}`))
          return
        }

        // Clear console and show updated structure
        process.stdout.write("\x1Bc")
        console.log(chalk.cyan(`Watching ${directory} for changes...`))
        console.log(chalk.gray("Press Ctrl+C to stop"))

        if (meta.initialScan) {
          console.log(chalk.green("Initial scan complete"))
        } else {
          console.log(chalk.green("Changes detected, updated structure:"))
        }

        outputStructure(structure, options)
      },
      extractOptions,
    )

    // Handle exit
    process.on("SIGINT", () => {
      watcher.stop()
      console.log(chalk.yellow("\nWatcher stopped"))
      process.exit(0)
    })

    return
  }

  // Handle normal mode
  const spinner = ora("Scanning directory...").start()

  try {
    // Extract structure
    const structure = await extractStructure(directory, extractOptions)
    spinner.succeed("Directory scanned successfully")

    // Handle diff mode
    if (options.diff) {
      spinner.text = "Comparing directories..."
      spinner.start()

      const otherStructure = await extractStructure(options.diff, extractOptions)
      spinner.succeed("Comparison complete")

      const diff = diffStructures(structure, otherStructure, {
        compareContent: options.content,
        compareSize: options.size,
        compareModTime: options.modTime,
      })

      outputDiff(diff, options)
    } else {
      // Normal output
      outputStructure(structure, options)
    }
  } catch (error) {
    spinner.fail(chalk.red(`Error: ${error.message}`))
    process.exit(1)
  }
}

// Output structure based on options
function outputStructure(structure, options) {
  let output = ""

  if (options.json) {
    // JSON output
    output = JSON.stringify(structure, null, 2)
  } else if (options.paths) {
    // Paths output
    const paths = toPaths(structure, {
      includeFiles: !options.dirsOnly,
      includeDirs: !options.filesOnly,
    })
    output = paths.join("\n")
  } else if (options.stats) {
    // Stats output
    const stats = getStats(structure)
    output = formatStats(stats)
  } else if (options.markdown) {
    // Markdown output
    output = exportToMarkdown(structure, {
      title: `Directory Structure: ${structure.name}`,
      includeStats: true,
      includeSize: options.size,
    })
  } else {
    // Tree output
    output = formatAsTree(structure, {
      showSize: options.size,
      showModTime: options.modTime,
    })
  }

  // Write to file or stdout
  if (options.output) {
    fs.writeFileSync(options.output, output)
    console.log(chalk.green(`Output written to ${options.output}`))
  } else {
    console.log(output)
  }
}

// Output diff results
function outputDiff(diff, options) {
  console.log(chalk.bold("\nDirectory Comparison Results:"))

  console.log(chalk.green(`\nAdded (${diff.added.length}):`))
  if (diff.added.length > 0) {
    diff.added.forEach((item) => {
      console.log(`  + ${item.path} (${item.type})`)
    })
  } else {
    console.log("  None")
  }

  console.log(chalk.red(`\nRemoved (${diff.removed.length}):`))
  if (diff.removed.length > 0) {
    diff.removed.forEach((item) => {
      console.log(`  - ${item.path} (${item.type})`)
    })
  } else {
    console.log("  None")
  }

  console.log(chalk.yellow(`\nModified (${diff.modified.length}):`))
  if (diff.modified.length > 0) {
    diff.modified.forEach((item) => {
      console.log(`  ~ ${item.path} (${item.type})`)

      if (item.modifications) {
        Object.entries(item.modifications).forEach(([key, value]) => {
          switch (key) {
            case "typeChanged":
              console.log(`    Type changed: ${value.from} → ${value.to}`)
              break
            case "sizeChanged":
              console.log(`    Size changed: ${value.fromFormatted} → ${value.toFormatted}`)
              break
            case "modTimeChanged":
              console.log(`    Modified time changed: ${value.from} → ${value.to}`)
              break
            case "contentChanged":
              console.log(`    Content changed`)
              break
            case "hashChanged":
              console.log(`    Hash changed: ${value.from.substring(0, 8)} → ${value.to.substring(0, 8)}`)
              break
          }
        })
      }
    })
  } else {
    console.log("  None")
  }

  console.log(chalk.cyan(`\nUnchanged: ${diff.unchanged.length} items`))

  // Write to file if requested
  if (options.output) {
    const output = JSON.stringify(diff, null, 2)
    fs.writeFileSync(options.output, output)
    console.log(chalk.green(`\nDetailed diff written to ${options.output}`))
  }
}

// Format stats for display
function formatStats(stats) {
  let output = chalk.bold("Directory Statistics:\n\n")

  output += `Total directories: ${stats.directories}\n`
  output += `Total files: ${stats.files}\n`

  if (stats.totalSizeFormatted) {
    output += `Total size: ${stats.totalSizeFormatted}\n`
  }

  if (Object.keys(stats.extensions).length > 0) {
    output += chalk.bold("\nFile Extensions:\n")

    Object.entries(stats.extensions)
      .sort((a, b) => b[1] - a[1])
      .forEach(([ext, count]) => {
        output += `  .${ext}: ${count} files\n`
      })
  }

  if (stats.largestFiles.length > 0) {
    output += chalk.bold("\nLargest Files:\n")

    stats.largestFiles.forEach((file, index) => {
      output += `  ${index + 1}. ${file.path} (${file.sizeFormatted})\n`
    })
  }

  if (stats.newestFiles.length > 0) {
    output += chalk.bold("\nMost Recently Modified Files:\n")

    stats.newestFiles.forEach((file, index) => {
      output += `  ${index + 1}. ${file.path} (${file.modTimeFormatted})\n`
    })
  }

  return output
}

// Run the CLI
main().catch((error) => {
  console.error(chalk.red(`Error: ${error.message}`))
  process.exit(1)
})
