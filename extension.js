const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');

const DEFAULT_SUPPORTED_EXTENSIONS = [
  'md',
  'markdown',
  'mdown',
  'mmd',
  'text',
  'txt',
  'rmarkdown',
  'mkd',
  'mdwn',
  'mdtxt',
  'rmd',
  'qmd',
  'mdtext',
  'mdx'
];

function openWithTypora(filePath) {
  const platform = process.platform;

  if (platform === 'darwin') {
    return spawn('open', ['-a', 'Typora', filePath], { stdio: 'ignore' });
  }

  if (platform === 'win32') {
    return spawn('cmd', ['/c', 'start', '', 'typora', filePath], {
      detached: true,
      stdio: 'ignore'
    });
  }

  return spawn('typora', [filePath], {
    detached: true,
    stdio: 'ignore'
  });
}

function getSupportedExtensions() {
  const config = vscode.workspace.getConfiguration('typora');
  const configured = config.get('supportedExtensions');

  if (!Array.isArray(configured)) {
    return new Set(DEFAULT_SUPPORTED_EXTENSIONS);
  }

  const normalized = configured
    .map((item) => String(item).trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean);

  return new Set(normalized.length > 0 ? normalized : DEFAULT_SUPPORTED_EXTENSIONS);
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const disposable = vscode.commands.registerCommand('typora.openInTypora', async (uri) => {
    const targetUri = uri || vscode.window.activeTextEditor?.document?.uri;

    if (!targetUri || targetUri.scheme !== 'file') {
      vscode.window.showErrorMessage('Please select a local Markdown file.');
      return;
    }

    const ext = path.extname(targetUri.fsPath).toLowerCase().replace(/^\./, '');
    const supportedExtensions = getSupportedExtensions();
    if (!supportedExtensions.has(ext)) {
      const configuredList = Array.from(supportedExtensions).map((item) => `.${item}`).join(', ');
      vscode.window.showErrorMessage(`Open in Typora only supports: ${configuredList}`);
      return;
    }

    try {
      const child = openWithTypora(targetUri.fsPath);
      child.on('error', () => {
        vscode.window.showErrorMessage('Failed to launch Typora. Make sure Typora is installed.');
      });
      child.unref();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file in Typora: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
