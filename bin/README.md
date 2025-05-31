# qcommit - AI-Assisted Conventional Commit Generator

`qcommit` is a tool that helps you generate conventional commit messages based on your staged changes. It analyzes the files you've modified and suggests appropriate commit types, scopes, and messages.

## Features

- Automatically determines commit type based on changed files
- Automatically determines scope based on project structure
- Generates meaningful commit messages based on file changes
- Follows the [Conventional Commits](https://www.conventionalcommits.org/) specification
- Integrates with the project's commitlint configuration

## Usage

### Command Line

```bash
# Basic usage
git add <files>
npm run qcommit

# With options
npm run qcommit -- --type feat --scope frontend --message "add new button component"

# Dry run (show message without committing)
npm run qcommit -- --dry-run
```

### Options

- `-h, --help`: Show help message
- `-t, --type`: Specify commit type (feat, fix, docs, etc.)
- `-s, --scope`: Specify commit scope
- `-m, --message`: Specify commit message
- `-d, --dry-run`: Show the generated commit message without committing

### VS Code Snippet

We've also included a VS Code snippet to help you generate commit messages with QODO AI:

1. Press `Cmd+Shift+P` → `Preferences: Configure User Snippets`
2. Select `New Global Snippets file...` and name it `qodo-snippets`
3. Copy the content from `.devtools/snippets/qodo.code-snippets`
4. Save the file
5. Type `qcommit` in the QODO AI chat and press Tab to expand the prompt

## Commit Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries
- `ci`: Changes to CI configuration files and scripts
- `build`: Changes that affect the build system or external dependencies
- `revert`: Reverts a previous commit

## Examples

```text
feat(frontend): add user profile component
fix(api): resolve authentication token expiration issue
docs: update installation instructions
chore(deps): update dependencies
```
