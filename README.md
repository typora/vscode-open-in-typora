# Open in Typora (VS Code Extension)

This extension adds an **Open in Typora** action when you right-click supported Markdown-like files in VS Code.

## Usage

1. Open this folder in VS Code.
2. Press `F5` to run an Extension Development Host.
3. In the new VS Code window, right-click a supported file in Explorer.
4. Click **Open in Typora**.

## Supported extensions (default)

`.md`, `.markdown`, `.mdown`, `.mmd`, `.text`, `.txt`, `.rmarkdown`, `.mkd`, `.mdwn`, `.mdtxt`, `.rmd`, `.qmd`, `.mdtext`, `.mdx`

## Configuration

You can customize the extension in VS Code settings:

- `typora.supportedExtensions`: array of extensions without dot, e.g. `["md", "markdown", "qmd"]`
- `typora.executablePath`: full path to the Typora executable. Set this when Typora is not reachable through the default mechanism described below, e.g. `D:\Typora\Typora.exe` on Windows.

Context menu entries are shown on local files, and the command validates extensions using `typora.supportedExtensions`.

## Notes

- macOS uses `open -a Typora`. `typora.executablePath` accepts either the `.app` bundle or the binary inside it.
- Windows uses `typora` via `cmd /c start`. The Typora installer does not add itself to `PATH`, so set `typora.executablePath` if the command does nothing.
- Linux uses `typora` from `PATH`. AppImage and tarball installs do not provide that command, so set `typora.executablePath`.
- If launching fails, the reason is reported in an error notification instead of being swallowed.
