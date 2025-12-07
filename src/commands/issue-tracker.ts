import { App, Modal, Notice, Setting, SuggestModal } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI } from '../github/api';
import { CreateIssueModal } from './create-issue';

export class IssueTrackerCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI: GitHubAPI
    ) { }

    async execute() {
        // Must be in a snapshot file to know which repo
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file.');
            return;
        }

        const cache = this.app.metadataCache.getFileCache(activeFile);
        const repoUrl = cache?.frontmatter?.repo_url;

        if (!repoUrl) {
            new Notice('Not a Project Snapshot (missing repo_url).');
            return;
        }

        const parsed = this.githubAPI.parseGitHubUrl(repoUrl);
        if (!parsed) {
            new Notice('Invalid repo URL.');
            return;
        }

        new Notice('Fetching issues...');
        const issues = await this.githubAPI.getIssues(parsed.owner, parsed.repo);

        new IssueTrackerModal(this.app, issues, parsed, this.githubAPI).open();
    }
}

export class IssueTrackerModal extends Modal {
    constructor(
        app: App,
        private issues: any[],
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: `Issues: ${this.repoInfo.repo}` });

        const btnContainer = contentEl.createDiv();
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.marginBottom = '20px';

        const createBtn = btnContainer.createEl('button', { text: 'Create New Issue', cls: 'mod-cta' });
        createBtn.onclick = () => {
            this.close();
            new CreateIssueModal(this.app, this.repoInfo, this.githubAPI).open();
        };

        const listContainer = contentEl.createDiv();

        if (this.issues.length === 0) {
            listContainer.createEl('p', { text: 'No open issues found.' });
        } else {
            this.issues.forEach(issue => {
                const item = listContainer.createDiv({ cls: 'tree-item-self' });
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.padding = '8px 0';
                item.style.borderBottom = '1px solid var(--background-modifier-border)';
                item.style.cursor = 'pointer';

                // Icon
                const icon = item.createSpan({ cls: 'tree-item-icon' });
                icon.setText('🐛');
                icon.style.marginRight = '8px';

                // Content
                const content = item.createDiv();
                const titleEl = content.createDiv({ text: issue.title });
                titleEl.style.fontWeight = 'bold';

                const metaEl = content.createDiv({ text: `#${issue.number} opened by ${issue.user.login}` });
                metaEl.style.fontSize = '0.8em';
                metaEl.style.color = 'var(--text-muted)';

                item.addEventListener('click', () => {
                    // Open in browser
                    window.open(issue.html_url);
                });
            });
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
