const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  if (dir.includes('node_modules') || dir.includes('dist') || dir.includes('.git') || dir.includes('mobile_app_flutter')) {
    return filelist; // don't touch mobile UI yet, doing frontend and backend
  }
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    const dirent = fs.statSync(dirFile);
    if (dirent.isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (['.js', '.jsx'].some(ext => file.endsWith(ext))) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
};

const replaceInFiles = () => {
    let affected = 0;
    const basePaths = [path.resolve(__dirname, '../frontend/src'), path.resolve(__dirname, '../backend/src')];
    
    let allFiles = [];
    basePaths.forEach(p => {
        allFiles = allFiles.concat(walkSync(p));
    });

    allFiles.forEach(file => {
        let originalContent = fs.readFileSync(file, 'utf8');
        let newContent = originalContent;

        newContent = newContent.replace(/\bformatMATIC\b/g, 'formatINR');
        newContent = newContent.replace(/\bMATIC\b/g, 'INR');

        if (originalContent !== newContent) {
            fs.writeFileSync(file, newContent, 'utf8');
            console.log(`Replaced in ${file}`);
            affected++;
        }
    });

    console.log(`Finished processing. Updated ${affected} files.`);
};

replaceInFiles();
