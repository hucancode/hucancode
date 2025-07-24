# Fonts Directory

This directory is used to provide custom fonts to Typst when building resume PDFs.

## Required Fonts

Based on the resume templates, the following fonts are used:
- **New Computer Modern** - Usually comes pre-installed with Typst
- **Hina Mincho** - Japanese font that needs to be downloaded

## Installation Options

### Option 1: System-wide Installation (Recommended)
Install the fonts on your system:
- **Ubuntu/Debian**: `sudo apt install fonts-cmu fonts-noto-cjk`
- **macOS**: Use Font Book to install downloaded fonts
- **Windows**: Right-click font files and select "Install"

### Option 2: Local Fonts Directory
Download font files and place them in this directory:

1. **Hina Mincho** (for Japanese text):
   - Download from: https://fonts.google.com/specimen/Hina+Mincho
   - Or: https://github.com/google/fonts/tree/main/ofl/hinamincho
   - Place the `.ttf` or `.otf` files directly in this `fonts/` directory

2. **New Computer Modern** (if not pre-installed):
   - Download from: https://www.ctan.org/pkg/newcomputermodern
   - Place the `.otf` files in this directory

## Directory Structure
```
fonts/
├── README.md (this file)
├── HinaMincho-Regular.ttf
└── NewCM10-Regular.otf
    (add other font weights as needed)
```

## Build Command
The build script automatically includes this directory in the font path:
```bash
typst compile --font-path fonts src/resume/resume.typ static/resume.pdf
```

## Troubleshooting
If you see "unknown font family" warnings:
1. Ensure font files are in this directory
2. Check that font file names match what Typst expects
3. Try using the exact font family name from the font file metadata