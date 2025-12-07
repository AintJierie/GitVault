import { App, Modal, Notice, Setting, TextAreaComponent, setIcon } from 'obsidian';
import { GitHubAPI } from '../github/api';

export class CreateIssueModal extends Modal {
    private title: string = '';
    private body: string = '';

    constructor(
        app: App,
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.style.cssText = 'padding: 0; width: 600px; max-width: 90vw;';

        // Header
        const header = contentEl.createDiv();
        header.style.cssText = 'background: var(--background-secondary); padding: 20px; border-bottom: 1px solid var(--background-modifier-border);';

        const titleRow = header.createDiv();
        titleRow.style.cssText = 'display: flex; align-items: center; gap: 12px;';

        const iconEl = titleRow.createSpan();
        setIcon(iconEl, 'plus-circle');
        iconEl.style.cssText = 'color: #22c55e; font-size: 1.3em;';

        titleRow.createEl('h2', { text: 'Create New Issue' }).style.cssText = 'margin: 0; font-size: 1.3em;';

        const repoName = header.createDiv({ text: `${this.repoInfo.owner}/${this.repoInfo.repo}` });
        repoName.style.cssText = 'color: var(--text-muted); font-size: 0.9em; margin-top: 4px;';

        // Form
        const form = contentEl.createDiv();
        form.style.cssText = 'padding: 20px;';

        // Title field
        const titleGroup = form.createDiv();
        titleGroup.style.cssText = 'margin-bottom: 20px;';

        const titleLabel = titleGroup.createEl('label', { text: 'Title' });
        titleLabel.style.cssText = 'display: block; font-weight: 600; margin-bottom: 8px;';

        const titleInput = titleGroup.createEl('input', { type: 'text', placeholder: 'Brief description of the issue' });
        titleInput.style.cssText = 'width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); font-size: 1em;';
        titleInput.addEventListener('input', (e) => {
            this.title = (e.target as HTMLInputElement).value;
        });

        // Body field
        const bodyGroup = form.createDiv();
        bodyGroup.style.cssText = 'margin-bottom: 20px;';

        const bodyLabel = bodyGroup.createEl('label', { text: 'Description' });
        bodyLabel.style.cssText = 'display: block; font-weight: 600; margin-bottom: 8px;';

        const bodyHint = bodyGroup.createDiv({ text: 'Markdown supported' });
        bodyHint.style.cssText = 'font-size: 0.85em; color: var(--text-muted); margin-bottom: 8px;';

        const bodyTextarea = bodyGroup.createEl('textarea', { placeholder: 'Describe the issue in detail...\n\n## Steps to Reproduce\n1. \n2. \n\n## Expected Behavior\n\n## Actual Behavior' });
        bodyTextarea.style.cssText = 'width: 100%; min-height: 200px; padding: 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); font-family: var(--font-monospace); font-size: 0.9em; resize: vertical;';
        bodyTextarea.addEventListener('input', (e) => {
            this.body = (e.target as HTMLTextAreaElement).value;
        });

        // Tips
        const tips = form.createDiv();
        tips.style.cssText = 'background: var(--background-secondary); padding: 12px 16px; border-radius: 8px; font-size: 0.85em;';
        tips.createEl('div', { text: '💡 Tips for a good issue:' }).style.cssText = 'font-weight: 600; margin-bottom: 8px;';
        const tipsList = tips.createEl('ul');
        tipsList.style.cssText = 'margin: 0; padding-left: 20px; color: var(--text-muted);';
        tipsList.createEl('li', { text: 'Use a clear, descriptive title' });
        tipsList.createEl('li', { text: 'Include steps to reproduce (if applicable)' });
        tipsList.createEl('li', { text: 'Add screenshots or code snippets' });

        // Footer
        const footer = contentEl.createDiv();
        footer.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px; padding: 16px 20px; border-top: 1px solid var(--background-modifier-border); background: var(--background-secondary);';

        const cancelBtn = footer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => this.close();

        const submitBtn = footer.createEl('button', { text: '🐛 Create Issue', cls: 'mod-cta' });
        submitBtn.style.cssText = 'display: flex; align-items: center; gap: 6px;';
        submitBtn.onclick = async () => {
            if (!this.title.trim()) {
                new Notice('⚠️ Title is required');
                titleInput.focus();
                titleInput.style.borderColor = '#ef4444';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.setText('Creating...');

            try {
                const issue = await this.githubAPI.createIssue(
                    this.repoInfo.owner,
                    this.repoInfo.repo,
                    this.title,
                    this.body
                );
                new Notice(`✅ Issue #${issue.number} created!`);
                this.close();
                window.open(issue.html_url);
            } catch (e: any) {
                new Notice(`❌ Error: ${e.message}`);
                submitBtn.disabled = false;
                submitBtn.setText('🐛 Create Issue');
            }
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
