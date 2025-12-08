import { App, Modal, Notice, setIcon } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI, GitHubCommit } from '../github/api';
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
        private commits: GitHubCommit[],
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI,
        private branch?: string
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl, modalEl } = this;
        modalEl.addClass('ps-modal-wide');
        contentEl.empty();
        contentEl.addClass('ps-content-no-padding');

        // Header
        const header = contentEl.createDiv({ cls: 'ps-modal-header' });
        const titleRow = header.createDiv({ cls: 'ps-modal-title-row' });

        const icon = titleRow.createSpan({ cls: 'ps-icon-accent' });
        setIcon(icon, 'git-commit');

        const titleText = this.branch ? `Commits on ${this.branch}` : 'Commits';
        titleRow.createEl('h2', { text: titleText, cls: 'ps-modal-title' });

        header.createDiv({ text: `${this.repoInfo.owner}/${this.repoInfo.repo}`, cls: 'ps-modal-subtitle' });

        // List container
        const listContainer = contentEl.createDiv({ cls: 'ps-list-container' });

        this.commits.forEach((commit) => {
            const item = listContainer.createDiv({ cls: 'ps-commit-item' });

            item.createDiv({ text: commit.commit.message.split('\n')[0], cls: 'ps-commit-message' });

            const meta = item.createDiv({ cls: 'ps-commit-meta' });
            const author = commit.author ? commit.author.login : (commit.commit.author?.name || 'Unknown');
            const commitDate = commit.commit.author?.date ? new Date(commit.commit.author.date).toLocaleDateString() : 'Unknown';
            meta.createSpan({ text: `👤 ${author}` });
            meta.createSpan({ text: `🕒 ${commitDate}` });
            meta.createSpan({ text: `🔗 ${commit.sha.substring(0, 7)}`, cls: 'ps-mono' });

            item.addEventListener('click', async () => {
                new Notice(`Loading details for ${commit.sha.substring(0, 7)}...`);
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
