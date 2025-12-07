import { formatDistanceToNow } from 'date-fns';
import { RepoData } from '../github/api';
import { ProjectSnapshotSettings } from '../settings';

export class ProjectNoteTemplate {
    static generate(data: RepoData, settings: ProjectSnapshotSettings): string {
        const sections: string[] = [];

        // Frontmatter
        sections.push('---');
        sections.push(`repo_url: ${data.url}`);
        sections.push(`updated: ${new Date().toISOString()}`);
        sections.push('tags:');
        sections.push('  - project-snapshot');
        sections.push('---');
        sections.push('');

        // Header
        sections.push(`# ${data.repo}`);
        sections.push('');

        // Metadata
        sections.push(`**Repository:** [${data.fullName}](${data.url})`);
        sections.push(`**Language:** ${data.language}`);

        if (settings.templateCustomization.includeStars) {
            sections.push(`**Stars:** ⭐ ${data.stars}`);
        }

        if (data.homepage) {
            sections.push(`**Homepage:** ${data.homepage}`);
        }

        sections.push('');

        // Description
        if (settings.templateCustomization.includeDescription && data.description) {
            sections.push(`## Description`);
            sections.push(data.description);
            sections.push('');
        }

        // Quick Stats
        sections.push(`## Quick Stats`);

        if (settings.templateCustomization.includeIssues) {
            sections.push(`- 🐛 **Open Issues:** ${data.openIssues}`);
        }

        if (settings.templateCustomization.includeLastCommit) {
            const timeAgo = formatDistanceToNow(new Date(data.lastCommit.date), { addSuffix: true });
            sections.push(`- 📝 **Last Commit:** "${data.lastCommit.message}" (${timeAgo})`);
            sections.push(`- 👤 **Author:** ${data.lastCommit.author}`);
            sections.push(`- 🔗 **Commit:** [\`${data.lastCommit.sha}\`](${data.url}/commit/${data.lastCommit.sha})`);
        }

        sections.push('');

        // Topics
        if (data.topics.length > 0) {
            sections.push(`## Topics`);
            sections.push(data.topics.map(t => `#${t}`).join(' '));
            sections.push('');
        }

        // Quick Actions
        sections.push(`## Quick Actions`);
        sections.push(`- [Open Repository](${data.url})`);
        sections.push(`- [View Issues](${data.url}/issues)`);
        sections.push(`- [View Pull Requests](${data.url}/pulls)`);
        sections.push(`- [View Commits](${data.url}/commits)`);
        sections.push('');

        // Footer
        sections.push(`---`);
        sections.push(`*Last updated: ${new Date().toLocaleString()}*`);

        return sections.join('\n');
    }
}
