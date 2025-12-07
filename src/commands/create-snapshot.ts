import { App, Notice, SuggestModal } from 'obsidian';
import { GitHubAPI } from '../github/api';
import { ProjectSnapshotSettings } from '../settings';
import { ProjectNoteTemplate } from '../templates/project-note';

export class CreateSnapshotCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI: GitHubAPI
    ) { }

    async execute() {
        // Get GitHub URL from user
        const modal = new GitHubUrlModal(this.app, async (url: string) => {
            await this.createSnapshot(url);
        });
        modal.open();
    }

    private async createSnapshot(url: string) {
        const parsed = this.githubAPI.parseGitHubUrl(url);

        if (!parsed) {
            new Notice('Invalid GitHub URL');
            return;
        }

        new Notice('Fetching repository data...');

        const repoData = await this.githubAPI.fetchRepoData(parsed.owner, parsed.repo);

        if (!repoData) {
            return; // Error already shown by API
        }

        // Generate note content
        const content = ProjectNoteTemplate.generate(repoData, this.settings);

        // Create note
        const folder = this.settings.defaultFolder;
        const fileName = `${repoData.repo}.md`;
        const filePath = folder ? `${folder}/${fileName}` : fileName;

        try {
            // Create folder if it doesn't exist
            if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
                await this.app.vault.createFolder(folder);
            }

            // Create or update file
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);

            if (existingFile) {
                await this.app.vault.modify(existingFile as any, content);
                new Notice(`Updated: ${fileName}`);
            } else {
                await this.app.vault.create(filePath, content);
                new Notice(`Created: ${fileName}`);
            }

            // Open the file
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                await this.app.workspace.getLeaf().openFile(file as any);
            }
        } catch (error) {
            console.error('Error creating note:', error);
            new Notice('Error creating note');
        }
    }
}

class GitHubUrlModal extends SuggestModal<string> {
    constructor(app: App, private onSubmit: (url: string) => void) {
        super(app);
        this.setPlaceholder('Enter GitHub repository URL');
    }

    getSuggestions(query: string): string[] {
        if (query.includes('github.com')) {
            return [query];
        }
        return [];
    }

    renderSuggestion(url: string, el: HTMLElement) {
        el.createEl('div', { text: url });
    }

    onChooseSuggestion(url: string, evt: MouseEvent | KeyboardEvent) {
        this.onSubmit(url);
    }
}
