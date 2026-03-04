const fs = require('fs');

function replaceFile(path, replacer) {
  let content = fs.readFileSync(path, 'utf8');
  let original = content;
  content = replacer(content);
  if (content !== original) {
    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed:', path);
  }
}

replaceFile('src/pages/SettingsPage.tsx', (content) => {
  // 1. Toggles: Make them visible in light mode (gray instead of white)
  content = content.replace(/props\.checked \? 'bg-accent' : 'bg-surface'/g, "props.checked ? 'bg-accent' : 'bg-[var(--color-border)]'");
  
  // 2. Selects: Give them a slightly different background
  content = content.replace(/class=\{\`flex-1 bg-surface border border-border/g, "class={`flex-1 bg-surface-hover border border-border");
  content = content.replace(/class=\"bg-surface border border-border text-text/g, 'class="bg-surface-hover border border-border text-text');
  
  // 3. Inputs
  content = content.replace(/class=\"w-full bg-surface border border-border text-text/g, 'class="w-full bg-surface-hover border border-border text-text');

  // 4. iface-row
  content = content.replace(/background: var\(--color-surface\);/g, 'background: var(--color-surface-hover);');
  
  // 5. Upgrade prompts: make the background accent/10 instead of 0.05
  content = content.replace(/rgba\(59, 130, 246, 0.05\)/g, 'rgba(59, 130, 246, 0.1)');
  
  return content;
});

replaceFile('src/components/Sidebar.tsx', (content) => {
  content = content.replace(/color: props\.active \? "white" : undefined/g, 'color: props.active ? "var(--color-text)" : undefined');
  return content;
});
