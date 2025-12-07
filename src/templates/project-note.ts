import { formatDistanceToNow } from 'date-fns';
import { RepoData } from '../github/api';
import { ProjectSnapshotSettings } from '../settings';

export class ProjectNoteTemplate {
    static generate(data: RepoData, settings: ProjectSnapshotSettings): string {
        const sections: string[] = [];
        const timeAgo = formatDistanceToNow(new Date(data.lastCommit.date), { addSuffix: true });
        const activityStatus = this.getActivityStatus(data.lastCommit.date);
        const healthScore = this.calculateHealthScore(data);

        // Frontmatter
        sections.push('---');
        sections.push(`repo_url: ${data.url}`);
        sections.push(`updated: ${new Date().toISOString()}`);
        sections.push(`language: ${data.language || 'Unknown'}`);
        sections.push(`stars: ${data.stars}`);
        sections.push(`health_score: ${healthScore}`);
        sections.push('tags:');
        sections.push('  - project-snapshot');
        if (data.language) sections.push(`  - ${data.language.toLowerCase()}`);
        sections.push('---');
        sections.push('');

        // Hero Header with Status Badge
        sections.push(`# 📦 ${data.repo}`);
        sections.push('');
        sections.push(`> ${data.description || '*No description provided*'}`);
        sections.push('');

        // Status Card (HTML for visual appeal)
        sections.push(`<div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0;">`);
        sections.push(`  <span style="background: ${activityStatus.color}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 500;">${activityStatus.icon} ${activityStatus.label}</span>`);
        if (data.language) {
            sections.push(`  <span style="background: var(--background-modifier-border); padding: 4px 12px; border-radius: 20px; font-size: 0.85em;">💻 ${data.language}</span>`);
        }
        sections.push(`  <span style="background: var(--background-modifier-border); padding: 4px 12px; border-radius: 20px; font-size: 0.85em;">🏥 Health: ${healthScore}/100</span>`);
        sections.push(`</div>`);
        sections.push('');

        // Stats Cards Row
        sections.push(`<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin: 20px 0;">`);
        
        if (settings.templateCustomization.includeStars) {
            sections.push(this.createStatCard('⭐', 'Stars', data.stars.toLocaleString(), '#f59e0b'));
        }
        sections.push(this.createStatCard('🍴', 'Forks', data.forks.toLocaleString(), '#8b5cf6'));
        if (settings.templateCustomization.includeIssues) {
            sections.push(this.createStatCard('🐛', 'Issues', data.openIssues.toString(), data.openIssues > 10 ? '#ef4444' : '#22c55e'));
        }
        sections.push(this.createStatCard('💻', 'Language', data.language || 'N/A', '#3b82f6'));
        
        sections.push(`</div>`);
        sections.push('');

        // Latest Commit Section
        if (settings.templateCustomization.includeLastCommit) {
            sections.push(`## 📝 Latest Commit`);
            sections.push('');
            sections.push(`<div style="background: var(--background-secondary); border-radius: 8px; padding: 16px; border-left: 4px solid var(--interactive-accent);">`);
            sections.push(`  <div style="font-weight: 600; margin-bottom: 8px;">${this.escapeHtml(data.lastCommit.message)}</div>`);
            sections.push(`  <div style="display: flex; gap: 16px; color: var(--text-muted); font-size: 0.9em;">`);
            sections.push(`    <span>👤 ${data.lastCommit.author}</span>`);
            sections.push(`    <span>🕐 ${timeAgo}</span>`);
            sections.push(`    <a href="${data.url}/commit/${data.lastCommit.sha}" style="color: var(--text-accent);">🔗 ${data.lastCommit.sha.substring(0, 7)}</a>`);
            sections.push(`  </div>`);
            sections.push(`</div>`);
            sections.push('');
        }

        // Topics/Tags
        if (data.topics && data.topics.length > 0) {
            sections.push(`## 🏷️ Topics`);
            sections.push('');
            sections.push(`<div style="display: flex; gap: 8px; flex-wrap: wrap;">`);
            data.topics.forEach(topic => {
                sections.push(`  <span style="background: var(--background-modifier-border); padding: 4px 10px; border-radius: 6px; font-size: 0.85em;">${topic}</span>`);
            });
            sections.push(`</div>`);
            sections.push('');
        }

        // Quick Actions
        sections.push(`## ⚡ Quick Actions`);
        sections.push('');
        sections.push(`<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">`);
        sections.push(this.createActionButton('🔗 Repository', data.url));
        sections.push(this.createActionButton('🐛 Issues', `${data.url}/issues`));
        sections.push(this.createActionButton('🔀 Pull Requests', `${data.url}/pulls`));
        sections.push(this.createActionButton('📜 Commits', `${data.url}/commits`));
        if (data.homepage) {
            sections.push(this.createActionButton('🌐 Website', data.homepage));
        }
        sections.push(`</div>`);
        sections.push('');

        // Repository Info Table
        sections.push(`## 📋 Repository Info`);
        sections.push('');
        sections.push(`| Property | Value |`);
        sections.push(`| :--- | :--- |`);
        sections.push(`| **Full Name** | [${data.fullName}](${data.url}) |`);
        sections.push(`| **Created** | ${new Date(data.createdAt).toLocaleDateString()} |`);
        sections.push(`| **Language** | ${data.language || 'Not specified'} |`);
        if (data.homepage) {
            sections.push(`| **Website** | [${data.homepage}](${data.homepage}) |`);
        }
        sections.push('');

        // Footer
        sections.push(`---`);
        sections.push(`<div style="display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.85em;">`);
        sections.push(`  <span>📦 Project Snapshot</span>`);
        sections.push(`  <span>Last synced: ${new Date().toLocaleString()}</span>`);
        sections.push(`</div>`);

        return sections.join('\n');
    }

