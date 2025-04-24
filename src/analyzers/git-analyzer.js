// Git History Analyzer
import { execSync } from 'child_process';

export function analyzeGitHistory(structure, options = {}) {
  const opts = {
    maxCommits: 500,
    includeMergeCommits: false,
    since: '', // e.g., '1 month ago'
    ...options
  };
  
  // Check if directory is a git repository
  function isGitRepo(directory) {
    try {
      execSync('git rev-parse --is-inside-work-tree', { 
        cwd: directory,
        stdio: 'ignore' 
      });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // Get repository root
  function getRepoRoot(directory) {
    try {
      return execSync('git rev-parse --show-toplevel', { 
        cwd: directory,
        encoding: 'utf8' 
      }).trim();
    } catch (error) {
      return null;
    }
  }
  
  // Get commit history
  function getCommitHistory(directory) {
    const sinceOption = opts.since ? `--since="${opts.since}"` : '';
    const mergeOption = opts.includeMergeCommits ? '' : '--no-merges';
    const format = '%H|%an|%ae|%at|%s';
    
    try {
      const command = `git log ${mergeOption} ${sinceOption} -n ${opts.maxCommits} --pretty=format:"${format}"`;
      const output = execSync(command, { 
        cwd: directory,
        encoding: 'utf8' 
      });
      
      return output.split('\n').filter(Boolean).map(line => {
        const [hash, author, email, timestamp, subject] = line.split('|');
        return {
          hash,
          author,
          email,
          date: new Date(parseInt(timestamp) * 1000),
          subject
        };
      });
    } catch (error) {
      return [];
    }
  }
  
  // Get file history
  function getFileHistory(filePath, directory) {
    try {
      const command = `git log --follow --pretty=format:"%H|%an|%ae|%at|%s" -- "${filePath}"`;
      const output = execSync(command, { 
        cwd: directory,
        encoding: 'utf8' 
      });
      
      return output.split('\n').filter(Boolean).map(line => {
        const [hash, author, email, timestamp, subject] = line.split('|');
        return {
          hash,
          author,
          email,
          date: new Date(parseInt(timestamp) * 1000),
          subject
        };
      });
    } catch (error) {
      return [];
    }
  }
  
  // Get file blame information
  function getFileBlame(filePath, directory) {
    try {
      const command = `git blame -w -M -C --line-porcelain "${filePath}"`;
      const output = execSync(command, { 
        cwd: directory,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large files
      });
      
      const lines = output.split('\n');
      const blame = [];
      let currentBlame = null;
      
      for (const line of lines) {
        if (line.startsWith('author ')) {
          currentBlame = {
            author: line.substring(7),
            lines: 1
          };
          blame.push(currentBlame);
        } else if (line.startsWith('author-mail ')) {
          currentBlame.email = line.substring(12).replace(/[<>]/g, '');
        } else if (line.startsWith('author-time ')) {
          currentBlame.timestamp = parseInt(line.substring(12));
          currentBlame.date = new Date(currentBlame.timestamp * 1000);
        } else if (line.startsWith('summary ')) {
          currentBlame.summary = line.substring(8);
        }
      }
      
      // Consolidate blame by author
      const blameByAuthor = {};
      
      blame.forEach(item => {
        if (!blameByAuthor[item.author]) {
          blameByAuthor[item.author] = {
            author: item.author,
            email: item.email,
            lines: 0,
            commits: new Set()
          };
        }
        
        blameByAuthor[item.author].lines += item.lines;
        if (item.summary) {
          blameByAuthor[item.author].commits.add(item.summary);
        }
      });
      
      // Convert to array and calculate percentages
      const totalLines = blame.length;
      const result = Object.values(blameByAuthor).map(author => ({
        author: author.author,
        email: author.email,
        lines: author.lines,
        percentage: Math.round((author.lines / totalLines) * 100),
        commits: author.commits.size
      }));
      
      return result.sort((a, b) => b.lines - a.lines);
    } catch (error) {
      return [];
    }
  }
  
  // Get contributors
  function getContributors(directory) {
    try {
      const command = `git shortlog -sne --all`;
      const output = execSync(command, { 
        cwd: directory,
        encoding: 'utf8' 
      });
      
      return output.split('\n').filter(Boolean).map(line => {
        const match = line.match(/^\s*(\d+)\s+(.+?)\s+<(.+?)>$/);
        if (match) {
          return {
            commits: parseInt(match[1]),
            name: match[2],
            email: match[3]
          };
        }
        return null;
      }).filter(Boolean);
    } catch (error) {
      return [];
    }
  }
  
  // Analyze file churn (frequency of changes)
  function getFileChurn(directory) {
    try {
      const command = `git log --name-only --pretty=format: | grep -v '^$' | sort | uniq -c | sort -nr | head -n 50`;
      const output = execSync(command, { 
        cwd: directory,
        encoding: 'utf8',
        shell: '/bin/bash'
      });
      
      return output.split('\n').filter(Boolean).map(line => {
        const match = line.match(/^\s*(\d+)\s+(.+)$/);
        if (match) {
          return {
            changes: parseInt(match[1]),
            file: match[2]
          };
        }
        return null;
      }).filter(Boolean);
    } catch (error) {
      return [];
    }
  }
  
  // Main analysis function
  function analyzeRepository(directory) {
    if (!isGitRepo(directory)) {
      return {
        isGitRepo: false,
        error: 'Not a git repository'
      };
    }
    
    const repoRoot = getRepoRoot(directory);
    const commits = getCommitHistory(directory);
    const contributors = getContributors(directory);
    const fileChurn = getFileChurn(directory);
    
    // Analyze files in the structure
    const files = [];
    
    function traverseFiles(node, currentPath = '') {
      if (node.type === 'file') {
        const filePath = node.path;
        const relativePath = filePath.replace(repoRoot + '/', '');
        
        const history = getFileHistory(filePath, directory);
        const blame = getFileBlame(filePath, directory);
        
        files.push({
          path: relativePath,
          history,
          blame,
          lastModified: history.length > 0 ? history[0].date : null,
          authors: blame.map(b => b.author),
          mainAuthor: blame.length > 0 ? blame[0].author : null,
          mainAuthorPercentage: blame.length > 0 ? blame[0].percentage : 0
        });
      }
      
      if (node.children) {
        node.children.forEach(child => traverseFiles(child, currentPath + '/' + node.name));
      }
    }
    
    traverseFiles(structure);
    
    // Calculate commit frequency over time
    const commitDates = commits.map(commit => commit.date);
    const oldestCommit = commitDates.length > 0 ? new Date(Math.min(...commitDates.map(d => d.getTime()))) : null;
    const newestCommit = commitDates.length > 0 ? new Date(Math.max(...commitDates.map(d => d.getTime()))) : null;
    
    // Group commits by month
    const commitsByMonth = {};
    
    if (oldestCommit && newestCommit) {
      commits.forEach(commit => {
        const date = commit.date;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!commitsByMonth[monthKey]) {
          commitsByMonth[monthKey] = {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            count: 0,
            authors: new Set()
          };
        }
        
        commitsByMonth[monthKey].count++;
        commitsByMonth[monthKey].authors.add(commit.author);
      });
    }
    
    // Convert to array and sort by date
    const commitTimeline = Object.values(commitsByMonth).map(month => ({
      ...month,
      authors: Array.from(month.authors)
    })).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    
    return {
      isGitRepo: true,
      repoRoot,
      commits: {
        total: commits.length,
        first: oldestCommit,
        last: newestCommit,
        timeline: commitTimeline
      },
      contributors: contributors.map(contributor => ({
        ...contributor,
        percentage: Math.round((contributor.commits / commits.length) * 100)
      })),
      files,
      fileChurn
    };
  }
  
  return analyzeRepository(structure.path);
}

// Generate HTML report for Git history
export function generateGitReport(gitData, options = {}) {
  if (!gitData.isGitRepo) {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Git Analysis Report</title>
</head>
<body>
  <h1>Git Analysis Report</h1>
  <p>Error: ${gitData.error}</p>
</body>
</html>`;
  }
  
  const opts = {
    title: 'Git History Analysis',
    ...options
  };
  
  // Prepare data for charts
  const timelineLabels = gitData.commits.timeline.map(month => `${month.year}-${String(month.month).padStart(2, '0')}`);
  const timelineData = gitData.commits.timeline.map(month => month.count);
  
  const contributorLabels = gitData.contributors.slice(0, 10).map(c => c.name);
  const contributorData = gitData.contributors.slice(0, 10).map(c => c.commits);
  
  const churnLabels = gitData.fileChurn.slice(0, 10).map(f => f.file);
  const churnData = gitData.fileChurn.slice(0, 10).map(f => f.changes);
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
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
    
    .chart-container {
      background-color: white;
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
    
    .progress {
      height: 8px;
      background-color: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .progress-bar {
      height: 100%;
      background-color: #0d6efd;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${opts.title}</h1>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Total Commits</h3>
        <p>${gitData.commits.total}</p>
      </div>
      
      <div class="summary-card">
        <h3>Contributors</h3>
        <p>${gitData.contributors.length}</p>
      </div>
      
      <div class="summary-card">
        <h3>First Commit</h3>
        <p>${gitData.commits.first ? gitData.commits.first.toLocaleDateString() : 'N/A'}</p>
      </div>
      
      <div class="summary-card">
        <h3>Latest Commit</h3>
        <p>${gitData.commits.last ? gitData.commits.last.toLocaleDateString() : 'N/A'}</p>
      </div>
    </div>
    
    <div class="charts-grid">
      <div class="chart-container">
        <h2>Commit Activity</h2>
        <canvas id="commit-timeline"></canvas>
      </div>
      
      <div class="chart-container">
        <h2>Top Contributors</h2>
        <canvas id="contributors-chart"></canvas>
      </div>
      
      <div class="chart-container">
        <h2>Most Changed Files</h2>
        <canvas id="churn-chart"></canvas>
      </div>
    </div>
    
    <div class="section">
      <h2>Top Contributors</h2>
      <table>
        <thead>
          <tr>
            <th>Author</th>
            <th>Email</th>
            <th>Commits</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${gitData.contributors.slice(0, 20).map(contributor => `
          <tr>
            <td>${contributor.name}</td>
            <td>${contributor.email}</td>
            <td>${contributor.commits}</td>
            <td>
              <div class="progress">
                <div class="progress-bar" style="width: ${contributor.percentage}%"></div>
              </div>
              ${contributor.percentage}%
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <h2>Most Changed Files</h2>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Changes</th>
          </tr>
        </thead>
        <tbody>
          ${gitData.fileChurn.slice(0, 20).map(file => `
          <tr>
            <td>${file.file}</td>
            <td>${file.changes}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
  
  <script>
    // Commit timeline chart
    const timelineCtx = document.getElementById('commit-timeline');
    new Chart(timelineCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(timelineLabels)},
        datasets: [{
          label: 'Commits',
          data: ${JSON.stringify(timelineData)},
          backgroundColor: 'rgba(13, 110, 253, 0.2)',
          borderColor: 'rgba(13, 110, 253, 1)',
          borderWidth: 1,
          tension: 0.1,
          fill: true
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
    
    // Contributors chart
    const contributorsCtx = document.getElementById('contributors-chart');
    new Chart(contributorsCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(contributorLabels)},
        datasets: [{
          label: 'Commits',
          data: ${JSON.stringify(contributorData)},
          backgroundColor: 'rgba(13, 110, 253, 0.7)',
          borderColor: 'rgba(13, 110, 253, 1)',
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
    
    // File churn chart
    const churnCtx = document.getElementById('churn-chart');
    new Chart(churnCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(churnLabels)},
        datasets: [{
          label: 'Changes',
          data: ${JSON.stringify(churnData)},
          backgroundColor: 'rgba(220, 53, 69, 0.7)',
          borderColor: 'rgba(220, 53, 69, 1)',
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
  </script>
</body>
</html>`;

  return html;
}