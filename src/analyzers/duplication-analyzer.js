// Code Duplication Analyzer
export function analyzeDuplication(structure, options = {}) {
    const opts = {
      minLines: 5,           // Minimum lines to consider for duplication
      similarityThreshold: 0.8, // Similarity threshold (0.0-1.0)
      ...options
    };
  
    const fileContents = {};
    const duplications = [];
  
    // Extract file contents
    function extractContents(node) {
      if (node.type === 'file' && node.content && node.language) {
        // Only analyze source code files
        if (['JavaScript', 'TypeScript', 'Python', 'Java', 'C', 'C++', 'C#', 'Ruby', 'Go'].includes(node.language)) {
          fileContents[node.path] = {
            content: node.content,
            language: node.language,
            path: node.path,
            lines: node.content.split('\n')
          };
        }
      }
      
      if (node.children) {
        node.children.forEach(extractContents);
      }
    }
    
    extractContents(structure);
    
    // Compare files for duplications
    const filePaths = Object.keys(fileContents);
    
    for (let i = 0; i < filePaths.length; i++) {
      const fileA = fileContents[filePaths[i]];
      
      for (let j = i + 1; j < filePaths.length; j++) {
        const fileB = fileContents[filePaths[j]];
        
        // Only compare files of the same language
        if (fileA.language !== fileB.language) continue;
        
        const duplicateBlocks = findDuplicateBlocks(fileA, fileB, opts);
        
        if (duplicateBlocks.length > 0) {
          duplications.push({
            fileA: fileA.path,
            fileB: fileB.path,
            language: fileA.language,
            blocks: duplicateBlocks
          });
        }
      }
    }
    
    return {
      totalDuplications: duplications.length,
      duplications
    };
  }
  
  function findDuplicateBlocks(fileA, fileB, options) {
    const blocks = [];
    const linesA = fileA.lines;
    const linesB = fileB.lines;
    
    for (let i = 0; i <= linesA.length - options.minLines; i++) {
      const blockA = linesA.slice(i, i + options.minLines).join('\n');
      
      for (let j = 0; j <= linesB.length - options.minLines; j++) {
        const blockB = linesB.slice(j, j + options.minLines).join('\n');
        
        const similarity = calculateSimilarity(blockA, blockB);
        
        if (similarity >= options.similarityThreshold) {
          // Extend the block to find the full duplicate
          let endA = i + options.minLines;
          let endB = j + options.minLines;
          
          while (endA < linesA.length && endB < linesB.length && 
                 linesA[endA] === linesB[endB]) {
            endA++;
            endB++;
          }
          
          blocks.push({
            fileAStart: i + 1,
            fileAEnd: endA,
            fileBStart: j + 1,
            fileBEnd: endB,
            lines: endA - i,
            content: linesA.slice(i, endA).join('\n')
          });
          
          // Skip ahead to avoid overlapping blocks
          j = endB - 1;
        }
      }
    }
    
    return blocks;
  }
  
  function calculateSimilarity(textA, textB) {
    // Simple similarity calculation
    // For a production tool, consider using Levenshtein distance or other algorithms
    if (textA === textB) return 1.0;
    
    const tokensA = textA.split(/\s+/);
    const tokensB = textB.split(/\s+/);
    
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    
    return intersection.size / union.size;
  }