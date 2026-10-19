export const TEXT_EXTENSIONS = new Set([
  // Text, notes & subtitles
  'txt', 'text', 'log', 'nfo', 'diz', 'me', 'sub', 'srt', 'vtt',
  // Markdown & docs
  'md', 'markdown', 'mdown', 'mkdn', 'mdx', 'rst', 'adoc', 'asciidoc', 'tex',
  // Data, config & interchange
  'json', 'json5', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'cnf',
  'config', 'env', 'properties', 'xml', 'xsl', 'xslt', 'svg', 'csv', 'tsv', 'plist', 'reg',
  // Web & UI
  'html', 'htm', 'xhtml', 'css', 'scss', 'sass', 'less',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'vue', 'svelte', 'astro', 'php',
  // Scripts & programming languages
  'py', 'pyw', 'rs', 'c', 'h', 'cpp', 'hpp', 'cxx', 'hxx', 'cc', 'cs', 'java',
  'kt', 'kts', 'go', 'rb', 'lua', 'pl', 'pm', 'r', 'dart', 'swift', 'scala',
  'bat', 'cmd', 'ps1', 'psm1', 'psd1', 'sh', 'bash', 'zsh', 'fish', 'vbs', 'sql',
  'graphql', 'gql', 'prisma', 'proto'
]);

export const TEXT_FILENAMES = new Set([
  'dockerfile', 'makefile', 'gemfile', 'licence', 'license', 'readme', 'changelog', 'procfile',
  '.gitignore', '.gitattributes', '.editorconfig', '.prettierrc', '.eslintrc', '.npmrc', '.env'
]);

export function isTextLikeFile(fileNameOrExt: string, ext?: string): boolean {
  if (!fileNameOrExt) return false;
  const e = (ext || (fileNameOrExt.includes('.') ? fileNameOrExt.split('.').pop() : fileNameOrExt) || '').toLowerCase().replace(/^\./, '');
  if (TEXT_EXTENSIONS.has(e)) return true;
  const name = fileNameOrExt.toLowerCase();
  if (TEXT_FILENAMES.has(name) || name.startsWith('.env')) return true;
  return false;
}
