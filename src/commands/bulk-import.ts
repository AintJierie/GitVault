import { App, Notice, Modal, Setting } from 'obsidian';
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
            new Notice('Bulk import completed!');
        }).open();
    }
}

class BulkImportModal extends Modal {
    private selectedRepos: Set<string> = new Set();

    constructor(
        app: App,
        private repos: any[],
        private onSubmit: (repos: any[]) => void
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Select Repositories to Import' });

        const container = contentEl.createDiv({ cls: 'repo-list-container' });
        container.style.maxHeight = '300px';
        container.style.overflowY = 'auto';

        // Add "Select All" toggle
        new Setting(container)
            .setName('Select All')
            .addToggle(toggle => toggle
                .onChange(value => {
                    if (value) {
                        this.repos.forEach(r => this.selectedRepos.add(JSON.stringify(r)));
                    } else {
                        this.selectedRepos.clear();
                    }
                    this.renderList(repoListEl);
                }));

        const repoListEl = container.createDiv();
        this.renderList(repoListEl);

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Import Selected')
                .setCta()
                .onClick(() => {
                    const selected = this.repos.filter(r => this.selectedRepos.has(JSON.stringify(r)));
                    this.onSubmit(selected);
                    this.close();
                }));
    }

    renderList(el: HTMLElement) {
        el.empty();
        this.repos.forEach(repo => {
            const repoStr = JSON.stringify(repo);
            new Setting(el)
                .setName(repo.fullName)
                .setDesc(repo.description)
                .addToggle(toggle => toggle
                    .setValue(this.selectedRepos.has(repoStr))
                    .onChange(value => {
                        if (value) {
                            this.selectedRepos.add(repoStr);
                        } else {
                            this.selectedRepos.delete(repoStr);
                        }
                    }));
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
