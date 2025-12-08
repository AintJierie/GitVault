import { App, Notice, Modal, setIcon } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI, RepoData } from '../github/api';
import { CreateSnapshotCommand } from './create-snapshot';

export class BulkImportCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI: GitHubAPI
    ) { }

    async execute() {
        const repos = await this.githubAPI.getAuthenticatedUserRepos();

        if (repos.length === 0) {
            new Notice('No repositories found or not authenticated.');
            return;
        }

        new BulkImportModal(this.app, repos, async (selectedRepos) => {
            new Notice(`Starting import of ${selectedRepos.length} repositories...`);
            const creator = new CreateSnapshotCommand(this.app, this.settings, this.githubAPI);

            let count = 0;
            for (const repo of selectedRepos) {
                new Notice(`Importing ${repo.fullName} (${++count}/${selectedRepos.length})...`, 2000);
                await creator.createSnapshot(repo.owner, repo.repo);
            }
            new Notice('🎉 Bulk import completed!');
        }).open();
    }
}

class BulkImportModal extends Modal {
    private selectedRepos: Set<string> = new Set();
    private searchQuery = '';

    constructor(
        app: App,
        private repos: RepoData[],
        private onSubmit: (repos: RepoData[]) => void
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('ps-content-no-padding');
        contentEl.addClass('ps-modal-small');

        // Header
        const header = contentEl.createDiv({ cls: 'ps-modal-header' });
        const titleRow = header.createDiv({ cls: 'ps-modal-title-row' });

        const iconEl = titleRow.createSpan({ cls: 'ps-icon-accent' });
        setIcon(iconEl, 'download');

        titleRow.createEl('h2', { text: 'Bulk import repositories', cls: 'ps-modal-title' });

        header.createDiv({ text: `${this.repos.length} repositories available`, cls: 'ps-modal-subtitle' });

        // Search and Select All
        const controlsBar = contentEl.createDiv({ cls: 'ps-controls-bar' });

        const searchInput = controlsBar.createEl('input', { type: 'text', placeholder: '🔍 Search repositories...', cls: 'ps-search-input' });
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
            this.renderList(repoListEl);
        });

        const selectAllBtn = controlsBar.createEl('button', { text: 'Select all' });
        selectAllBtn.onclick = () => {
            const allSelected = this.repos.every(r => this.selectedRepos.has(JSON.stringify(r)));
            if (allSelected) {
                this.selectedRepos.clear();
                selectAllBtn.setText('Select all');
            } else {
                this.repos.forEach(r => this.selectedRepos.add(JSON.stringify(r)));
                selectAllBtn.setText('Deselect all');
            }
            this.renderList(repoListEl);
        };

        // Repo list
        const container = contentEl.createDiv({ cls: 'ps-list-container' });
        const repoListEl = container.createDiv();
        this.renderList(repoListEl);

        // Footer
        const footer = contentEl.createDiv({ cls: 'ps-modal-footer' });

        const selectedCount = footer.createDiv({ text: '0 selected', cls: 'ps-text-muted ps-text-sm' });
        selectedCount.id = 'selected-count';

        const importBtn = footer.createEl('button', { text: '📦 Import selected', cls: 'mod-cta' });
        importBtn.onclick = () => {
            const selected = this.repos.filter(r => this.selectedRepos.has(JSON.stringify(r)));
            if (selected.length === 0) {
                new Notice('Please select at least one repository');
                return;
            }
            this.onSubmit(selected);
            this.close();
        };
    }

    renderList(el: HTMLElement) {
        el.empty();

        const filteredRepos = this.repos.filter(repo => 
            repo.fullName.toLowerCase().includes(this.searchQuery) ||
            (repo.description || '').toLowerCase().includes(this.searchQuery)
        );

        if (filteredRepos.length === 0) {
            const emptyState = el.createDiv({ cls: 'ps-empty-state' });
            emptyState.createEl('p', { text: 'No repositories match your search' });
            return;
        }

        filteredRepos.forEach(repo => {
            const repoStr = JSON.stringify(repo);
            const isSelected = this.selectedRepos.has(repoStr);

            const item = el.createDiv({ cls: 'ps-repo-item' });
            if (isSelected) {
                item.addClass('selected');
            }

            // Checkbox
            const checkbox = item.createEl('input', { type: 'checkbox', cls: 'ps-repo-checkbox' });
            checkbox.checked = isSelected;

            // Content
            const content = item.createDiv({ cls: 'ps-repo-content' });

            const nameRow = content.createDiv({ cls: 'ps-repo-name-row' });
            nameRow.createSpan({ text: repo.fullName, cls: 'ps-repo-name-text' });

            if (repo.language) {
                nameRow.createSpan({ text: repo.language, cls: 'ps-lang-badge' });
            }

            if (repo.description) {
                content.createDiv({ text: repo.description, cls: 'ps-repo-description' });
            }

            // Stats
            const stats = item.createDiv({ cls: 'ps-repo-stats' });
            stats.createSpan({ text: `⭐ ${repo.stars}` });
            if (repo.openIssues > 0) {
                stats.createSpan({ text: `🐛 ${repo.openIssues}` });
            }

            // Click handler
            const toggle = () => {
                if (this.selectedRepos.has(repoStr)) {
                    this.selectedRepos.delete(repoStr);
                } else {
                    this.selectedRepos.add(repoStr);
                }
                this.renderList(el);
                this.updateSelectedCount();
            };

            item.addEventListener('click', toggle);
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                toggle();
            });
        });

        this.updateSelectedCount();
    }

    updateSelectedCount() {
        const countEl = this.contentEl.querySelector('#selected-count');
        if (countEl) {
            countEl.textContent = `${this.selectedRepos.size} selected`;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
