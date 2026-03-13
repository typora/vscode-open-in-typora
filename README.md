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

You can customize supported extensions in VS Code settings:

- `typora.supportedExtensions`: array of extensions without dot, e.g. `["md", "markdown", "qmd"]`

Context menu entries are shown on local files, and the command validates extensions using this setting.

## Notes

- macOS uses `open -a Typora`.
- Windows uses `typora` from `PATH` via `cmd /c start`.
- Linux uses `typora` from `PATH`.
