import { App, Modal, Notice } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI } from '../github/api';

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
        private prs: any[],
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: `Pull Requests: ${this.repoInfo.repo}` });

        if (this.prs.length === 0) {
            contentEl.createEl('p', { text: 'No open pull requests.' });
        } else {
            const list = contentEl.createDiv();
            this.prs.forEach(pr => {
                const item = list.createDiv({ cls: 'tree-item-self' });
                item.style.padding = '10px';
                item.style.borderBottom = '1px solid var(--background-modifier-border)';
                item.style.cursor = 'pointer';

                const title = item.createDiv({ text: pr.title });
                title.style.fontWeight = 'bold';

                const meta = item.createDiv({ text: `#${pr.number} by ${pr.user.login}` });
                meta.style.fontSize = '0.8em';
                meta.style.color = 'var(--text-muted)';

                item.addEventListener('click', async () => {
                    // Fetch diff and show in new modal
                    new Notice('Loading diff...');
                    const diff = await this.githubAPI.getPullRequestDiff(this.repoInfo.owner, this.repoInfo.repo, pr.number);
                    if (diff) {
                        new PRDiffModal(this.app, pr, diff).open();
                    } else {
                        new Notice('Could not load diff.');
                    }
                });
            });
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class PRDiffModal extends Modal {
    constructor(
        app: App,
        private pr: any,
        private diff: string
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: `Diff: #${this.pr.number} ${this.pr.title}` });

        const pre = contentEl.createEl('pre', { cls: 'language-diff' });
        pre.style.maxHeight = '70vh';
        pre.style.overflow = 'auto';
        pre.style.whiteSpace = 'pre-wrap';
        pre.innerText = this.diff;

    }

    onClose() {
        this.contentEl.empty();
    }
}
