# JJ-Lens

A Visual Studio Code extension that brings Jujutsu (JJ) source control directly into your IDE.

## Features

- **Source Control View**: View modified files in the working copy.
- **Diff Changes**: Click on modified files to see differences against the working copy parent revision (`@-`).
- **Toolbar Actions**: Quickly apply a description/commit message and seal the working copy using the checkmark toolbar icon. Split working copy modifications using the split action.
- **Line History**: Hover over any code to see the last 5 `jj` commits that affected the file.

## Requirements

- `jj` (Jujutsu) CLI must be installed and accessible in your system's `PATH`.

## Setup
1. Initialize a `jj` repo matching your VS Code workspace (`jj init` or `jj git init`).
2. Make changes to files; `jj` will automatically track them.
3. Use the Source Control panel (the same place as Git) to review and describe (`commit`) changes.

## Commands Provided
- `jj-lens.commit`: Applies the message from the Source Control input box to `jj describe -m`.
- `jj-lens.split`: Opens a terminal to run `jj split`.
