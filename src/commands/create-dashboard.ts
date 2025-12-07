import { App, Notice, TFile } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI } from '../github/api';

export class CreateDashboardCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI?: GitHubAPI
    ) { }

    async execute() {
        if (!this.githubAPI) {
            new Notice('GitHub API not initialized');
            return;
        }

        new Notice('Generating Project Dashboard...');

        const user = await this.githubAPI.getAuthenticatedUser();
        const repos = await this.githubAPI.getAuthenticatedUserRepos();

        if (!user) {
            new Notice('Could not fetch user profile. Check token.');
            return;
        }

        const contribData = await this.githubAPI.getContributionData(user.login);

        const content = this.generateDashboard(user, repos, contribData);

        const fileName = 'Project Dashboard.md';
        const folder = this.settings.defaultFolder;
        const filePath = folder ? `${folder}/${fileName}` : fileName;

        try {
            if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
                await this.app.vault.createFolder(folder);
            }

            const existing = this.app.vault.getAbstractFileByPath(filePath);
            if (existing) {
                await this.app.vault.modify(existing as any, content);
                new Notice('Dashboard updated!');
            } else {
                await this.app.vault.create(filePath, content);
                new Notice('Dashboard created!');
            }

            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                await this.app.workspace.getLeaf().openFile(file as any);
            }
        } catch (e) {
            console.error(e);
            new Notice('Error creating dashboard');
        }
    }

    generateDashboard(user: any, repos: any[], contribData?: any): string {
        const totalStars = repos.reduce((acc, r) => acc + r.stars, 0);
        const totalOpenIssues = repos.reduce((acc, r) => acc + r.openIssues, 0);
        // Top 5 repos by stars
        const topRepos = [...repos].sort((a, b) => b.stars - a.stars).slice(0, 5);

        let heatmapSection = '';
        if (contribData && contribData.contributions) {
            const contributions = contribData.contributions;
            heatmapSection = this.renderHeatmapHTML(contributions);
        } else {
            heatmapSection = '_Could not load contribution data_';
        }

        return `---
tags:
  - project-dashboard
updated: ${new Date().toISOString()}
---

# 📊 Project Dashboard: ${user.name || user.login}

<div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px;">
    <img src="${user.avatar_url}" style="width: 60px; height: 60px; border-radius: 50%;" />
    <div>
        <h3>${user.login}</h3>
        <p>${user.bio || 'No bio'}</p>
    </div>
</div>

## 📉 Contribution Graph
${heatmapSection}

## 📊 GitHub Stats
![GitHub Stats](https://github-readme-stats.vercel.app/api?username=${user.login}&show_icons=true&theme=radical)

## 📈 Overview
| Total Repos | Total Stars | Open Issues |
| :---: | :---: | :---: |
| **${repos.length}** | **${totalStars}** | **${totalOpenIssues}** |

## ⭐ Top Repositories
${topRepos.map(r => `- [${r.repo}](${r.url}) - ⭐ ${r.stars}`).join('\n')}

## 🧹 Quick Actions
- \`Create Project Snapshot\`
- \`Bulk Import User Repositories\`
- \`Refresh Project Data\`
`;
    }

    renderHeatmapHTML(contributions: any[]): string {
        // Map levels to colors (GitHub Dark Dimmed style)
        const colors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

        const squares = contributions.map(c => {
            const color = colors[c.level] || colors[0];
            const title = `${c.count} contributions on ${c.date}`;
            return `<div title="${title}" style="width: 10px; height: 10px; background-color: ${color}; border-radius: 2px;"></div>`;
        }).join('');

        return `
<div style="
    display: flex; 
    flex-direction: column; 
    align-items: flex-start; 
    background-color: #0d1117; 
    padding: 15px; 
    border-radius: 6px; 
    border: 1px solid #30363d;
    overflow-x: auto;
">
    <div style="display: flex; gap: 3px; flex-wrap: wrap; width: max-content; max-width: 100%;">
        ${squares}
    </div>
    <div style="color: #8b949e; font-size: 12px; margin-top: 10px;">
        ${contributions.reduce((acc, c) => acc + c.count, 0)} total contributions in the last year
    </div>
</div>
`;
    }
}
