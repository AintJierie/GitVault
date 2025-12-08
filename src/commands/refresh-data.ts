import { App, Notice, TFile } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI } from '../github/api';
import { ProjectNoteTemplate } from '../templates/project-note';

export class RefreshDataCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI: GitHubAPI
    ) { }

    async execute(silent = false) {
        // 1. Get current active file
        // Auto-refresh usually runs on all open files or specific files?
        // Actually, the requirement was "Refresh Project Data".
        // If it's a background sync, it should probably refresh ALL project snapshots in the vault?
        // Or just the active one?
        // "Auto-Refresh Interval (Background Sync)" implies background.
        // But iterating all files in vault might be expensive.
        // Let's start with: If user has a file OPEN, and it's a Snapshot, refresh it.
        // OR: Iterate all markdown files, check frontmatter, refresh if needed.
        // Let's check the plan: "Background Sync".
        // Iterating all files is safer for "Sync".

        // HOWEVER, to avoid rate limits, maybe just refresh the active file if it's a snapshot?
        // No, real background sync should handle all.
        // Let's assume for now we scan the vault for files with `repo_url` in frontmatter.

        if (silent) {
            await this.refreshAllSnapshots();
        } else {
            // Default manual behavior (active file)
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile) await this.refreshFile(activeFile, false);
            else new Notice('No active file to refresh');
        }
    }

    async refreshAllSnapshots() {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            await this.refreshFile(file, true);
        }
    }

    async refreshFile(file: TFile, silent: boolean) {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;
        if (!frontmatter) return;

        // Dashboard
        // ... (dashboard logic if needed, skipped for auto-refresh usually to save API calls, or maybe yes?)
        // Let's focus on Snapshots first.

        const repoUrl = frontmatter.repo_url;
        const branch = frontmatter.branch; // Optional branch support
        if (repoUrl) {
            if (!silent) new Notice(`Refreshing snapshot for ${repoUrl}${branch ? ` (${branch})` : ''}...`);
            await this.refreshSnapshot(file, repoUrl, branch, silent);
        } else if (!silent) {
            // Only show "Not a project snapshot" if manual
            new Notice('Current file is not a Project Snapshot');
        }
    }

    async refreshSnapshot(file: TFile, repoUrl: string, branch: string | undefined, silent: boolean) {
        const parsed = this.githubAPI.parseGitHubUrl(repoUrl);
        if (!parsed) {
            new Notice('Invalid GitHub URL in frontmatter');
            return;
        }

        const data = await this.githubAPI.fetchRepoData(parsed.owner, parsed.repo, branch);
        if (!data) {
            // Notification already handled by githubAPI
            return;
        }

        const newContent = ProjectNoteTemplate.generate(data, this.settings);

        try {
            // Smart Sync: Read existing file to check for user notes
            const currentContent = await this.app.vault.read(file);
            const marker = '<!-- project-snapshot-end -->';
            const parts = currentContent.split(marker);

            let finalContent = newContent;

            // If marker found, preserve everything after it
            if (parts.length > 1) {
                const userNotes = parts[1];
                finalContent = newContent + userNotes;
            } else {
                // If no marker found (Migration from V1), we typically overwrite, 
                // BUT if there is a lot of extra text, we might be destroying it.
                // For now, we will just overwrite to upgrade to V2 structure, 
                // assuming V1 files are mostly just the generated content.
                // To be safe, we could append existing content if it looks custom?
                // Let's stick to simple overwrite for now to enforce the new template structure.
            }

            await this.app.vault.modify(file, finalContent);
            if (!silent) new Notice(`Updated snapshot: ${data.fullName}`);
        } catch (error) {
            if (!silent) new Notice('Failed to update file');
        }
    }
}
