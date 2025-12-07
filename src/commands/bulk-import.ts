import { App, Notice, Modal, Setting, setIcon } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI } from '../github/api';
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
    private searchQuery: string = '';

    constructor(
        app: App,
        private repos: any[],
        private onSubmit: (repos: any[]) => void
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.style.cssText = 'padding: 0; width: 600px; max-width: 90vw;';

        // Header
        const header = contentEl.createDiv();
        header.style.cssText = 'background: var(--background-secondary); padding: 20px; border-bottom: 1px solid var(--background-modifier-border);';

        const titleRow = header.createDiv();
        titleRow.style.cssText = 'display: flex; align-items: center; gap: 12px;';

        const iconEl = titleRow.createSpan();
        setIcon(iconEl, 'download');
        iconEl.style.cssText = 'color: var(--interactive-accent); font-size: 1.3em;';

        titleRow.createEl('h2', { text: 'Bulk Import Repositories' }).style.cssText = 'margin: 0; font-size: 1.3em;';

        const subtitle = header.createDiv({ text: `${this.repos.length} repositories available` });
        subtitle.style.cssText = 'color: var(--text-muted); font-size: 0.9em; margin-top: 4px;';

        // Search and Select All
        const controlsBar = contentEl.createDiv();
        controlsBar.style.cssText = 'display: flex; gap: 12px; align-items: center; padding: 12px 20px; background: var(--background-primary); border-bottom: 1px solid var(--background-modifier-border);';

        const searchInput = controlsBar.createEl('input', { type: 'text', placeholder: '🔍 Search repositories...' });
        searchInput.style.cssText = 'flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary);';
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
            this.renderList(repoListEl);
        });

        const selectAllBtn = controlsBar.createEl('button', { text: 'Select All' });
        selectAllBtn.style.cssText = 'padding: 8px 16px; border-radius: 6px;';
        selectAllBtn.onclick = () => {
            const allSelected = this.repos.every(r => this.selectedRepos.has(JSON.stringify(r)));
            if (allSelected) {
                this.selectedRepos.clear();
                selectAllBtn.setText('Select All');
            } else {
                this.repos.forEach(r => this.selectedRepos.add(JSON.stringify(r)));
                selectAllBtn.setText('Deselect All');
            }
            this.renderList(repoListEl);
        };

        // Repo list
        const container = contentEl.createDiv();
        container.style.cssText = 'max-height: 400px; overflow-y: auto;';

        const repoListEl = container.createDiv();
        this.renderList(repoListEl);

        // Footer
        const footer = contentEl.createDiv();
        footer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-top: 1px solid var(--background-modifier-border); background: var(--background-secondary);';

        const selectedCount = footer.createDiv({ text: `0 selected` });
        selectedCount.id = 'selected-count';
        selectedCount.style.cssText = 'color: var(--text-muted); font-size: 0.9em;';

        const importBtn = footer.createEl('button', { text: '📦 Import Selected', cls: 'mod-cta' });
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
            const emptyState = el.createDiv();
            emptyState.style.cssText = 'text-align: center; padding: 40px 20px; color: var(--text-muted);';
            emptyState.createEl('p', { text: 'No repositories match your search' });
            return;
        }

        filteredRepos.forEach(repo => {
            const repoStr = JSON.stringify(repo);
            const isSelected = this.selectedRepos.has(repoStr);

            const item = el.createDiv();
            item.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 20px;
                border-bottom: 1px solid var(--background-modifier-border);
                cursor: pointer;
                transition: background 0.15s;
                ${isSelected ? 'background: var(--background-secondary);' : ''}
            `;

            item.addEventListener('mouseenter', () => {
                if (!isSelected) item.style.background = 'var(--background-secondary-alt)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = isSelected ? 'var(--background-secondary)' : 'transparent';
            });

            // Checkbox
            const checkbox = item.createEl('input', { type: 'checkbox' });
            checkbox.checked = isSelected;
            checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';

            // Content
            const content = item.createDiv();
            content.style.flex = '1';

            const nameRow = content.createDiv();
            nameRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';

            nameRow.createSpan({ text: repo.fullName }).style.fontWeight = '600';

            if (repo.language) {
                const langBadge = nameRow.createSpan({ text: repo.language });
                langBadge.style.cssText = 'background: var(--background-modifier-border); padding: 2px 8px; border-radius: 10px; font-size: 0.75em;';
            }

            if (repo.description) {
                const desc = content.createDiv({ text: repo.description });
                desc.style.cssText = 'color: var(--text-muted); font-size: 0.85em; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px;';
            }

            // Stats
            const stats = item.createDiv();
            stats.style.cssText = 'display: flex; gap: 12px; font-size: 0.85em; color: var(--text-muted);';
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
