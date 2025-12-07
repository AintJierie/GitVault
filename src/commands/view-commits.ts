import { App, Modal, Notice, setIcon } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI } from '../github/api';
import { CommitFilesModal } from './view-prs';

export class ViewCommitsCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI: GitHubAPI
    ) { }

    async execute() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file.');
            return;
        }

        const content = await this.app.vault.read(activeFile);

        // Match frontmatter fields directly to avoid stale cache
        // Improved regex: explicit key, optional quotes, capture exact value until newline or quote
        const repoUrlMatch = content.match(/^repo_url:\s*["']?([^"'\r\n]+)["']?/m);
        const branchMatch = content.match(/^branch:\s*["']?([^"'\r\n]+)["']?/m);

        const repoUrl = repoUrlMatch ? repoUrlMatch[1].trim() : undefined;
        let branch = branchMatch ? branchMatch[1].trim() : undefined;

        // Sanity check for stringified nulls
        if (branch === 'null' || branch === 'undefined' || branch === '') branch = undefined;

        if (!repoUrl) {
            new Notice('Not a Project Snapshot (missing repo_url).');
            return;
        }

        const parsed = this.githubAPI.parseGitHubUrl(repoUrl);
        if (!parsed) {
            new Notice('Invalid repo URL.');
            return;
        }

        if (branch) {
            new Notice(`Target Branch: "${branch}"`);
        } else {
            new Notice(`No branch found in note (checking default)`);
        }

        new Notice(`Fetching commits for ${branch || 'default branch'}...`);
        const commits = await this.githubAPI.getCommits(parsed.owner, parsed.repo, branch);

        if (commits.length === 0) {
            new Notice('No commits found.');
            return;
        }

        new CommitListModal(this.app, commits, parsed, this.githubAPI, branch || 'default').open();
    }
}

export class CommitListModal extends Modal {
    constructor(
        app: App,
        private commits: any[],
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI,
        private branch?: string
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl, modalEl } = this;
        modalEl.style.cssText = 'width: 90vw; max-width: 1000px;'; // Force modal width
        contentEl.empty();
        contentEl.style.padding = '0';

        // Header
        const header = contentEl.createDiv();
        header.style.cssText = 'background: var(--background-secondary); padding: 20px; border-bottom: 1px solid var(--background-modifier-border);';

        const titleRow = header.createDiv();
        titleRow.style.cssText = 'display: flex; align-items: center; gap: 12px;';

        const icon = titleRow.createSpan();
        setIcon(icon, 'git-commit');
        icon.style.cssText = 'color: var(--interactive-accent); font-size: 1.3em;';

        const titleText = this.branch ? `Commits on ${this.branch}` : 'Commits';
        const title = titleRow.createEl('h2', { text: titleText });
        title.style.cssText = 'margin: 0; font-size: 1.2em;';

        const subTitle = header.createDiv({ text: `${this.repoInfo.owner}/${this.repoInfo.repo}` });
        subTitle.style.cssText = 'color: var(--text-muted); font-size: 0.9em; margin-top: 4px;';

        // List container
        const listContainer = contentEl.createDiv();
        listContainer.style.cssText = 'max-height: 60vh; overflow-y: auto; padding: 0;';

        this.commits.forEach((commit) => {
            const item = listContainer.createDiv();
            item.style.cssText = `
                display: flex; 
                flex-direction: column;
                gap: 4px; 
                padding: 12px 20px; 
                cursor: pointer;
                border-bottom: 1px solid var(--background-modifier-border);
                transition: background 0.1s;
            `;

            item.addEventListener('mouseenter', () => item.style.background = 'var(--background-secondary)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');

            const msg = item.createDiv({ text: commit.commit.message.split('\n')[0] });
            msg.style.fontWeight = '500';

            const meta = item.createDiv();
            meta.style.cssText = 'display: flex; gap: 10px; font-size: 0.8em; color: var(--text-muted);';
            const author = commit.author ? commit.author.login : commit.commit.author.name;
            meta.createSpan({ text: `👤 ${author}` });
            meta.createSpan({ text: `🕒 ${new Date(commit.commit.author.date).toLocaleDateString()}` });
            meta.createSpan({ text: `🔗 ${commit.sha.substring(0, 7)}` }).style.fontFamily = 'var(--font-monospace)';

            item.addEventListener('click', async () => {
                new Notice(`Loading details for ${commit.sha.substring(0, 7)}...`);
                // Passing undefined or null as ref usually defaults to main in APIs, 
                // but getCommitDetails needs a specific SHA. SHA is always unique regardless of branch.
                const details = await this.githubAPI.getCommitDetails(this.repoInfo.owner, this.repoInfo.repo, commit.sha);
                if (details) {
                    new CommitFilesModal(this.app, details, this.repoInfo, this.githubAPI).open();
                } else {
                    new Notice('Could not load commit details.');
                }
            });
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}
