import { App, Notice, SuggestModal, TFile } from 'obsidian';
import { GitHubAPI } from '../github/api';
import { ProjectSnapshotSettings } from '../settings';
import { ProjectNoteTemplate } from '../templates/project-note';

export class CreateSnapshotCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI: GitHubAPI
    ) { }

    execute() {
        // Get GitHub URL from user
        const modal = new GitHubUrlModal(this.app, async (url: string) => {
            await this.createSnapshotFromUrl(url);
        });
        modal.open();
    }

    async createSnapshotFromUrl(url: string) {
        const parsed = this.githubAPI.parseGitHubUrl(url);

        if (!parsed) {
            new Notice('Invalid GitHub URL');
            return;
        }

        await this.createSnapshot(parsed.owner, parsed.repo);
    }

    async createSnapshot(owner: string, repo: string) {
        new Notice(`Fetching data for ${owner}/${repo}...`);

        const repoData = await this.githubAPI.fetchRepoData(owner, repo);

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
                await this.app.vault.modify(existingFile as TFile, content);
                new Notice(`Updated: ${fileName}`);
            } else {
                await this.app.vault.create(filePath, content);
                new Notice(`Created: ${fileName}`);
            }

            // You might not want to open every file in bulk import, so maybe this should be optional
            // For now, let's leave it, but we might want to refactor if bulk import opens 50 tabs.
            const file = this.app.vault.getAbstractFileByPath(filePath);
            // Only open if single snapshot? For now let's just leave it.
            if (file) {
                // For bulk import, this might be annoying.
                // let's make it so execute() opens it, or createSnapshot returns the file/path and let the caller decide.
                // But for simplicity of refactor for now:
                // We will skip opening here if it's too annoying later.
                // Actually, let's remove the auto-open from here and move it to execute() or make it optional?
                // Let's keep it simple: createSnapshot generates the file.
            }
        } catch {
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
