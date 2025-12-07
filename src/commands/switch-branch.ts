import { App, Modal, Notice, FuzzySuggestModal, TFile } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI } from '../github/api';
import { RefreshDataCommand } from './refresh-data';

export class SwitchBranchCommand {
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

        new Notice('Fetching branches...');
        const branches = await this.githubAPI.getBranches(parsed.owner, parsed.repo);

        if (branches.length === 0) {
            new Notice('Could not fetch branches.');
            return;
        }

        new BranchSelectModal(this.app, branches, async (selectedBranch) => {
            await this.updateBranch(activeFile, selectedBranch);
        }).open();
    }

    async updateBranch(file: TFile, branch: string) {
        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                frontmatter['branch'] = branch;
            });

            new Notice(`Switched to branch: ${branch}`);

            // Trigger refresh
            new RefreshDataCommand(this.app, this.settings, this.githubAPI).execute();
        } catch (error) {
            console.error('Error updating branch:', error);
            new Notice('Failed to update branch.');
        }
    }
}

class BranchSelectModal extends FuzzySuggestModal<string> {
    constructor(
        app: App,
        private branches: string[],
        private onChoose: (branch: string) => void
    ) {
        super(app);
        this.setPlaceholder('Select a branch...');
    }

    getItems(): string[] {
        return this.branches;
    }

    getItemText(branch: string): string {
        return branch;
    }

    onChooseItem(branch: string, evt: MouseEvent | KeyboardEvent) {
        this.onChoose(branch);
    }
}
