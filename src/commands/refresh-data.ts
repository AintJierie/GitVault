import { App } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI } from '../github/api';

export class RefreshDataCommand {
    constructor(app: App, settings: ProjectSnapshotSettings, api: GitHubAPI) { }
    async execute() {
        console.log('Refresh is not yet implemented matching the full guide, user only provided core snippets. This is a placeholder.');
    }
}
