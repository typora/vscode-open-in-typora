const vscode = require('vscode');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
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

/**
 * A non-zero exit code inside this window means the launch failed. Exits that
 * happen later (the user quitting Typora, or a crash hours afterwards) must
 * stay silent.
 */
const LAUNCH_FAILURE_WINDOW_MS = 5000;

/**
 * Resolves `typora.executablePath`. An empty string means "keep the platform
 * default", which is what every existing setup gets.
 */
function getConfiguredExecutable() {
  const configured = vscode.workspace.getConfiguration('typora').get('executablePath');

  if (typeof configured !== 'string') {
    return '';
  }

  const value = configured.trim();

  if (value === '~' || value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(1));
  }

  return value;
}

/**
 * The extension host itself runs as an Electron process in Node mode and
 * exports ELECTRON_RUN_AS_NODE=1. Children inherit it, which turns any Electron
 * app started from here into a plain Node runtime: Typora then tries to execute
 * the Markdown file as JavaScript and dies with a SyntaxError. Drop the variable
 * before spawning an external application.
 */
function getChildEnv() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

/**
 * Looks `name` up on PATH, honouring the Windows executable extensions. Used to
 * decide whether the legacy `cmd /c start` route stands any chance: `start`
 * resolves the name through ShellExecute, which reports success even when it
 * cannot find anything, so a failing launch is otherwise indistinguishable from
 * a working one.
 */
function findOnPath(name) {
  const isWindows = process.platform === 'win32';
  const extensions = isWindows ? ['.exe', '.cmd', '.bat', '.com'] : [''];
  const directories = (process.env.PATH || '').split(path.delimiter).filter(Boolean);

  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = path.join(directory, name + extension);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return '';
}

function openWithTypora(filePath, executablePath) {
  const env = getChildEnv();
  const platform = process.platform;

  if (platform === 'darwin') {
    if (!executablePath) {
      return spawn('open', ['-a', 'Typora', filePath], { stdio: 'ignore', env });
    }
    if (/\.app\/?$/i.test(executablePath)) {
      return spawn('open', ['-a', executablePath, filePath], { stdio: 'ignore', env });
    }
    // A path to the binary inside the bundle, e.g. .../Contents/MacOS/Typora.
    return spawn(executablePath, [filePath], { detached: true, stdio: 'ignore', env });
  }

  const options = { detached: true, stdio: 'ignore', env };

  if (platform === 'win32' && !executablePath) {
    // Keep ShellExecute as the default: a plain spawn() of the bare name goes
    // through CreateProcess, which does not consult the "App Paths" registry key
    // the Typora installer writes, so it would regress setups that resolve today.
    // Check first instead of trusting `start`, which exits 0 regardless.
    if (!findOnPath('typora')) {
      const error = new Error('Typora was not found on PATH');
      error.code = 'TYPORA_NOT_ON_PATH';
      throw error;
    }
    // windowsHide applies to the console that `cmd` would otherwise allocate. It
    // must not be passed to the direct spawn below: for a GUI process it maps to
    // STARTF_USESHOWWINDOW + SW_HIDE, so Typora creates its window hidden.
    return spawn('cmd', ['/c', 'start', '', 'typora', filePath], { ...options, windowsHide: true });
  }

  return spawn(executablePath || 'typora', [filePath], options);
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

    const executablePath = getConfiguredExecutable();

    const reportFailure = (reason) => {
      const hint = executablePath
        ? `Configured "typora.executablePath" is "${executablePath}".`
        : 'Set "typora.executablePath" to the full path of your Typora executable, e.g. "D:\\Typora\\Typora.exe".';
      vscode.window.showErrorMessage(`Open in Typora: ${reason}. ${hint}`);
    };

    let child;
    try {
      child = openWithTypora(targetUri.fsPath, executablePath);
    } catch (error) {
      // spawn() throws synchronously for EFTYPE (the path is a regular file) and
      // EINVAL (the path is a .cmd/.bat), so those never reach the 'error' event.
      // TYPORA_NOT_ON_PATH is this extension's own pre-flight rejection.
      reportFailure(
        error.code === 'EFTYPE' || error.code === 'EINVAL'
          ? `"${executablePath}" is not a runnable executable (${error.code})`
          : error.message
      );
      return;
    }

    const startedAt = Date.now();
    let reported = false;
    const fail = (reason) => {
      if (reported) {
        return;
      }
      reported = true;
      reportFailure(reason);
    };

    child.on('error', (error) => {
      fail(
        error.code === 'ENOENT'
          ? `Typora was not found${executablePath ? ` at "${executablePath}"` : ' on PATH'}`
          : `${error.code || 'error'}: ${error.message}`
      );
    });

    // Launching a second time while Typora is already running exits immediately
    // with code 0 after handing the file over, so only a non-zero code counts.
    child.on('exit', (code) => {
      if (!code || Date.now() - startedAt >= LAUNCH_FAILURE_WINDOW_MS) {
        return;
      }
      fail(`Typora exited immediately with code ${code}`);
    });

    child.unref();
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
