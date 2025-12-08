import { App, Modal, Notice, setIcon } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI, GitHubPullRequest, GitHubCommit } from '../github/api';

export class ViewPRsCommand {
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

        const cache = this.app.metadataCache.getFileCache(activeFile);
        let repoUrl = cache?.frontmatter?.repo_url;

        if (!repoUrl) {
            // Fallback: Try to parse content
            const content = await this.app.vault.read(activeFile);
            const match = content.match(/\*\*Repository:\*\* \[.*\]\((.*)\)/);
            if (match && match[1]) {
                repoUrl = match[1];
            } else {
                new Notice('Not a Project Snapshot (missing repo_url).');
                return;
            }
        }

        const parsed = this.githubAPI.parseGitHubUrl(repoUrl);
        if (!parsed) {
            new Notice('Invalid repo URL.');
            return;
        }

        new Notice('Fetching Pull Requests...');
        const prs = await this.githubAPI.getPullRequests(parsed.owner, parsed.repo);

        new PRListModal(this.app, prs, parsed, this.githubAPI).open();
    }
}

export class PRListModal extends Modal {
    constructor(
        app: App,
        private prs: GitHubPullRequest[],
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI
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
        const headerContent = header.createDiv({ cls: 'ps-header-content' });

        const iconEl = headerContent.createSpan({ cls: 'ps-icon-accent ps-icon-large' });
        setIcon(iconEl, 'git-pull-request');

        headerContent.createEl('h2', { text: 'Pull requests', cls: 'ps-modal-title' });

        header.createDiv({ text: `${this.repoInfo.owner}/${this.repoInfo.repo}`, cls: 'ps-modal-subtitle' });

        // Stats bar
        const statsBar = contentEl.createDiv({ cls: 'ps-stats-bar' });
        statsBar.createSpan({ text: `🟢 ${this.prs.length} open` });

        // List container
        const listContainer = contentEl.createDiv({ cls: 'ps-list-container' });

        if (this.prs.length === 0) {
            const emptyState = listContainer.createDiv({ cls: 'ps-empty-state' });
            emptyState.createEl('div', { text: '🎉', cls: 'ps-empty-state-icon' });
            emptyState.createEl('p', { text: 'No open pull requests!', cls: 'ps-empty-state-text' });
        } else {
            this.prs.forEach((pr) => {
                const item = listContainer.createDiv({ cls: 'ps-item-card' });

                // PR icon
                const prIcon = item.createDiv({ cls: 'ps-pr-icon' });
                setIcon(prIcon, 'git-pull-request');

                // Content
                const content = item.createDiv({ cls: 'ps-item-content' });
                content.createDiv({ text: pr.title, cls: 'ps-pr-title' });

                const meta = content.createDiv({ cls: 'ps-pr-meta' });
                meta.createSpan({ text: `#${pr.number}`, cls: 'ps-mono' });
                meta.createSpan({ text: `opened by ${pr.user?.login || 'unknown'}` });

                if (pr.draft) {
                    meta.createSpan({ text: 'Draft', cls: 'ps-draft-badge' });
                }

                // Labels
                if (pr.labels && pr.labels.length > 0) {
                    pr.labels.slice(0, 3).forEach((label) => {
                        const lbl = meta.createSpan({ text: label.name, cls: 'ps-label' });
                        lbl.setCssStyles({
                            background: `#${label.color}`,
                            color: this.getContrastColor(label.color)
                        });
                    });
                }

                // Avatar
                const avatar = item.createEl('img', { cls: 'ps-item-avatar' });
                if (pr.user?.avatar_url) {
                    avatar.src = pr.user.avatar_url;
                }

                item.addEventListener('click', async () => {
                    new Notice('Loading commits...');
                    const commits = await this.githubAPI.getPullRequestCommits(this.repoInfo.owner, this.repoInfo.repo, pr.number);
                    if (commits) {
                        new PRCommitsModal(this.app, pr, commits, this.repoInfo, this.githubAPI).open();
                    } else {
                        new Notice('Could not load commits.');
                    }
                });
            });
        }
    }