    private static createStatCard(icon: string, label: string, value: string, color: string): string {
        return `  <div style="background: var(--background-secondary); border-radius: 10px; padding: 16px; text-align: center; border-top: 3px solid ${color};">
    <div style="font-size: 1.5em; font-weight: bold; color: var(--text-normal);">${value}</div>
    <div style="color: var(--text-muted); font-size: 0.85em; margin-top: 4px;">${icon} ${label}</div>
  </div>`;
    }

    private static createActionButton(label: string, url: string): string {
        return `  <a href="${url}" style="display: block; background: var(--background-modifier-border); padding: 10px 16px; border-radius: 8px; text-decoration: none; color: var(--text-normal); text-align: center; transition: all 0.2s;">${label}</a>`;
    }

    private static getActivityStatus(lastCommitDate: string): { label: string; color: string; icon: string } {
        const daysSince = Math.floor((Date.now() - new Date(lastCommitDate).getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSince <= 7) return { label: 'Very Active', color: '#22c55e', icon: '🟢' };
        if (daysSince <= 30) return { label: 'Active', color: '#3b82f6', icon: '🔵' };
        if (daysSince <= 90) return { label: 'Moderate', color: '#f59e0b', icon: '🟡' };
        return { label: 'Inactive', color: '#ef4444', icon: '🔴' };
    }

    private static calculateHealthScore(data: RepoData): number {
        let score = 50; // Base score
        
        // Activity bonus (up to +25)
        const daysSinceCommit = Math.floor((Date.now() - new Date(data.lastCommit.date).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceCommit <= 7) score += 25;
        else if (daysSinceCommit <= 30) score += 15;
        else if (daysSinceCommit <= 90) score += 5;
        else score -= 10;
        
        // Stars bonus (up to +15)
        if (data.stars >= 1000) score += 15;
        else if (data.stars >= 100) score += 10;
        else if (data.stars >= 10) score += 5;
        
        // Issue penalty (up to -15)
        if (data.openIssues > 50) score -= 15;
        else if (data.openIssues > 20) score -= 10;
        else if (data.openIssues > 10) score -= 5;
        
        // Description bonus
        if (data.description) score += 5;
        
        // Topics bonus
        if (data.topics && data.topics.length > 0) score += 5;
        
        return Math.max(0, Math.min(100, score));
    }

    private static escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
