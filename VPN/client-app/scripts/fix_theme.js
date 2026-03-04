const fs = require('fs');

function processFile(path, replacer) {
  let content = fs.readFileSync(path, 'utf8');
  let original = content;
  content = replacer(content);
  if (content !== original) {
    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed:', path);
  }
}

// Sidebar.tsx
processFile('src/components/Sidebar.tsx', (content) => {
  // Fix text colors in Sidebar items
  content = content.replace(/text-white/g, 'text-text');
  content = content.replace(/hover:bg-white\/5/g, 'hover:bg-surface-hover');
  content = content.replace(/text-gray-400/g, 'text-text-dim');
  content = content.replace(/text-gray-200/g, 'text-text');
  content = content.replace(/bg-accent\/15/g, 'bg-accent/15');
  
  // Convert explicit whites and dark styles to vars
  content = content.replace(/color: props.active \? "white" : undefined/g, 'color: props.active ? "var(--color-text)" : undefined');
  return content;
});

// SettingsPage.tsx
processFile('src/pages/SettingsPage.tsx', (content) => {
  // Fix toggles
  content = content.replace(/props\.checked \? 'bg-accent' : 'bg-surface'/g, "props.checked ? 'bg-accent' : 'bg-[var(--color-border)]'");
  
  // Fix select background
  content = content.replace(/bg-surface border border-border text-text text-\[13px\] rounded focus:outline-none focus:border-accent w-full/g, 'bg-surface-hover border border-border text-text text-[13px] rounded focus:outline-none focus:border-accent w-full');
  
  // Fix iface-row
  content = content.replace(/background: var\(--color-surface\);(\s*)border: 1px solid var\(--color-border\);/g, 'background: var(--color-surface-hover);$1border: 1px solid var(--color-border);');
  
  // Fix free tier warning
  content = content.replace(/background: "rgba\\(59, 130, 246, 0.05\\)",/g, 'background: "rgba(59, 130, 246, 0.1)",');
  
  return content;
});

// HomePage.tsx
processFile('src/pages/HomePage.tsx', (content) => {
  // Fix bottom bar background
  content = content.replace(/background: rgba\(12,12,18,0.95\);/g, 'background: var(--color-surface);');
  
  // Fix text white
  content = content.replace(/text-white/g, 'text-text');

  // Fix dim text
  content = content.replace(/text-dim/g, 'text-text-dim');
  return content;
});

processFile('src/components/ConnectButton.tsx', (content) => {
  // Map pulse and colors
  // Connect button background is currently likely dark or something.
  return content;
});