    getContrastColor(hexColor: string): string {
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 128 ? '#000' : '#fff';
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class PRCommitsModal extends Modal {
    constructor(
        app: App,
        private pr: GitHubPullRequest,
        private commits: GitHubCommit[],
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI
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

        titleRow.createEl('h2', { text: `Commits in #${this.pr.number}`, cls: 'ps-modal-title' });

        header.createDiv({ text: this.pr.title, cls: 'ps-modal-subtitle' });

        // Actions
        const actionBar = contentEl.createDiv({ cls: 'ps-action-bar' });

        const viewAllChangesBtn = actionBar.createEl('button', { text: 'View all changes (full diff)' });
        viewAllChangesBtn.onclick = async () => {
            new Notice('Loading full diff...');
            const diff = await this.githubAPI.getPullRequestDiff(this.repoInfo.owner, this.repoInfo.repo, this.pr.number);
            if (diff) {
                new ViewDiffModal(this.app, `Diff: #${this.pr.number} ${this.pr.title}`, diff, this.pr.html_url).open();
            } else {
                new Notice('Could not load diff.');
            }
        };

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

export class CommitFilesModal extends Modal {
    constructor(
        app: App,
        private commit: GitHubCommit,
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI
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
        setIcon(icon, 'file-diff');

        titleRow.createEl('h2', { text: `Changes in ${this.commit.sha.substring(0, 7)}`, cls: 'ps-modal-title' });

        header.createDiv({ text: this.commit.commit.message.split('\n')[0], cls: 'ps-modal-subtitle' });

        const stats = header.createDiv({ cls: 'ps-stats-row' });
        const statsData = this.commit.stats || { additions: 0, deletions: 0, total: 0 };
        const filesCount = this.commit.files?.length || 0;
        stats.createSpan({ text: `📝 ${filesCount} files` });
        stats.createSpan({ text: `➕ ${statsData.additions}`, cls: 'ps-stat-green' });
        stats.createSpan({ text: `➖ ${statsData.deletions}`, cls: 'ps-stat-red' });

        // File List
        const listContainer = contentEl.createDiv({ cls: 'ps-list-container' });

        this.commit.files?.forEach((file) => {
            const item = listContainer.createDiv({ cls: 'ps-file-item' });

            // Status Icon
            const statusIcon = item.createSpan({ cls: 'ps-file-status' });

            if (file.status === 'added') {
                statusIcon.innerText = 'A';
                statusIcon.addClass('ps-icon-green');
            } else if (file.status === 'removed') {
                statusIcon.innerText = 'D';
                statusIcon.addClass('ps-icon-red');
            } else if (file.status === 'modified') {
                statusIcon.innerText = 'M';
                statusIcon.addClass('ps-icon-yellow');
            } else if (file.status === 'renamed') {
                statusIcon.innerText = 'R';
                statusIcon.addClass('ps-icon-blue');
            } else {
                statusIcon.innerText = '?';
                statusIcon.addClass('ps-icon-muted');
            }

            item.createDiv({ text: file.filename, cls: 'ps-file-name' });

            const changes = item.createDiv({ cls: 'ps-file-changes' });
            if (file.patch) {
                changes.innerText = `+${file.additions} -${file.deletions}`;
            } else {
                changes.innerText = 'Binary / No diff';
            }

            item.addEventListener('click', () => {
                if (file.patch) {
                    new ViewDiffModal(this.app, file.filename, file.patch, file.blob_url).open();
                } else {
                    new Notice('No diff available for this file (binary or too large).');
                }
            });
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class ViewDiffModal extends Modal {
    constructor(
        app: App,
        private title: string,
        private diff: string,
        private url?: string
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl, modalEl } = this;
        modalEl.addClass('ps-modal-extra-wide');
        contentEl.empty();
        contentEl.addClass('ps-content-no-padding');

        // Header
        const header = contentEl.createDiv({ cls: 'ps-modal-header' });
        const titleRow = header.createDiv({ cls: 'ps-modal-title-row' });

        const prIcon = titleRow.createSpan({ cls: 'ps-icon-accent' });
        setIcon(prIcon, 'file-diff');

        titleRow.createEl('h3', { text: this.title, cls: 'ps-modal-title' });

        // Diff viewer
        const diffContainer = contentEl.createDiv({ cls: 'ps-diff-container' });
        const pre = diffContainer.createEl('pre', { cls: 'ps-diff-pre' });

        // Syntax highlight diff
        const lines = this.diff.split('\n');
        lines.forEach(line => {
            const lineEl = pre.createEl('div');
            if (line.startsWith('+') && !line.startsWith('+++')) {
                lineEl.addClass('ps-diff-line-added');
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                lineEl.addClass('ps-diff-line-removed');
            } else if (line.startsWith('@@')) {
                lineEl.addClass('ps-diff-line-hunk');
            } else if (line.startsWith('diff') || line.startsWith('index')) {
                lineEl.addClass('ps-diff-line-meta');
            }
            lineEl.textContent = line;
        });

        // Footer
        const footer = contentEl.createDiv({ cls: 'ps-modal-footer' });

        if (this.url) {
            const browserBtn = footer.createEl('button', { text: '🔗 View on GitHub' });
            browserBtn.onclick = () => window.open(this.url);
        }

        const closeBtn = footer.createEl('button', { text: 'Close', cls: 'mod-cta' });
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        this.contentEl.empty();
    }
}
